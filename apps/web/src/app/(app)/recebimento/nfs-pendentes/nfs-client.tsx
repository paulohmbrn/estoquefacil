'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ignorarNf } from '@/app/_actions/sefaz';

export type NfPendente = {
  id: string;
  chaveAcesso: string;
  numeroNf: string | null;
  serieNf: string | null;
  emissorNome: string | null;
  emissorCnpj: string | null;
  dataEmissao: string | null;
  valorTotal: number | null;
  qtdItens: number | null;
  schemaTipo: string;
};

export type FuncionarioOpt = { id: string; nome: string };

const dtData = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'America/Sao_Paulo' });

export function NfsClient({ nfs, funcionarios }: { nfs: NfPendente[]; funcionarios: FuncionarioOpt[] }) {
  const router = useRouter();
  return (
    <ul className="space-y-2">
      {nfs.map((n) => (
        <li key={n.id} className="bg-white border border-hairline rounded-xs p-3">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium text-[14px] truncate">{n.emissorNome ?? '—'}</p>
              <p className="text-[11px] text-rm-mid mt-1">
                NF {n.numeroNf ?? '—'}/{n.serieNf ?? '—'} ·{' '}
                {n.dataEmissao ? dtData.format(new Date(n.dataEmissao)) : 'sem data'}
                {n.qtdItens ? ` · ${n.qtdItens} itens` : ''}
                {n.valorTotal ? ` · R$ ${n.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''}
              </p>
              <p className="rm-mono text-[10px] text-rm-mid mt-1 break-all">{n.chaveAcesso}</p>
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              {n.schemaTipo === 'procNFe' ? (
                <Badge variant="green">XML completo</Badge>
              ) : (
                <Badge variant="gold">Só resumo</Badge>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void ignorar(n.id)}
                  className="text-[11px] uppercase tracking-[.16em] font-semibold text-rm-mid hover:text-rm-red"
                >
                  Ignorar
                </button>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={n.schemaTipo !== 'procNFe'}
                  onClick={() => router.push(`/recebimento/nfs-pendentes/${n.id}/preparar`)}
                >
                  Preparar →
                </Button>
              </div>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

async function ignorar(id: string): Promise<void> {
  if (!confirm('Marcar esta NF como ignorada? (ela some da lista mas fica no histórico)')) return;
  const r = await ignorarNf(id);
  if (!r.ok) alert(r.error);
}
