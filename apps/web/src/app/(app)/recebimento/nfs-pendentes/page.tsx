// /recebimento/nfs-sefaz — NFes SEFAZ que perderam a janela de 48h mas ainda
// estão dentro de 30 dias. Pra recebimento "atrasado" / consulta histórica.
// (rota antiga `/nfs-pendentes` mantida por compat com bookmarks/PWA cache)

import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireLojaAtiva } from '@/lib/permissions';
import { PageHead } from '@/components/shell/page-head';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { NfsClient, type NfPendente, type FuncionarioOpt } from './nfs-client';
import { SefazSyncButton } from './sync-button';

const dt = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });

// Janelas:
// - até 48h → aparece na home /recebimento (Receber Mercadoria)
// - 48h a 30d → aparece aqui (NFs SEFAZ — atrasadas)
// - >30d → oculta em ambas (provavelmente já recebida fora do sistema)
const WINDOW_RECEBER_MERCADORIA_HORAS = 48;
const WINDOW_HISTORICO_DIAS = 30;

export default async function NfsPendentesPage() {
  const { lojaId } = await requireLojaAtiva();
  const agora = new Date();
  const limite48h = new Date(agora.getTime() - WINDOW_RECEBER_MERCADORIA_HORAS * 60 * 60 * 1000);
  const limite30d = new Date(agora.getTime() - WINDOW_HISTORICO_DIAS * 24 * 60 * 60 * 1000);

  const [nfsRaw, funcionariosRaw, ultimoSync, loja] = await Promise.all([
    prisma.notaFiscalImportada.findMany({
      where: {
        lojaId,
        status: 'PENDENTE',
        dataEmissao: { gte: limite30d, lt: limite48h },
      },
      orderBy: { dataEmissao: 'desc' },
      take: 100,
    }),
    prisma.funcionario.findMany({
      where: { lojaId, ativo: true },
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true },
    }),
    prisma.sefazSync.findFirst({
      where: { lojaId },
      orderBy: { startedAt: 'desc' },
    }),
    prisma.loja.findUnique({
      where: { id: lojaId },
      select: { certificadoPath: true, certificadoValidoAte: true, cnpj: true },
    }),
  ]);

  const nfs: NfPendente[] = nfsRaw.map((n) => ({
    id: n.id,
    chaveAcesso: n.chaveAcesso,
    numeroNf: n.numeroNf,
    serieNf: n.serieNf,
    emissorNome: n.emissorNome,
    emissorCnpj: n.emissorCnpj,
    dataEmissao: n.dataEmissao?.toISOString() ?? null,
    valorTotal: n.valorTotal ? Number(n.valorTotal) : null,
    qtdItens: n.qtdItens,
    schemaTipo: n.schemaTipo,
  }));
  const funcionarios: FuncionarioOpt[] = funcionariosRaw;
  const certOk = Boolean(loja?.certificadoPath && loja?.cnpj);

  return (
    <div className="max-w-[1100px] mx-auto">
      <PageHead
        eyebrow={
          <>
            <Link href="/recebimento" className="hover:underline">Recebimento</Link> · NFs SEFAZ
          </>
        }
        title={
          <>
            NFes <em>SEFAZ</em>
          </>
        }
        sub={`Notas com mais de ${WINDOW_RECEBER_MERCADORIA_HORAS}h de emissão e até ${WINDOW_HISTORICO_DIAS} dias. As recentes (≤48h) ficam na tela Receber Mercadoria; mais antigas que ${WINDOW_HISTORICO_DIAS} dias são ocultadas.`}
      />

      {!certOk && (
        <Card className="p-4 mb-4 border-l-4 border-rm-gold bg-[#fdf7e3]">
          <p className="rm-eyebrow text-rm-gold">Configuração pendente</p>
          <p className="text-[13px] text-rm-ink-2 mt-1">
            Esta loja não tem CNPJ + certificado A1 configurado. Vá em{' '}
            <Link href="/cadastros/lojas" className="rm-link">Cadastros → Lojas (fiscal)</Link> e configure pra começar a receber NFes da SEFAZ.
          </p>
        </Card>
      )}

      {funcionarios.length === 0 && (
        <Card className="p-4 mb-4 border-l-4 border-rm-gold bg-[#fdf7e3]">
          <p className="rm-eyebrow text-rm-gold">Sem funcionários cadastrados</p>
          <p className="text-[13px] text-rm-ink-2 mt-1">
            Pra confirmar um Recebimento você precisa indicar quem recebeu fisicamente.
            Cadastre ao menos um funcionário em{' '}
            <Link href="/cadastros/funcionarios" className="rm-link">Cadastros → Funcionários</Link>.
          </p>
        </Card>
      )}

      <Card className="p-4 mb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="text-[12px] text-rm-mid">
          <span className="rm-eyebrow text-rm-mid">Último sync SEFAZ:</span>{' '}
          {ultimoSync ? (
            <>
              {dt.format(ultimoSync.startedAt)} ·{' '}
              <Badge variant={ultimoSync.status === 'SUCCESS' ? 'green' : ultimoSync.status === 'FAILED' ? 'red' : 'gold'}>
                {ultimoSync.status}
              </Badge>
              {ultimoSync.totalNfes > 0 && ` · ${ultimoSync.totalNfes} novas`}
            </>
          ) : (
            'nunca'
          )}
        </div>
        {certOk && <SefazSyncButton />}
      </Card>

      {nfs.length === 0 ? (
        <Card className="p-10 text-center text-rm-mid text-[13px]">
          Sem NFes nesta janela ({WINDOW_RECEBER_MERCADORIA_HORAS}h–{WINDOW_HISTORICO_DIAS}d).{' '}
          <Link href="/recebimento" className="rm-link">Veja as recentes em Receber Mercadoria</Link>.
        </Card>
      ) : (
        <NfsClient nfs={nfs} funcionarios={funcionarios} />
      )}
    </div>
  );
}
