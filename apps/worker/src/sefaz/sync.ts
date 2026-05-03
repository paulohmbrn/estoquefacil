// Job que roda 8x/dia: pra cada loja com certificado, baixa NFes novas via DistribuicaoDFe.
// Loop até esgotar (ultNSU == maxNSU OU retorno cStat = 137 "nada novo").

import { readFile } from 'node:fs/promises';
import { prisma, Prisma, type SefazSyncStatus } from '@estoque/db';
import { decryptString } from '@estoque/shared';
import { logger } from '../logger.js';
import { consultarDistribuicaoDFe, parseNfeXml } from './distribuicao.js';

export interface SefazSyncOutcome {
  syncRunId: string;
  status: SefazSyncStatus;
  message: string;
}

const MAX_PAGES = 20; // segurança — ~20 lotes × ~50 NFes = 1000 NFes/loja por sync

export async function runSefazSyncForLoja(
  lojaId: string,
  triggeredBy: string,
): Promise<SefazSyncOutcome> {
  const run = await prisma.sefazSync.create({
    data: { lojaId, triggeredBy, status: 'RUNNING' },
  });
  const startedAt = Date.now();

  try {
    const loja = await prisma.loja.findUnique({
      where: { id: lojaId },
      select: {
        zmartbiId: true,
        cnpj: true,
        ufFiscal: true,
        certificadoPath: true,
        certificadoSenhaEnc: true,
        ultimoNsuSefaz: true,
      },
    });
    if (!loja) throw new Error('Loja não encontrada');
    if (!loja.cnpj || loja.cnpj.length !== 14) {
      await prisma.sefazSync.update({
        where: { id: run.id },
        data: { status: 'NO_CERT', finishedAt: new Date(), errorMessage: 'CNPJ não cadastrado' },
      });
      return { syncRunId: run.id, status: 'NO_CERT', message: 'CNPJ não cadastrado' };
    }
    if (!loja.certificadoPath || !loja.certificadoSenhaEnc) {
      await prisma.sefazSync.update({
        where: { id: run.id },
        data: { status: 'NO_CERT', finishedAt: new Date(), errorMessage: 'Certificado A1 não enviado' },
      });
      return { syncRunId: run.id, status: 'NO_CERT', message: 'Sem certificado' };
    }
    const uf = loja.ufFiscal ?? 'RN';

    // Carrega PFX + senha
    const pfx = await readFile(loja.certificadoPath);
    const senha = decryptString(loja.certificadoSenhaEnc);

    let ultNSU = loja.ultimoNsuSefaz ?? '0';
    let totalNfes = 0;
    let totalEventos = 0;
    let totalErros = 0;
    let pages = 0;

    while (pages < MAX_PAGES) {
      pages += 1;
      logger.info({ lojaId, pages, ultNSU }, '[sefaz] consultando');

      const ret = await consultarDistribuicaoDFe({
        uf,
        cnpj: loja.cnpj,
        ultNSU,
        pfx,
        senha,
      });

      logger.info(
        { lojaId, cStat: ret.cStat, xMotivo: ret.xMotivo, novos: ret.docs.length, ultNSU: ret.ultNSU, maxNSU: ret.maxNSU },
        '[sefaz] retorno',
      );

      // 137 = nada novo; 138 = encontrou; 656 = consumo indevido (cooldown 1h)
      if (ret.cStat === '137') break;
      if (ret.cStat === '656') {
        // SEFAZ pediu pra esperar 1h. Sinaliza no SefazSync e NÃO atualiza ultimoNsuSefaz.
        await prisma.sefazSync.update({
          where: { id: run.id },
          data: {
            status: 'PARTIAL',
            finishedAt: new Date(),
            durationMs: Date.now() - startedAt,
            ultimoNsu: ultNSU,
            totalNfes,
            totalEventos,
            totalErros,
            errorMessage: `SEFAZ pediu cooldown: ${ret.xMotivo}. Próximo cron ~3h vai retentar.`,
          },
        });
        return {
          syncRunId: run.id,
          status: 'PARTIAL',
          message: `SEFAZ pediu cooldown (cStat=656). Aguarde 1h e tente novamente.`,
        };
      }
      if (ret.cStat !== '138') {
        throw new Error(`SEFAZ cStat=${ret.cStat}: ${ret.xMotivo}`);
      }

      for (const doc of ret.docs) {
        try {
          // schemas: resNFe, procNFe, resEvento, procEventoNFe
          const isNfeCompleta = /procNFe/i.test(doc.schema);
          const isResNfe = /resNFe/i.test(doc.schema);
          const isEvento = /Evento/i.test(doc.schema);

          if (isEvento) {
            totalEventos += 1;
            // Eventos (cancelamento, manifestação) — descartados por enquanto.
            // Se a NFe foi cancelada, idealmente atualizaríamos a NotaFiscalImportada.
            continue;
          }

          if (isNfeCompleta) {
            const { meta } = parseNfeXml(doc.xml);
            // Verifica se já temos
            const existing = await prisma.notaFiscalImportada.findUnique({
              where: { chaveAcesso: meta.chaveAcesso },
              select: { id: true, schemaTipo: true },
            });
            if (existing) {
              // Atualiza schema/xml se hoje só tinha o resumo
              if (existing.schemaTipo !== 'procNFe') {
                await prisma.notaFiscalImportada.update({
                  where: { id: existing.id },
                  data: {
                    nsu: doc.nsu,
                    schemaTipo: 'procNFe',
                    xmlSchema: doc.schema,
                    xmlOriginal: doc.xml,
                    numeroNf: meta.numeroNf,
                    serieNf: meta.serieNf,
                    modelo: meta.modelo,
                    emissorCnpj: meta.emissorCnpj,
                    emissorNome: meta.emissorNome,
                    destCnpj: meta.destCnpj,
                    dataEmissao: meta.dataEmissao,
                    dataAutorizacao: meta.dataAutorizacao,
                    valorTotal: new Prisma.Decimal(meta.valorTotal),
                    qtdItens: meta.qtdItens,
                  },
                });
              }
              continue;
            }
            await prisma.notaFiscalImportada.create({
              data: {
                lojaId,
                chaveAcesso: meta.chaveAcesso,
                nsu: doc.nsu,
                schemaTipo: 'procNFe',
                xmlSchema: doc.schema,
                xmlOriginal: doc.xml,
                numeroNf: meta.numeroNf,
                serieNf: meta.serieNf,
                modelo: meta.modelo,
                emissorCnpj: meta.emissorCnpj,
                emissorNome: meta.emissorNome,
                destCnpj: meta.destCnpj,
                dataEmissao: meta.dataEmissao,
                dataAutorizacao: meta.dataAutorizacao,
                valorTotal: new Prisma.Decimal(meta.valorTotal),
                qtdItens: meta.qtdItens,
                status: 'PENDENTE',
              },
            });
            totalNfes += 1;
          } else if (isResNfe) {
            // Apenas resumo — guarda placeholder se ainda não temos a NFe completa
            // chaveAcesso vem em <resNFe><chNFe>
            const m = doc.xml.match(/<chNFe>(\d{44})<\/chNFe>/);
            if (!m) continue;
            const chave = m[1]!;
            const existing = await prisma.notaFiscalImportada.findUnique({
              where: { chaveAcesso: chave },
              select: { id: true },
            });
            if (existing) continue;
            await prisma.notaFiscalImportada.create({
              data: {
                lojaId,
                chaveAcesso: chave,
                nsu: doc.nsu,
                schemaTipo: 'resNFe',
                xmlSchema: doc.schema,
                xmlOriginal: doc.xml,
                status: 'PENDENTE',
              },
            });
            totalNfes += 1;
          }
        } catch (err) {
          totalErros += 1;
          logger.error({ lojaId, nsu: doc.nsu, err: (err as Error).message }, '[sefaz] erro processando doc');
        }
      }

      ultNSU = ret.ultNSU;

      // Critério de parada: ultNSU >= maxNSU ou doc vazio
      if (ret.ultNSU === ret.maxNSU || ret.docs.length === 0) break;
    }

    // Atualiza ultimoNsuSefaz na loja
    await prisma.loja.update({
      where: { id: lojaId },
      data: { ultimoNsuSefaz: ultNSU },
    });

    const status: SefazSyncStatus = totalErros > 0 ? 'PARTIAL' : 'SUCCESS';
    await prisma.sefazSync.update({
      where: { id: run.id },
      data: {
        status,
        finishedAt: new Date(),
        durationMs: Date.now() - startedAt,
        ultimoNsu: ultNSU,
        totalNfes,
        totalEventos,
        totalErros,
      },
    });
    return {
      syncRunId: run.id,
      status,
      message: `${totalNfes} NFes baixadas, ${totalEventos} eventos, ${totalErros} erros.`,
    };
  } catch (err) {
    const error = err as Error;
    logger.error({ lojaId, err: error.message }, '[sefaz] sync falhou');
    await prisma.sefazSync.update({
      where: { id: run.id },
      data: {
        status: 'FAILED',
        finishedAt: new Date(),
        durationMs: Date.now() - startedAt,
        errorMessage: error.message,
      },
    });
    return { syncRunId: run.id, status: 'FAILED', message: error.message };
  }
}

/** Roda sync pra TODAS as lojas com cert configurado. */
export async function runSefazSyncAll(triggeredBy: string): Promise<SefazSyncOutcome[]> {
  const lojas = await prisma.loja.findMany({
    where: {
      ativo: true,
      cnpj: { not: null },
      certificadoPath: { not: null },
      certificadoSenhaEnc: { not: null },
    },
    select: { id: true, zmartbiId: true },
  });
  const out: SefazSyncOutcome[] = [];
  for (const loja of lojas) {
    try {
      const r = await runSefazSyncForLoja(loja.id, triggeredBy);
      out.push(r);
    } catch (err) {
      logger.error({ lojaId: loja.id, err: (err as Error).message }, '[sefaz] erro fatal');
    }
  }
  return out;
}
