// Resolver de QR de Lista — /l/[token]
// 1. Token de etiqueta (formato e/<id>): mostra produto isolado e direciona pra Contagem.
// 2. qrToken de lista: vai pra /contagem/iniciar?listaId=<id>.

import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

export default async function QrResolver({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const session = await auth();
  if (!session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/l/${token}`)}`);
  }

  // Caso A: token de etiqueta — começa com "e/"
  if (token.startsWith('e/')) {
    const etiquetaId = token.slice(2);
    const etiqueta = await prisma.etiqueta.findFirst({
      where: { qrPayload: { contains: etiquetaId } },
      include: { produto: { select: { nome: true } }, loja: { select: { apelido: true, nome: true } } },
    });
    if (!etiqueta) notFound();
    return (
      <main className="ef-grain min-h-screen flex items-center justify-center p-6">
        <div className="bg-white border border-hairline rounded-xs p-8 max-w-[440px] w-full text-center shadow-card">
          <p className="rm-eyebrow">Etiqueta escaneada</p>
          <h1 className="rm-h3 mt-3">{etiqueta.produto.nome}</h1>
          <p className="rm-caption text-rm-mid mt-3">
            {etiqueta.loja.apelido ?? etiqueta.loja.nome} · método {etiqueta.metodo}
          </p>
          <p className="rm-body mt-6 max-w-[34ch] mx-auto">
            Pra contar este item, abra a contagem em andamento e bipe novamente, ou inicie uma nova contagem.
          </p>
          <Link href="/contagem" className="ef-btn ef-btn-primary mt-6 inline-flex">
            Ir pra Contagem
          </Link>
        </div>
      </main>
    );
  }

  // Caso B: qrToken de lista
  const lista = await prisma.listaContagem.findUnique({
    where: { qrToken: token },
    select: { id: true, lojaId: true, ativo: true },
  });
  if (!lista || !lista.ativo) notFound();
  redirect(`/contagem/iniciar?listaId=${lista.id}`);
}
