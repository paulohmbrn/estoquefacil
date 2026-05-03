// /relatorios — index com cards pra os relatórios disponíveis.

import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireLojaAtiva } from '@/lib/permissions';
import { PageHead } from '@/components/shell/page-head';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default async function RelatoriosIndexPage() {
  const { lojaId } = await requireLojaAtiva();

  const [totalContagens, abertas, ultimoExport] = await Promise.all([
    prisma.contagem.count({ where: { lojaId } }),
    prisma.contagem.count({ where: { lojaId, status: 'EM_ANDAMENTO' } }),
    prisma.contagem.findFirst({
      where: { lojaId, status: 'EXPORTADA' },
      orderBy: { exportadaEm: 'desc' },
      select: { exportadaEm: true },
    }),
  ]);

  return (
    <div className="max-w-[1100px] mx-auto">
      <PageHead
        eyebrow="Análise · Relatórios"
        title={
          <>
            Relatórios e <em>exports</em>
          </>
        }
        sub="Histórico de contagens, export para o ZmartBI no formato exato (CDARVPROD/DTLANCESTQ/QTTOTLANCTO)."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Link
          href="/relatorios/contagens"
          className="block bg-white border border-hairline rounded-xs p-6 hover:border-rm-green transition-colors"
        >
          <p className="rm-eyebrow text-rm-mid">Histórico</p>
          <h3 className="rm-h3 mt-2">Contagens</h3>
          <p className="rm-caption text-rm-mid mt-2">
            Veja todas as contagens, filtre por data/responsável/status, e baixe o xlsx individual ou consolidado do dia.
          </p>
          <div className="mt-4 flex gap-3 text-[12px]">
            <Badge variant="green">{totalContagens} total</Badge>
            {abertas > 0 && <Badge variant="gold">{abertas} abertas</Badge>}
          </div>
        </Link>

        <Link
          href="/relatorios/consumo"
          className="block bg-white border border-hairline rounded-xs p-6 hover:border-rm-green transition-colors"
        >
          <p className="rm-eyebrow text-rm-mid">Operacional</p>
          <h3 className="rm-h3 mt-2">Consumo real</h3>
          <p className="rm-caption text-rm-mid mt-2">
            Contagem anterior + Recebimentos − Contagem atual = Consumo.
            Detecta quebra, perda ou divergência.
          </p>
        </Link>

        <Card className="p-6">
          <p className="rm-eyebrow text-rm-mid">Último export</p>
          <h3 className="rm-h4 mt-2">
            {ultimoExport?.exportadaEm
              ? new Intl.DateTimeFormat('pt-BR', {
                  dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo',
                }).format(ultimoExport.exportadaEm)
              : 'Nunca exportado'}
          </h3>
          <p className="rm-caption text-rm-mid mt-2">
            Filename: <span className="rm-mono text-rm-ink">CONTAGEMFILIAL{'{LOJAID}{DDMMAAAA}'}.xlsx</span>
          </p>
        </Card>
      </div>
    </div>
  );
}
