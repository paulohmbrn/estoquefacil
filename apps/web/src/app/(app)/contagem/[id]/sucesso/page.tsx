import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireLojaAtiva } from '@/lib/permissions';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const dt = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Sao_Paulo',
});
const dtData = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'UTC' });

export default async function SucessoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { lojaId } = await requireLojaAtiva();

  const c = await prisma.contagem.findUnique({
    where: { id },
    include: {
      responsavel: { select: { nome: true } },
      lista: { select: { nome: true } },
      _count: { select: { lancamentos: true } },
      lancamentos: { select: { quantidade: true } },
    },
  });
  if (!c || c.lojaId !== lojaId) notFound();

  const totalQtd = c.lancamentos.reduce((acc, l) => acc + Number(l.quantidade), 0);

  return (
    <div className="max-w-[640px] mx-auto pt-4 sm:pt-6">
      <Card className="p-6 sm:p-8 text-center border-t-[6px] border-rm-green">
        <p className="rm-eyebrow text-rm-green">Contagem concluída</p>
        <h1 className="font-sans font-bold text-[28px] sm:text-h1 leading-tight mt-3">
          Parabéns, <em>{firstName(c.responsavel.nome)}!</em>
        </h1>
        <p className="rm-body text-rm-mid mt-2">
          {c.lista?.nome ? `Lista "${c.lista.nome}"` : 'Contagem livre'} foi enviada.
        </p>

        <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-6">
          <Stat label="Produtos" value={String(c._count.lancamentos)} />
          <Stat
            label="Qtd. total"
            value={totalQtd.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}
          />
          <Stat label="Data" value={dtData.format(c.dataContagem)} />
        </div>

        <div className="mt-8 pt-6 border-t border-dashed border-hairline">
          <p className="rm-eyebrow text-rm-mid mb-3">Exportar / imprimir</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <a
              href={`/api/export/contagem/${c.id}`}
              className="ef-btn ef-btn-primary justify-center"
            >
              Baixar .xlsx (ZmartBI)
            </a>
            <a
              href={`/api/contagem/${c.id}/pdf`}
              className="ef-btn ef-btn-ghost justify-center"
            >
              Imprimir A4 (PDF)
            </a>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mt-6">
          <Link href="/contagem" className="ef-btn ef-btn-ghost flex-1 justify-center">
            Voltar pra contagens
          </Link>
          <Link href="/contagem/iniciar" className="ef-btn ef-btn-primary flex-1 justify-center">
            Nova contagem →
          </Link>
        </div>
        <p className="mt-6">
          <Badge variant="green">{c.status}</Badge>
        </p>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#fafaf7] border border-hairline rounded-xs p-3 flex flex-col items-center justify-between gap-2 min-h-[88px] text-center">
      <p className="text-[10px] font-semibold tracking-[.14em] uppercase text-rm-mid leading-tight">
        {label}
      </p>
      <p className="font-sans font-bold text-[24px] leading-none tabular-nums break-all">{value}</p>
    </div>
  );
}

function firstName(s: string): string {
  return s.split(/\s+/)[0] ?? s;
}
