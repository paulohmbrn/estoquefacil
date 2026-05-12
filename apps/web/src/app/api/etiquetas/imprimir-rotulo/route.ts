// POST /api/etiquetas/imprimir-rotulo — body: { itens: [{produtoId, lote, fabricacao, conteudoLiquido}], qtd }
// Gera o ZPL do rótulo industrializado 100×100mm e despacha pro agente local
// via WebSocket no apps/api (mesmo caminho do imprimir-ws).
//
// Diferente do /api/etiquetas/imprimir-ws, este recebe DADOS POR LOTE (data
// de fabricação, número de lote e conteúdo líquido) por item — esses campos
// são por impressão, não ficam no produto.

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireGestor, requireLojaAtiva } from '@/lib/permissions';
import {
  generateEtiquetasZplRotulo,
  type RotuloItem,
  type RotuloFabricante,
} from '@/lib/etiqueta-zpl';
import { logoPorFilial } from '@/lib/etiqueta-logos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const itemSchema = z.object({
  produtoId: z.string().min(1),
  qtd: z.number().int().min(1).max(50),
  lote: z.string().min(1).max(20),
  fabricacao: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, 'fabricacao deve ser dd/mm/aaaa'),
  conteudoLiquido: z.string().min(1).max(40),
});
const bodySchema = z.object({ itens: z.array(itemSchema).min(1).max(50) });

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const { lojaId } = await requireLojaAtiva();
    await requireGestor({ lojaId });

    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validação', issues: parsed.error.flatten() }, { status: 400 });
    }

    const produtoIds = parsed.data.itens.map((i) => i.produtoId);
    const produtos = await prisma.produto.findMany({
      where: { id: { in: produtoIds }, lojaId, ativo: true },
      include: { nutricional: true },
    });
    const byId = new Map(produtos.map((p) => [p.id, p]));

    const loja = await prisma.loja.findUnique({
      where: { id: lojaId },
      select: {
        zmartbiId: true,
        nome: true,
        apelido: true,
        endereco: true,
        cnpj: true,
        razaoSocial: true,
        inscricaoEstadual: true,
        logradouro: true,
        numero: true,
        complemento: true,
        bairro: true,
        municipio: true,
        ufFiscal: true,
        cep: true,
        telefone: true,
      },
    });
    if (!loja) return NextResponse.json({ error: 'Loja não encontrada' }, { status: 404 });

    const fabricante: RotuloFabricante = {
      razaoSocial: loja.razaoSocial?.trim() || loja.nome,
      cnpj: formatCnpj(loja.cnpj),
      inscricaoEstadual: loja.inscricaoEstadual,
      endereco: loja.endereco,
      logradouro: loja.logradouro,
      numero: loja.numero,
      complemento: loja.complemento,
      bairro: loja.bairro,
      municipio: loja.municipio,
      uf: loja.ufFiscal,
      cep: formatCep(loja.cep),
      telefone: loja.telefone,
    };
    const logo = logoPorFilial(loja.zmartbiId);

    const items: RotuloItem[] = [];
    for (const it of parsed.data.itens) {
      const p = byId.get(it.produtoId);
      if (!p) continue;
      const n = p.nutricional;
      if (!n) {
        return NextResponse.json(
          { error: `Produto "${p.nome}" não tem informação nutricional cadastrada.` },
          { status: 400 },
        );
      }
      const porcaoTexto = montarPorcaoTexto(n.porcaoG, n.porcaoMedidaCaseira, n.porcoesEmbalagem, n.unidadeBase);
      const porcaoColunaTexto = n.porcaoG ? `${formatPorcaoNum(n.porcaoG)} ${n.unidadeBase}` : '—';

      const baseItem: RotuloItem = {
        produtoNome: p.nome,
        ean13: p.cdBarra,
        ingredientes: n.ingredientes,
        alergicos: n.alergicos,
        modoPreparo: n.modoPreparo,
        modoConservacao: n.modoConservacao,
        porcaoTexto,
        porcaoColunaTexto,
        logo,
        valoresPor100: {
          unidadeBase: (n.unidadeBase as 'g' | 'ml') ?? 'g',
          porcaoG: n.porcaoG,
          porcoesEmbalagem: n.porcoesEmbalagem,
          porcaoMedidaCaseira: n.porcaoMedidaCaseira,
          categoriaRDC429: (n.categoriaRDC429 as 'SOLIDO' | 'LIQUIDO' | 'REFEICAO_PRONTA') ?? 'SOLIDO',
          valorEnergeticoKcal100: n.valorEnergeticoKcal100,
          carboidratosG100: n.carboidratosG100,
          acucaresTotaisG100: n.acucaresTotaisG100,
          acucaresAdicionadosG100: n.acucaresAdicionadosG100,
          proteinasG100: n.proteinasG100,
          gordurasTotaisG100: n.gordurasTotaisG100,
          gordurasSaturadasG100: n.gordurasSaturadasG100,
          gordurasTransG100: n.gordurasTransG100,
          fibrasG100: n.fibrasG100,
          sodioMg100: n.sodioMg100,
        },
        fabricante,
        lote: { lote: it.lote, fabricacao: it.fabricacao, conteudoLiquido: it.conteudoLiquido },
      };

      for (let i = 0; i < it.qtd; i += 1) items.push(baseItem);
    }

    if (items.length === 0) {
      return NextResponse.json({ error: 'Nenhuma etiqueta válida' }, { status: 400 });
    }

    const zpl = generateEtiquetasZplRotulo(items);

    const apiUrl = process.env.INTERNAL_API_URL ?? 'http://estoque-api:3001';
    const internalToken = process.env.INTERNAL_API_TOKEN ?? '';
    const printRes = await fetch(`${apiUrl}/argox/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': internalToken },
      body: JSON.stringify({ lojaId, zpl }),
      cache: 'no-store',
    });
    const printBody = await printRes.json().catch(() => ({}));

    if (!printRes.ok) {
      return NextResponse.json(
        { ok: false, error: printBody.error ?? `api respondeu ${printRes.status}` },
        { status: printRes.status === 503 ? 503 : 502 },
      );
    }

    return NextResponse.json({ ok: true, total: items.length, bytes: printBody.bytes });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message ?? 'Erro interno' }, { status: 500 });
  }
}

function formatCnpj(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const d = raw.replace(/\D/g, '');
  if (d.length !== 14) return raw;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
}

function formatCep(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const d = raw.replace(/\D/g, '');
  if (d.length !== 8) return raw;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

function formatPorcaoNum(n: number): string {
  if (n >= 100) return Math.round(n).toString();
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(1).replace('.', ',');
}

function montarPorcaoTexto(
  porcaoG: number | null,
  medidaCaseira: string | null,
  porcoesEmbalagem: number | null,
  unidade: string,
): string {
  const partes: string[] = [];
  if (porcoesEmbalagem) {
    partes.push(`Porções por embalagem: ${formatPorcaoNum(porcoesEmbalagem)}`);
  }
  if (porcaoG) {
    const caseira = medidaCaseira ? ` (${medidaCaseira})` : '';
    partes.push(`Porção: ${formatPorcaoNum(porcaoG)} ${unidade}${caseira}`);
  }
  return partes.join(' · ');
}
