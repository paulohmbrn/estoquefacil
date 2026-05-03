// /recebimento/nfs-pendentes — lista NFes baixadas via SEFAZ aguardando recebimento físico.

import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireLojaAtiva } from '@/lib/permissions';
import { PageHead } from '@/components/shell/page-head';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { NfsClient, type NfPendente, type FuncionarioOpt } from './nfs-client';
import { SefazSyncButton } from './sync-button';

const dt = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });

export default async function NfsPendentesPage() {
  const { lojaId } = await requireLojaAtiva();
  const [nfsRaw, funcionariosRaw, ultimoSync, loja] = await Promise.all([
    prisma.notaFiscalImportada.findMany({
      where: { lojaId, status: 'PENDENTE' },
      orderBy: { dataEmissao: 'desc' },
      take: 50,
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
            <Link href="/recebimento" className="hover:underline">Recebimento</Link> · NFs pendentes
          </>
        }
        title={
          <>
            NFes <em>aguardando</em> recebimento
          </>
        }
        sub="Notas baixadas automaticamente da SEFAZ pelo CNPJ desta loja. Clique em receber quando a mercadoria chegar."
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
          Sem NFes pendentes. {certOk ? 'Aguarde o próximo sync SEFAZ (8x ao dia, a cada 3h).' : ''}
        </Card>
      ) : (
        <NfsClient nfs={nfs} funcionarios={funcionarios} />
      )}
    </div>
  );
}
