// /l/etiqueta/[id] — display de uma etiqueta de manipulação escaneada.
// Apenas mostra informações; o operador segue manualmente pra Contagem.

import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

export default async function EtiquetaDisplay({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/l/etiqueta/${id}`)}`);
  }

  const etiqueta = await prisma.etiqueta.findFirst({
    where: { OR: [{ serial: id }, { qrPayload: { contains: id } }] },
    include: {
      produto: { select: { nome: true } },
      loja: { select: { apelido: true, nome: true } },
      baixadaPor: { select: { name: true, email: true } },
    },
  });
  if (!etiqueta) notFound();

  const dtBR = (d: Date) =>
    new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
      timeZone: 'America/Sao_Paulo',
    }).format(d);
  const estadoLabel =
    etiqueta.estado === 'ATIVA'
      ? 'No estoque controlado'
      : etiqueta.estado === 'BAIXADA'
      ? 'Baixada (retirada)'
      : 'Cancelada';
  const controlada = etiqueta.cdarvprodEstoqueSnap !== null;

  return (
    <main className="ef-grain min-h-screen flex items-center justify-center p-6">
      <div className="bg-white border border-hairline rounded-xs p-8 max-w-[440px] w-full text-center shadow-card">
        <p className="rm-eyebrow">Etiqueta escaneada</p>
        <h1 className="rm-h3 mt-3">{etiqueta.produto.nome}</h1>
        <p className="rm-caption text-rm-mid mt-3">
          {etiqueta.loja.apelido ?? etiqueta.loja.nome} · método {etiqueta.metodo}
        </p>

        {controlada ? (
          <>
            <p
              className={
                etiqueta.estado === 'ATIVA'
                  ? 'rm-h4 mt-5 text-rm-green'
                  : 'rm-h4 mt-5 text-rm-red'
              }
            >
              {estadoLabel}
            </p>
            <div className="text-[13px] text-rm-mid mt-3 space-y-1">
              <p>Serial: <span className="font-mono">{etiqueta.serial}</span></p>
              <p>Impressa em {dtBR(etiqueta.impressaEm)}</p>
              {etiqueta.validadeAte && <p>Validade {dtBR(etiqueta.validadeAte)}</p>}
              {etiqueta.estado === 'BAIXADA' && (
                <>
                  {etiqueta.baixadaEm && <p>Baixada em {dtBR(etiqueta.baixadaEm)}</p>}
                  {etiqueta.setorSolicitante && <p>Setor: {etiqueta.setorSolicitante}</p>}
                  {etiqueta.baixadaPor && (
                    <p>Por: {etiqueta.baixadaPor.name ?? etiqueta.baixadaPor.email}</p>
                  )}
                </>
              )}
            </div>
            <Link
              href="/estoque-controlado"
              className="ef-btn ef-btn-primary mt-6 inline-flex"
            >
              Ir pro Estoque Controlado
            </Link>
          </>
        ) : (
          <>
            <p className="rm-body mt-6 max-w-[34ch] mx-auto">
              Pra contar este item, abra a contagem em andamento e bipe novamente, ou inicie uma nova contagem.
            </p>
            <Link href="/contagem" className="ef-btn ef-btn-primary mt-6 inline-flex">
              Ir pra Contagem
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
