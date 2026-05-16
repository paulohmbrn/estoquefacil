import { createReadStream } from 'node:fs';
import { randomUUID } from 'node:crypto';
import StreamArrayLib from 'stream-json/streamers/StreamArray.js';
import ParserLib from 'stream-json/Parser.js';
import { Prisma, prisma, type SyncStatus } from '@estoque/db';

// stream-json é CJS; importar como default e desestruturar contra CommonJS.
const StreamArray = (StreamArrayLib as unknown as { default: typeof StreamArrayLib }).default ?? StreamArrayLib;
const Parser = (ParserLib as unknown as { default: typeof ParserLib }).default ?? ParserLib;
import {
  FILIAIS_MVP_SET,
  isCdarvprodContavel,
  cdarvprodEstoqueBase,
  parseZmartbiDate,
  ZMARTBI_CD_EMPRESA,
  ZMARTBI_NRORG,
  inferProdutoMetaDefaults,
} from '@estoque/shared';
import { redis } from '../redis.js';
import { logger } from '../logger.js';
import { acquireLock, releaseLock, getLockHolder } from './lock.js';
import { downloadDump, cleanupDump, ZmartbiDuplicateError } from './download.js';
import type { ZmartbiItem } from './types.js';

const BATCH_SIZE = 500;

export type SyncTrigger = { kind: 'cron' } | { kind: 'manual'; userId: string };

export type SyncOutcome = {
  syncRunId: string;
  status: SyncStatus;
  message: string;
};

export async function runZmartbiSync(trigger: SyncTrigger): Promise<SyncOutcome> {
  const holderId = `worker-${randomUUID()}`;
  const triggeredBy = trigger.kind === 'cron' ? 'cron' : trigger.userId;

  // 1) Acquire local lock
  const got = await acquireLock(redis, holderId);
  if (!got) {
    const holder = await getLockHolder(redis);
    logger.warn({ holder }, '[sync] lock local ocupado — abortando');
    const run = await prisma.syncRun.create({
      data: {
        status: 'ABORTED',
        triggeredBy,
        triggeredByUserId: trigger.kind === 'manual' ? trigger.userId : null,
        finishedAt: new Date(),
        durationMs: 0,
        errorMessage: `Lock local ocupado por ${holder ?? '?'}`,
      },
    });
    return { syncRunId: run.id, status: 'ABORTED', message: 'Outro sync já em andamento.' };
  }

  // 2) Cria SyncRun (RUNNING)
  const run = await prisma.syncRun.create({
    data: {
      status: 'RUNNING',
      triggeredBy,
      triggeredByUserId: trigger.kind === 'manual' ? trigger.userId : null,
    },
  });

  let dumpPath: string | null = null;
  const startedAt = Date.now();

  try {
    // 3) Download
    const dl = await downloadDump();
    dumpPath = dl.filePath;
    await prisma.syncRun.update({
      where: { id: run.id },
      data: { bytesBaixados: BigInt(dl.bytes) },
    });

    // 4) Pre-resolve lojas/grupos/subgrupos atuais para upsert eficiente
    const lojaByZmartbi = new Map<string, string>();
    for (const l of await prisma.loja.findMany({ select: { id: true, zmartbiId: true } })) {
      lojaByZmartbi.set(l.zmartbiId, l.id);
    }
    const grupoByZmartbi = new Map<string, string>();
    const grupoNomeById = new Map<string, string>();
    for (const g of await prisma.grupo.findMany({ select: { id: true, zmartbiId: true, nome: true } })) {
      grupoByZmartbi.set(g.zmartbiId, g.id);
      grupoNomeById.set(g.id, g.nome);
    }
    const subgrupoByZmartbi = new Map<string, string>();
    const subgrupoNomeById = new Map<string, string>();
    for (const s of await prisma.subgrupo.findMany({ select: { id: true, zmartbiId: true, nome: true } })) {
      subgrupoByZmartbi.set(s.zmartbiId, s.id);
      subgrupoNomeById.set(s.id, s.nome);
    }

    // Conjunto de produtos vistos (lojaId+cdarvprod) para soft-delete dos ausentes
    const seenKeys = new Set<string>();

    // Buffer de produtos a upsertar
    const buffer: ZmartbiItem[] = [];

    // Métricas
    let recebidos = 0;
    let ignorados = 0;
    let processados = 0;
    let produtosCriados = 0;
    let produtosAtualizados = 0;
    let gruposCriados = 0;
    let subgruposCriados = 0;

    const flushBuffer = async () => {
      if (buffer.length === 0) return;
      const items = buffer.splice(0, buffer.length);

      // Upsert grupos novos
      const gruposNovos = new Map<string, ZmartbiItem>();
      for (const it of items) {
        if (!grupoByZmartbi.has(it.CDGRUPPROD)) gruposNovos.set(it.CDGRUPPROD, it);
      }
      for (const it of gruposNovos.values()) {
        const created = await prisma.grupo.upsert({
          where: { zmartbiId: it.CDGRUPPROD },
          update: { nome: it.NMGRUPPROD, syncedAt: new Date() },
          create: { zmartbiId: it.CDGRUPPROD, nome: it.NMGRUPPROD },
        });
        if (!grupoByZmartbi.has(it.CDGRUPPROD)) gruposCriados += 1;
        grupoByZmartbi.set(it.CDGRUPPROD, created.id);
        grupoNomeById.set(created.id, created.nome);
      }

      // Upsert subgrupos novos
      const subgruposNovos = new Map<string, ZmartbiItem>();
      for (const it of items) {
        if (!subgrupoByZmartbi.has(it.CDSUBGRPROD)) subgruposNovos.set(it.CDSUBGRPROD, it);
      }
      for (const it of subgruposNovos.values()) {
        const grupoId = grupoByZmartbi.get(it.CDGRUPPROD);
        if (!grupoId) continue;
        const created = await prisma.subgrupo.upsert({
          where: { zmartbiId: it.CDSUBGRPROD },
          update: { nome: it.NMSUBGRPROD, grupoId, syncedAt: new Date() },
          create: { zmartbiId: it.CDSUBGRPROD, nome: it.NMSUBGRPROD, grupoId },
        });
        if (!subgrupoByZmartbi.has(it.CDSUBGRPROD)) subgruposCriados += 1;
        subgrupoByZmartbi.set(it.CDSUBGRPROD, created.id);
        subgrupoNomeById.set(created.id, created.nome);
      }

      // Upsert produtos em transação + coleta candidatos a ProdutoMeta default
      const metaCandidates: Prisma.ProdutoMetaCreateManyInput[] = [];
      // 60s pra transação inteira do batch (500 upserts) — default 5s estourava com >14k produtos
      await prisma.$transaction(async (tx) => {
        for (const it of items) {
          const lojaId = lojaByZmartbi.get(it.CDFILIAL);
          if (!lojaId) continue;
          const grupoId = grupoByZmartbi.get(it.CDGRUPPROD) ?? null;
          const subgrupoId = subgrupoByZmartbi.get(it.CDSUBGRPROD) ?? null;
          const data = {
            cdProduto: it.CDPRODUTO,
            cdBarra: it.CD_BARRA?.trim() || null,
            nome: it.NMPRODUTO,
            unidade: it.UNIDADE ?? 'UN',
            tipoProduto: it.TIPO_PRODUTO,
            vrPrecoVenda: new Prisma.Decimal(it.VRPRECO_VENDA),
            status: it.STATUS,
            compoeCmv: it.COMPOE_CMV === 'S',
            dtCadastro: parseZmartbiDate(it.DT_CADASTRO),
            dtAlteracao: parseZmartbiDate(it.DT_ALTERACAO),
            // Fator de conversão (ZmartBI). Confiar no dump (inclusive <1 e
            // o raro ...00 com fator !=1). Vínculo derivado do código.
            fatorConversao: new Prisma.Decimal(it.FATOR_CONVERSAO ?? 1),
            cdarvprodEstoque: cdarvprodEstoqueBase(it.CDARVPROD),
            tipoEstoque: it.CDARVPROD.endsWith('00') ? 'ESTOQUE' : 'COMPRA',
            grupoId,
            subgrupoId,
            ativo: true,
            syncedAt: new Date(),
          };
          const result = await tx.produto.upsert({
            where: { lojaId_cdarvprod: { lojaId, cdarvprod: it.CDARVPROD } },
            update: data,
            create: { ...data, lojaId, cdarvprod: it.CDARVPROD },
          });

          // Default de método/validade baseado em grupo/subgrupo (sem sobrescrever edição manual)
          const grupoNome = grupoId ? grupoNomeById.get(grupoId) : null;
          const subgrupoNome = subgrupoId ? subgrupoNomeById.get(subgrupoId) : null;
          const defaults = inferProdutoMetaDefaults({ grupoNome, subgrupoNome });
          if (defaults) {
            metaCandidates.push({
              produtoId: result.id,
              metodos: defaults.metodos,
              validadeResfriado: defaults.validadeResfriado,
              validadeCongelado: defaults.validadeCongelado,
              validadeAmbiente: defaults.validadeAmbiente,
              observacoes: defaults.observacoes,
            });
          }
        }
      }, { timeout: 60_000, maxWait: 10_000 });

      // skipDuplicates: produtos que já têm meta (editada manualmente OU já populada antes) ficam intactos
      if (metaCandidates.length > 0) {
        await prisma.produtoMeta.createMany({
          data: metaCandidates,
          skipDuplicates: true,
        });
      }

      // Marca os produtos vistos
      for (const it of items) {
        const lojaId = lojaByZmartbi.get(it.CDFILIAL);
        if (lojaId) seenKeys.add(`${lojaId}::${it.CDARVPROD}`);
      }
    };

    // 5) Stream parse
    await new Promise<void>((resolve, reject) => {
      const stream = createReadStream(dumpPath!);
      const pipeline = stream.pipe(Parser.parser()).pipe(StreamArray.streamArray());

      pipeline.on('data', async ({ value }: { value: ZmartbiItem }) => {
        recebidos += 1;
        if (
          !FILIAIS_MVP_SET.has(value.CDFILIAL) ||
          !isCdarvprodContavel(value.CDARVPROD, value.CDFILIAL) ||
          value.STATUS !== 'S'
        ) {
          ignorados += 1;
          return;
        }
        processados += 1;
        buffer.push(value);
        if (buffer.length >= BATCH_SIZE) {
          pipeline.pause();
          flushBuffer()
            .then(() => pipeline.resume())
            .catch(reject);
        }
      });
      pipeline.on('end', () => {
        flushBuffer().then(resolve).catch(reject);
      });
      pipeline.on('error', reject);
      stream.on('error', reject);
    });

    // 6) Soft-delete: produtos das lojas MVP que não vimos (foram desativados no ZmartBI)
    //
    // GUARD CRÍTICO — Em 06/05/2026 o ZmartBI entregou um dump vazio (recebidos=0)
    // e o updateMany abaixo desativou ~18 mil produtos de uma vez, derrubando o
    // catálogo de TODAS as lojas. A regra: se vier menos de 80% do que hoje está
    // ativo, é falha do ERP — abortamos o sync ao invés de propagar o estrago.
    const totalAtivosAntes = await prisma.produto.count({
      where: { loja: { zmartbiId: { in: [...FILIAIS_MVP_SET] } }, ativo: true },
    });
    const SAFETY_FLOOR = Math.max(100, Math.floor(totalAtivosAntes * 0.8));
    if (processados < SAFETY_FLOOR) {
      const motivo =
        processados === 0
          ? 'dump do ZmartBI veio vazio'
          : `dump trouxe apenas ${processados} produtos (mínimo seguro: ${SAFETY_FLOOR}, base atual: ${totalAtivosAntes})`;
      logger.error(
        { syncRunId: run.id, recebidos, processados, totalAtivosAntes, SAFETY_FLOOR },
        `[sync] abortado por safety guard: ${motivo}`,
      );
      await prisma.syncRun.update({
        where: { id: run.id },
        data: {
          status: 'FAILED',
          finishedAt: new Date(),
          durationMs: Date.now() - startedAt,
          itensRecebidos: recebidos,
          itensIgnorados: ignorados,
          itensProcessados: processados,
          errorMessage: `Sync abortado pra preservar catálogo: ${motivo}`,
        },
      });
      return {
        syncRunId: run.id,
        status: 'FAILED',
        message: `Sync abortado pra preservar catálogo: ${motivo}`,
      };
    }

    const desativacao = await prisma.produto.updateMany({
      where: {
        loja: { zmartbiId: { in: [...FILIAIS_MVP_SET] } },
        ativo: true,
        // Apenas itens cuja syncedAt é mais antiga que o início desta corrida
        syncedAt: { lt: new Date(startedAt) },
      },
      data: { ativo: false },
    });

    // Cálculo aproximado de criados vs atualizados (a partir do delta)
    const totalAtual = await prisma.produto.count({ where: { ativo: true } });
    produtosCriados = Math.max(0, processados - totalAtual + desativacao.count);
    produtosAtualizados = processados - produtosCriados;

    const finishedAt = new Date();
    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        status: 'SUCCESS',
        finishedAt,
        durationMs: Date.now() - startedAt,
        itensRecebidos: recebidos,
        itensIgnorados: ignorados,
        itensProcessados: processados,
        produtosCriados,
        produtosAtualizados,
        produtosDesativados: desativacao.count,
        gruposCriados,
        subgruposCriados,
      },
    });

    logger.info(
      { syncRunId: run.id, recebidos, processados, desativados: desativacao.count, durationMs: Date.now() - startedAt },
      '[sync] concluído',
    );
    return { syncRunId: run.id, status: 'SUCCESS', message: 'Sincronização concluída.' };
  } catch (err) {
    const error = err as Error;
    const isLocked = err instanceof ZmartbiDuplicateError;
    const status: SyncStatus = isLocked ? 'LOCKED' : 'FAILED';
    logger.error({ err: error.message, status }, '[sync] falha');
    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        status,
        finishedAt: new Date(),
        durationMs: Date.now() - startedAt,
        errorMessage: error.message,
        errorStack: error.stack ?? null,
      },
    });
    return { syncRunId: run.id, status, message: error.message };
  } finally {
    if (dumpPath) await cleanupDump(dumpPath);
    await releaseLock(redis, holderId);
  }
}
