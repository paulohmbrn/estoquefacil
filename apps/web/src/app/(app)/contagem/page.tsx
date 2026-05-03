// /contagem — listagem de listas + contagens em andamento + iniciar livre.
// Mobile-first; também funciona em desktop como hub do operador.

import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireLojaAtiva } from '@/lib/permissions';
import { PageHead } from '@/components/shell/page-head';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default async function ContagemHubPage() {
  const { lojaId } = await requireLojaAtiva();

  const [listas, abertas] = await Promise.all([
    prisma.listaContagem.findMany({
      where: { lojaId, ativo: true },
      orderBy: { nome: 'asc' },
      include: { _count: { select: { produtos: true } } },
    }),
    prisma.contagem.findMany({
      where: { lojaId, status: 'EM_ANDAMENTO' },
      orderBy: { iniciadaEm: 'desc' },
      include: {
        responsavel: { select: { nome: true } },
        lista: { select: { nome: true } },
        _count: { select: { lancamentos: true } },
      },
    }),
  ]);

  return (
    <div className="max-w-[920px] mx-auto">
      <PageHead
        eyebrow="Operação · Contagem"
        title={
          <>
            Contar <em>estoque</em>
          </>
        }
        sub="Escolha uma lista para contar em sequência, ou inicie uma contagem livre e bipe os QRs como quiser."
      />

      {abertas.length > 0 && (
        <section className="mb-8">
          <h2 className="rm-eyebrow text-rm-gold mb-3">Em andamento</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {abertas.map((c) => (
              <Link
                key={c.id}
                href={`/contagem/${c.id}`}
                className="block bg-white border border-rm-gold rounded-xs p-4 shadow-card hover:shadow-lift transition-shadow"
              >
                <p className="rm-eyebrow text-rm-gold">{c.lista?.nome ?? 'Contagem livre'}</p>
                <p className="rm-h4 mt-1">{c.responsavel.nome}</p>
                <p className="text-[12px] text-rm-mid mt-1">
                  {c._count.lancamentos} produto{c._count.lancamentos !== 1 ? 's' : ''} contado{c._count.lancamentos !== 1 ? 's' : ''}
                </p>
                <Badge variant="gold" className="mt-3">Continuar →</Badge>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mb-8">
        <h2 className="rm-eyebrow mb-3">Listas pré-cadastradas</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link
            href="/contagem/iniciar"
            className="block bg-rm-green text-rm-cream rounded-xs p-5 hover:bg-rm-green-2 transition-colors"
          >
            <p className="rm-eyebrow !text-rm-cream opacity-80">Sem lista</p>
            <p className="rm-h3 mt-2 text-rm-cream">Contagem livre</p>
            <p className="text-[12px] mt-2 opacity-80">
              Bipa qualquer produto. Útil pra contagem rápida de itens avulsos.
            </p>
          </Link>
          {listas.map((l) => (
            <Link
              key={l.id}
              href={`/contagem/iniciar?listaId=${l.id}`}
              className="block bg-white border border-hairline rounded-xs p-5 hover:border-rm-green transition-colors"
            >
              <p className="rm-eyebrow text-rm-mid">{l._count.produtos} produtos</p>
              <p className="rm-h3 mt-2">{l.nome}</p>
              {l.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-3">
                  {l.tags.map((t) => (
                    <Badge key={t} variant="neutral">{t}</Badge>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
        {listas.length === 0 && (
          <Card className="p-6 text-center text-rm-mid mt-3">
            Sem listas cadastradas ainda. Vá em <Link href="/listas" className="rm-link">Listas</Link> para criar.
          </Card>
        )}
      </section>
    </div>
  );
}
