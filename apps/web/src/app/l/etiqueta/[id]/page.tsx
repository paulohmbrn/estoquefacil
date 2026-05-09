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
    where: { qrPayload: { contains: id } },
    include: {
      produto: { select: { nome: true } },
      loja: { select: { apelido: true, nome: true } },
    },
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
