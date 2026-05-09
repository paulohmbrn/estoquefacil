// GET /l/[token] — resolver de QR de Lista de Contagem ou Etiqueta.
//
// Implementado como Route Handler (não Page) porque precisa MUTAR o
// cookie de loja ativa antes do redirect — Next 15 só permite isso em
// Server Actions ou Route Handlers, não em Server Components.
//
// Fluxo:
//   - Sem login → redirect /login?callbackUrl=/l/<token>
//   - Token "e/<etiquetaId>" → redirect pra /l/etiqueta/<etiquetaId>
//   - Token de lista → seta cookie de loja ativa (se permitido) +
//     redirect pra /contagem/iniciar?listaId=<id>

import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COOKIE = 'estoque.loja_ativa';

/** Base pública pro redirect. req.url dentro do container resolve pra
 *  http://0.0.0.0:3000 (HOSTNAME do Next), o que quebra QR escaneado de
 *  fora. AUTH_URL é setado nos env vars com a URL pública. Fallback pro
 *  host header se AUTH_URL não estiver setado (dev local). */
function publicBase(req: NextRequest): string {
  const env = process.env.AUTH_URL;
  if (env) return env.replace(/\/$/, '');
  const proto = req.headers.get('x-forwarded-proto') ?? 'https';
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'localhost';
  return `${proto}://${host}`;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }): Promise<Response> {
  const { token } = await ctx.params;
  const base = publicBase(req);

  const session = await auth();
  if (!session?.user?.id) {
    const callback = encodeURIComponent(`/l/${token}`);
    return NextResponse.redirect(`${base}/login?callbackUrl=${callback}`);
  }

  // Caso A: token de etiqueta (formato e/<id>) — redireciona pra page de display
  if (token.startsWith('e/')) {
    const etiquetaId = token.slice(2);
    return NextResponse.redirect(`${base}/l/etiqueta/${etiquetaId}`);
  }

  // Caso B: qrToken de lista
  const lista = await prisma.listaContagem.findUnique({
    where: { qrToken: token },
    select: { id: true, lojaId: true, ativo: true },
  });
  if (!lista || !lista.ativo) {
    return NextResponse.redirect(`${base}/?listaNaoEncontrada=1`);
  }

  // Verifica se o user tem permissão pra trocar pra essa loja
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { superGestor: true },
  });
  let canSwitch = Boolean(me?.superGestor);
  if (!canSwitch) {
    const link = await prisma.usuarioLoja.findUnique({
      where: { userId_lojaId: { userId: session.user.id, lojaId: lista.lojaId } },
      select: { ativo: true },
    });
    canSwitch = Boolean(link?.ativo);
  }

  const response = NextResponse.redirect(`${base}/contagem/iniciar?listaId=${lista.id}`);

  // Só troca a loja ativa se o user tiver permissão real. Senão segue
  // com a loja atual e a tela de iniciar mostra erro de "lista de outra loja".
  if (canSwitch) {
    response.cookies.set(COOKIE, lista.lojaId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  return response;
}
