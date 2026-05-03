// Home autenticada — placeholder do "home-b" (Editorial 'jornal') do design canvas.
// Sprint 2 substitui por dashboard real (validades, tarefas, sync ZmartBI status).

import Link from 'next/link';
import { FILIAIS_MVP } from '@estoque/shared';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getLojaAtivaId } from '@/app/_actions/loja-ativa';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { fmtDataExtenso } from '@/lib/datetime';
import { BootstrapPicker, type LojaBootstrap } from './_components/bootstrap-gestor';

export default async function HomePage() {
  const session = await auth();
  const userId = session!.user.id;

  const [vinculos, lojaAtivaId] = await Promise.all([
    prisma.usuarioLoja.findMany({
      where: { userId, ativo: true },
      include: { loja: { select: { id: true, nome: true, apelido: true, zmartbiId: true } } },
    }),
    getLojaAtivaId(),
  ]);

  const lojaAtiva =
    vinculos.find((v) => v.lojaId === lojaAtivaId)?.loja ?? vinculos[0]?.loja ?? null;

  const nomeCurto =
    (session!.user.name ?? session!.user.email ?? '').split(' ')[0] ?? 'Você';

  if (vinculos.length === 0) {
    // Sem vínculo ainda — mostra todas as lojas pra reclamar Gestor.
    // Múltiplos gestores por loja são permitidos.
    const todasLojas = await prisma.loja.findMany({
      where: { ativo: true, zmartbiId: { in: [...FILIAIS_MVP] } },
      orderBy: { zmartbiId: 'asc' },
      select: {
        id: true,
        zmartbiId: true,
        nome: true,
        apelido: true,
        usuarioLojas: {
          where: { ativo: true, papel: 'GESTOR' },
          select: { userId: true },
        },
      },
    });
    const lojas: LojaBootstrap[] = todasLojas.map((l) => ({
      id: l.id,
      zmartbiId: l.zmartbiId,
      nome: l.nome,
      apelido: l.apelido,
      gestoresExistentes: l.usuarioLojas.length,
      jaSouVinculado: l.usuarioLojas.some((u) => u.userId === userId),
    }));
    return <BootstrapPicker email={session!.user.email ?? ''} lojas={lojas} />;
  }

  // Lojas que o user ainda não gerencia (oportunidade pra reclamar — não tem
  // mais o conceito de "loja sem gestor", já que múltiplos são permitidos).
  const idsMinhasLojas = vinculos.map((v) => v.lojaId);
  const outrasLojas = await prisma.loja.findMany({
    where: {
      ativo: true,
      zmartbiId: { in: [...FILIAIS_MVP] },
      id: { notIn: idsMinhasLojas },
    },
    select: { id: true, apelido: true, nome: true },
    orderBy: { zmartbiId: 'asc' },
  });

  return (
    <div className="max-w-[1100px] mx-auto space-y-6 sm:space-y-10">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between border-b border-hairline pb-4 sm:pb-6 gap-3">
        <div>
          <p className="rm-eyebrow">Painel · Hoje</p>
          <h1 className="font-sans font-bold text-[36px] sm:text-h1 leading-[1.05] mt-2">
            Olá, <em>{nomeCurto}.</em>
          </h1>
          <p className="rm-caption text-rm-mid mt-2">
            {fmtDataExtenso.format(new Date()).replace(/^./, (c) => c.toUpperCase())}
          </p>
        </div>
        {lojaAtiva && (
          <div className="sm:text-right flex sm:flex-col items-center sm:items-end gap-2 sm:gap-1">
            <p className="rm-meta text-rm-mid">Loja:</p>
            <p className="rm-h4 sm:rm-h3">{lojaAtiva.apelido ?? lojaAtiva.nome}</p>
            <Badge variant="green">#{lojaAtiva.zmartbiId}</Badge>
          </div>
        )}
      </header>

      {outrasLojas.length > 0 && (
        <Card className="p-4 sm:p-5 border-l-4 border-rm-gold bg-[#fdf7e3]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            <div className="min-w-0">
              <p className="rm-eyebrow text-rm-gold">Outras lojas disponíveis</p>
              <p className="font-sans font-bold text-[20px] sm:text-h4 mt-1">
                Você gerencia outras {outrasLojas.length === 1 ? 'loja' : `${outrasLojas.length} lojas`}?
              </p>
              <p className="rm-caption text-rm-ink-2 mt-1">
                {outrasLojas.slice(0, 5).map((l) => l.apelido ?? l.nome).join(', ')}
                {outrasLojas.length > 5 ? ` e mais ${outrasLojas.length - 5}` : ''}.
                Múltiplos Gestores por loja são permitidos.
              </p>
            </div>
            <Link href="/onboarding/lojas" className="ef-btn ef-btn-primary sm:shrink-0">
              Gerenciar lojas →
            </Link>
          </div>
        </Card>
      )}

      <DashboardCards lojaId={lojaAtiva!.id} />
    </div>
  );
}

async function DashboardCards({ lojaId }: { lojaId: string }) {
  const hojeUtcMidnight = (() => {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric', month: '2-digit', day: '2-digit',
    });
    const [y, m, d] = fmt.format(new Date()).split('-').map(Number);
    return new Date(Date.UTC(y!, (m! - 1), d!));
  })();

  const em48h = new Date(Date.now() + 48 * 60 * 60 * 1000);
  const [
    contagensHoje, finalizadasHoje, ultimoSync, totalProdutos, ultimaExportada, validades48h,
  ] = await Promise.all([
    prisma.contagem.count({ where: { lojaId, dataContagem: hojeUtcMidnight } }),
    prisma.contagem.count({
      where: { lojaId, dataContagem: hojeUtcMidnight, status: { in: ['FINALIZADA', 'EXPORTADA'] } },
    }),
    prisma.syncRun.findFirst({ orderBy: { startedAt: 'desc' } }),
    prisma.produto.count({ where: { lojaId, ativo: true } }),
    prisma.contagem.findFirst({
      where: { lojaId, status: 'EXPORTADA' },
      orderBy: { exportadaEm: 'desc' },
      select: { exportadaEm: true },
    }),
    prisma.etiqueta.findMany({
      where: {
        lojaId,
        consumida: false,
        validadeAte: { not: null, lte: em48h, gte: new Date() },
      },
      orderBy: { validadeAte: 'asc' },
      take: 10,
      include: { produto: { select: { nome: true, cdarvprod: true } } },
    }),
  ]);

  const dt = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo',
  });
  const dtData = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short', timeZone: 'UTC',
  });
  const isoHoje = hojeUtcMidnight.toISOString().slice(0, 10);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
      <Card className="lg:col-span-2">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <CardTitle>Hoje · {dtData.format(hojeUtcMidnight)}</CardTitle>
          {finalizadasHoje > 0 && (
            <a
              href={`/api/export/dia?lojaId=${lojaId}&data=${isoHoje}`}
              className="ef-btn ef-btn-primary ef-btn-sm self-start sm:self-auto"
            >
              Exportar dia ({finalizadasHoje})
            </a>
          )}
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-2 sm:gap-4 text-center">
          <Stat label="Contagens" value={String(contagensHoje)} />
          <Stat label="Finalizadas" value={String(finalizadasHoje)} />
          <Stat
            label="Em andamento"
            value={String(contagensHoje - finalizadasHoje)}
            highlight={contagensHoje - finalizadasHoje > 0}
          />
          <div className="col-span-3 pt-3 border-t border-dashed border-hairline text-left">
            <p className="rm-eyebrow text-rm-mid">Atalhos</p>
            <div className="flex flex-wrap gap-2 mt-2">
              <Link href="/contagem" className="ef-btn ef-btn-ghost ef-btn-sm">Iniciar contagem</Link>
              <Link href="/etiquetas" className="ef-btn ef-btn-ghost ef-btn-sm">Imprimir etiquetas</Link>
              <Link href="/relatorios/contagens" className="ef-btn ef-btn-ghost ef-btn-sm">Histórico</Link>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Catálogo</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="rm-eyebrow text-rm-mid">Produtos ativos (loja)</p>
            <p className="rm-h2 mt-1">{totalProdutos.toLocaleString('pt-BR')}</p>
          </div>
          <div className="pt-3 border-t border-dashed border-hairline">
            <p className="rm-eyebrow text-rm-mid">Último sync ZmartBI</p>
            <p className="text-[13px] mt-1">
              {ultimoSync
                ? `${dt.format(ultimoSync.startedAt)} · ${ultimoSync.status}`
                : 'Nunca executado'}
            </p>
            <Link href="/sincronizacao" className="text-[11px] tracking-[.18em] uppercase font-semibold text-rm-green hover:underline mt-2 inline-block">
              Ver detalhes →
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Último export</CardTitle></CardHeader>
        <CardContent>
          <p className="rm-h4">
            {ultimaExportada?.exportadaEm
              ? dt.format(ultimaExportada.exportadaEm)
              : 'Nenhum export ainda'}
          </p>
          <p className="rm-caption text-rm-mid mt-2">
            Filename: <span className="rm-mono text-rm-ink">CONTAGEMFILIAL{'{LOJAID}{DDMMAAAA}'}.xlsx</span>
          </p>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Validades · próximas 48h</CardTitle>
        </CardHeader>
        <CardContent>
          {validades48h.length === 0 ? (
            <p className="text-rm-mid text-[13px]">
              Nada vencendo nas próximas 48h. Cadastre validades em metadados dos produtos para ativar este alerta.{' '}
              <Link href="/cadastros/produtos" className="rm-link">Cadastros → Produtos</Link>.
            </p>
          ) : (
            <ul className="divide-y divide-hairline -m-1">
              {validades48h.map((e) => {
                const horas = e.validadeAte
                  ? Math.max(0, Math.round((e.validadeAte.getTime() - Date.now()) / (60 * 60 * 1000)))
                  : 0;
                const cls =
                  horas <= 12
                    ? 'text-rm-red'
                    : horas <= 24
                    ? 'text-rm-gold'
                    : 'text-rm-mid';
                return (
                  <li key={e.id} className="flex items-center justify-between gap-3 px-1 py-2">
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium truncate">{e.produto.nome}</p>
                      <p className="rm-mono text-[10px] text-rm-mid">
                        {e.produto.cdarvprod} · {e.metodo}
                      </p>
                    </div>
                    <span className={`text-[11px] uppercase tracking-[.16em] font-semibold ${cls}`}>
                      {horas}h
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={
        (highlight
          ? 'bg-[rgba(184,144,46,.12)] border border-[rgba(184,144,46,.3)]'
          : 'bg-[#fafaf7] border border-hairline') +
        ' rounded-xs p-3 flex flex-col items-center justify-between text-center min-h-[96px] gap-2'
      }
    >
      <p className="text-[10px] font-semibold tracking-[.16em] uppercase text-rm-mid leading-tight">
        {label}
      </p>
      <p className="font-sans font-bold text-[28px] leading-none">{value}</p>
    </div>
  );
}

