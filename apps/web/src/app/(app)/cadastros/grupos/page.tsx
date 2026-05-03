// /cadastros/grupos — read-only do catálogo ZmartBI, agrupado por grupo + contagem.

import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireLojaAtiva } from '@/lib/permissions';
import { PageHead } from '@/components/shell/page-head';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default async function GruposPage() {
  const { lojaId } = await requireLojaAtiva();

  const grupos = await prisma.grupo.findMany({
    where: { produtos: { some: { lojaId, ativo: true } } },
    orderBy: { nome: 'asc' },
    select: {
      id: true,
      nome: true,
      _count: { select: { produtos: { where: { lojaId, ativo: true } } } },
      subgrupos: {
        where: { produtos: { some: { lojaId, ativo: true } } },
        orderBy: { nome: 'asc' },
        select: {
          id: true,
          nome: true,
          _count: { select: { produtos: { where: { lojaId, ativo: true } } } },
        },
      },
    },
  });

  const totalGrupos = grupos.length;
  const totalProdutos = grupos.reduce((acc, g) => acc + g._count.produtos, 0);

  return (
    <div className="max-w-[1100px] mx-auto">
      <PageHead
        eyebrow="Cadastros · Grupos"
        title={
          <>
            Famílias de <em>produtos</em>
          </>
        }
        sub={`${totalGrupos} grupos · ${totalProdutos.toLocaleString('pt-BR')} produtos ativos. Hierarquia e nomes vêm do ZmartBI; ícones e cores podem ser customizados pelo Gestor (em breve).`}
      />

      {totalGrupos === 0 ? (
        <Card className="p-10 text-center text-rm-mid">
          Nenhum grupo sincronizado ainda — rode o sync em <Link href="/sincronizacao" className="rm-link">sincronização</Link>.
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {grupos.map((g) => (
            <Card key={g.id} className="p-5">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="min-w-0">
                  <p className="rm-eyebrow text-rm-mid">Grupo</p>
                  <h3 className="rm-h4 mt-1 truncate" title={g.nome}>{g.nome}</h3>
                </div>
                <Badge variant="green">{g._count.produtos.toLocaleString('pt-BR')}</Badge>
              </div>
              <div className="space-y-1">
                {g.subgrupos.map((s) => (
                  <div key={s.id} className="flex items-center justify-between text-[12.5px] py-1 border-b border-dashed border-hairline">
                    <span className="text-rm-ink-2 truncate pr-3">{s.nome}</span>
                    <span className="text-rm-mid rm-mono text-[11px]">{s._count.produtos}</span>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
