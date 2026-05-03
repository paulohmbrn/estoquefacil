// Painel de sincronização: status do último run, histórico, botão "sincronizar agora".

import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/permissions';
import { PageHead } from '@/components/shell/page-head';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SyncButton } from './sync-button';

const STATUS_BADGE: Record<
  string,
  { label: string; variant: 'green' | 'red' | 'gold' | 'ink' | 'neutral' }
> = {
  RUNNING:  { label: 'Em andamento', variant: 'gold' },
  SUCCESS:  { label: 'Concluído',    variant: 'green' },
  FAILED:   { label: 'Falhou',       variant: 'red' },
  ABORTED:  { label: 'Abortado',     variant: 'neutral' },
  LOCKED:   { label: 'Bloqueado',    variant: 'red' },
};

const dt = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'medium',
  timeZone: 'America/Sao_Paulo',
});

export default async function SincronizacaoPage() {
  const user = await requireUser();

  const [runs, isGestor, totalProdutos, running] = await Promise.all([
    prisma.syncRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: 20,
    }),
    prisma.usuarioLoja
      .count({ where: { userId: user.id, papel: 'GESTOR', ativo: true } })
      .then((n) => n > 0),
    prisma.produto.count({ where: { ativo: true } }),
    prisma.syncRun.findFirst({ where: { status: 'RUNNING' } }),
  ]);

  const last = runs[0] ?? null;

  return (
    <div className="max-w-[1100px] mx-auto">
      <PageHead
        eyebrow="Sistema · Sincronização"
        title={
          <>
            Sync com <em>ZmartBI</em>
          </>
        }
        sub="Catálogo é puxado diariamente às 06:15 (horário Brasília). O ZmartBI tem lock global por webtoken — só uma sincronização roda por vez."
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 mb-8">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Última sincronização</CardTitle>
            {last && (
              <Badge variant={STATUS_BADGE[last.status]?.variant ?? 'neutral'}>
                {STATUS_BADGE[last.status]?.label ?? last.status}
              </Badge>
            )}
          </CardHeader>
          <CardContent className="space-y-3 text-[13px]">
            {last ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Iniciado">{dt.format(last.startedAt)}</Field>
                  <Field label="Concluído">{last.finishedAt ? dt.format(last.finishedAt) : '—'}</Field>
                  <Field label="Duração">{last.durationMs ? `${(last.durationMs / 1000).toFixed(1)}s` : '—'}</Field>
                  <Field label="Disparado por">
                    {last.triggeredBy === 'cron' ? 'Cron 06:15' : 'Manual'}
                  </Field>
                </div>
                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-dashed border-hairline">
                  <Field label="Recebidos">{last.itensRecebidos.toLocaleString('pt-BR')}</Field>
                  <Field label="Processados">{last.itensProcessados.toLocaleString('pt-BR')}</Field>
                  <Field label="Ignorados">{last.itensIgnorados.toLocaleString('pt-BR')}</Field>
                  <Field label="Criados">{last.produtosCriados.toLocaleString('pt-BR')}</Field>
                  <Field label="Atualizados">{last.produtosAtualizados.toLocaleString('pt-BR')}</Field>
                  <Field label="Desativados">{last.produtosDesativados.toLocaleString('pt-BR')}</Field>
                </div>
                {last.errorMessage && (
                  <div className="mt-3 p-3 border border-rm-red text-rm-red text-[12px] rounded-xs">
                    {last.errorMessage}
                  </div>
                )}
              </>
            ) : (
              <p className="text-rm-mid">Nenhum sync executado ainda. Dispare o primeiro abaixo.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Catálogo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="rm-eyebrow text-rm-mid">Produtos ativos</p>
              <p className="rm-h2 mt-1">{totalProdutos.toLocaleString('pt-BR')}</p>
            </div>
            <div className="pt-4 border-t border-dashed border-hairline">
              <p className="rm-eyebrow text-rm-mid mb-2">Próxima execução</p>
              <p className="rm-mono text-[14px] text-rm-ink">06:15 · diário</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Disparar manualmente</CardTitle>
        </CardHeader>
        <CardContent>
          <SyncButton isGestor={isGestor} isRunning={Boolean(running)} />
          <p className="rm-caption text-rm-mid mt-3">
            Use quando precisar de dados frescos antes do agendamento. Lembre: o ZmartBI demora cerca de 30s
            para montar o dump completo (~141 MB) e durante esse tempo qualquer outra tentativa retorna lock.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico (últimas 20)</CardTitle>
        </CardHeader>
        <CardContent className="!p-0">
          {/* Mobile: lista compacta */}
          <ul className="sm:hidden divide-y divide-hairline">
            {runs.length === 0 && (
              <li className="p-6 text-center text-rm-mid text-[13px]">Sem histórico ainda.</li>
            )}
            {runs.map((r) => (
              <li key={r.id} className="p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[12px] font-medium rm-mono">{dt.format(r.startedAt)}</p>
                  <p className="text-[11px] text-rm-mid mt-1">
                    {r.itensProcessados.toLocaleString('pt-BR')} proc · {r.produtosCriados.toLocaleString('pt-BR')} criados · {r.triggeredBy === 'cron' ? 'Cron' : 'Manual'}
                  </p>
                </div>
                <Badge variant={STATUS_BADGE[r.status]?.variant ?? 'neutral'}>
                  {STATUS_BADGE[r.status]?.label ?? r.status}
                </Badge>
              </li>
            ))}
          </ul>
          {/* Desktop: tabela completa */}
          <table className="hidden sm:table w-full text-[12.5px]">
            <thead>
              <tr className="text-left border-b border-hairline bg-[#fafaf7]">
                <Th>Iniciado</Th>
                <Th>Status</Th>
                <Th>Duração</Th>
                <Th>Recebidos</Th>
                <Th>Processados</Th>
                <Th>Criados</Th>
                <Th>Desativ.</Th>
                <Th>Origem</Th>
              </tr>
            </thead>
            <tbody>
              {runs.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-rm-mid">Sem histórico ainda.</td></tr>
              )}
              {runs.map((r) => (
                <tr key={r.id} className="border-b border-hairline hover:bg-[rgba(0,65,37,.03)]">
                  <td className="px-4 py-2 rm-mono text-[11px]">{dt.format(r.startedAt)}</td>
                  <td className="px-4 py-2">
                    <Badge variant={STATUS_BADGE[r.status]?.variant ?? 'neutral'}>
                      {STATUS_BADGE[r.status]?.label ?? r.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 rm-mono text-[11px]">
                    {r.durationMs ? `${(r.durationMs / 1000).toFixed(1)}s` : '—'}
                  </td>
                  <td className="px-4 py-2">{r.itensRecebidos.toLocaleString('pt-BR')}</td>
                  <td className="px-4 py-2">{r.itensProcessados.toLocaleString('pt-BR')}</td>
                  <td className="px-4 py-2">{r.produtosCriados.toLocaleString('pt-BR')}</td>
                  <td className="px-4 py-2">{r.produtosDesativados.toLocaleString('pt-BR')}</td>
                  <td className="px-4 py-2 text-rm-mid text-[11px] uppercase tracking-[.14em]">
                    {r.triggeredBy === 'cron' ? 'Cron' : 'Manual'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="rm-eyebrow text-rm-mid">{label}</p>
      <p className="mt-[2px] text-rm-ink-2 font-medium">{children}</p>
    </div>
  );
}
function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 font-semibold text-rm-mid uppercase tracking-[.16em] text-[10px]">{children}</th>
  );
}
