// /estoque-controlado — hub do estoquista: saldo por produto (etiquetas ATIVA),
// entradas/baixas do dia, gerar etiquetas avulsas e atalho pra baixa por scan.

import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireLojaAtiva } from '@/lib/permissions';
import { FILIAIS_ESTOQUE_CONTROLADO_SET } from '@estoque/shared';
import { PageHead } from '@/components/shell/page-head';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GerarEtiquetasClient } from './gerar-client';

export default async function EstoqueControladoHub() {
  const { lojaId } = await requireLojaAtiva();
  const loja = await prisma.loja.findUnique({
    where: { id: lojaId },
    select: { zmartbiId: true, apelido: true, nome: true },
  });

  if (!loja || !FILIAIS_ESTOQUE_CONTROLADO_SET.has(loja.zmartbiId)) {
    return (
      <div className="max-w-[920px] mx-auto">
        <PageHead
          eyebrow="Operação · Estoque Controlado"
          title={<>Estoque <em>Controlado</em></>}
          sub="Recurso não habilitado para esta loja."
        />
        <Card className="p-6 text-rm-mid text-[14px]">
          O Estoque Controlado está disponível apenas nas pizzarias Reis Magos e na
          Madre Pane. Troque de loja no seletor acima.
        </Card>
      </div>
    );
  }

  const inicioDoDia = new Date();
  inicioDoDia.setHours(0, 0, 0, 0);

  const [saldoGrupos, entradasHoje, baixasHoje] = await Promise.all([
    prisma.etiqueta.groupBy({
      by: ['produtoId'],
      where: { lojaId, estado: 'ATIVA', cdarvprodEstoqueSnap: { not: null } },
      _count: { _all: true },
    }),
    prisma.etiqueta.count({
      where: { lojaId, cdarvprodEstoqueSnap: { not: null }, impressaEm: { gte: inicioDoDia } },
    }),
    prisma.etiqueta.count({
      where: { lojaId, estado: 'BAIXADA', baixadaEm: { gte: inicioDoDia } },
    }),
  ]);

  const produtos = saldoGrupos.length
    ? await prisma.produto.findMany({
        where: { id: { in: saldoGrupos.map((g) => g.produtoId) } },
        select: { id: true, nome: true, cdarvprod: true, unidade: true },
      })
    : [];
  const byId = new Map(produtos.map((p) => [p.id, p]));
  const saldo = saldoGrupos
    .map((g) => {
      const p = byId.get(g.produtoId);
      return p ? { ...p, ativas: g._count._all } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => a.nome.localeCompare(b.nome));

  const totalUnidades = saldo.reduce((s, x) => s + x.ativas, 0);

  return (
    <div className="max-w-[920px] mx-auto">
      <PageHead
        eyebrow="Operação · Estoque Controlado"
        title={<>Estoque <em>Controlado</em></>}
        sub={`${loja.apelido ?? loja.nome} — cada unidade física tem uma etiqueta. O saldo é o número de etiquetas ativas.`}
      />

      <div className="grid grid-cols-3 gap-3 mb-8">
        <Card className="p-4">
          <p className="rm-eyebrow text-rm-gold">Em estoque</p>
          <p className="rm-h2 mt-1">{totalUnidades}</p>
          <p className="text-[12px] text-rm-mid">etiquetas ativas</p>
        </Card>
        <Card className="p-4">
          <p className="rm-eyebrow text-rm-gold">Entradas hoje</p>
          <p className="rm-h2 mt-1">{entradasHoje}</p>
        </Card>
        <Card className="p-4">
          <p className="rm-eyebrow text-rm-gold">Baixas hoje</p>
          <p className="rm-h2 mt-1">{baixasHoje}</p>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3 mb-8">
        <Link href="/estoque-controlado/baixa" className="ef-btn ef-btn-primary inline-flex">
          Baixar por scan
        </Link>
      </div>

      <section className="mb-10">
        <h2 className="rm-eyebrow text-rm-gold mb-3">Gerar etiquetas (avulso)</h2>
        <GerarEtiquetasClient />
      </section>

      <section>
        <h2 className="rm-eyebrow text-rm-gold mb-3">Saldo por produto</h2>
        {saldo.length === 0 ? (
          <Card className="p-6 text-rm-mid text-[14px]">
            Nenhuma etiqueta ativa. Gere etiquetas acima ao receber mercadoria.
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {saldo.map((s) => (
              <Card key={s.id} className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="rm-h4 truncate">{s.nome}</p>
                  <p className="text-[12px] text-rm-mid mt-1">
                    {s.cdarvprod} · {s.unidade}
                  </p>
                </div>
                <Badge variant="gold" className="shrink-0">
                  {s.ativas} un
                </Badge>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
