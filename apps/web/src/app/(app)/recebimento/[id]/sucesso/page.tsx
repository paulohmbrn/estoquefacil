import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireLojaAtiva } from '@/lib/permissions';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const dtData = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'UTC' });

export default async function RecebimentoSucessoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { lojaId } = await requireLojaAtiva();
  const r = await prisma.recebimento.findUnique({
    where: { id },
    include: {
      responsavel: { select: { nome: true } },
      _count: { select: { itens: true } },
      itens: { select: { quantidade: true } },
    },
  });
  if (!r || r.lojaId !== lojaId) notFound();
  const totalQtd = r.itens.reduce((acc, i) => acc + Number(i.quantidade), 0);

  return (
    <div className="max-w-[640px] mx-auto pt-4 sm:pt-6">
      <Card className="p-6 sm:p-8 text-center border-t-[6px] border-rm-green">
        <p className="rm-eyebrow text-rm-green">Recebimento finalizado</p>
        <h1 className="font-sans font-bold text-[28px] sm:text-h1 leading-tight mt-3">
          Tudo <em>conferido!</em>
        </h1>
        <p className="rm-body text-rm-mid mt-2">
          {r.fornecedor ? `${r.fornecedor}` : 'Sem fornecedor'}
          {r.numeroNf ? ` · NF ${r.numeroNf}` : ''} foi registrado.
        </p>

        <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-6">
          <Stat label="Itens" value={String(r._count.itens)} />
          <Stat label="Qtd. total" value={totalQtd.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} />
          <Stat label="Data" value={dtData.format(r.dataRecebimento)} />
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mt-6">
          <Link href="/recebimento" className="ef-btn ef-btn-ghost flex-1 justify-center">
            Voltar
          </Link>
          <Link href="/recebimento/iniciar" className="ef-btn ef-btn-primary flex-1 justify-center">
            Novo recebimento →
          </Link>
        </div>
        <p className="mt-6">
          <Badge variant="green">{r.status}</Badge>
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
