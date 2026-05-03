// Edge middleware — usa apenas authConfig (sem Prisma adapter).
import NextAuth from 'next-auth';
import { authConfig } from './auth.config';

export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: [
    // Protege tudo exceto: api/auth, assets estáticos, PWA (manifest/sw/icons).
    // /api/cert/upload está coberto pelo padrão abaixo (exige sessão válida).
    '/((?!api/auth|_next/static|_next/image|favicon\\.svg|manifest\\.webmanifest|sw\\.js|icon\\.svg|icon-maskable\\.svg|apple-touch-icon\\.(?:svg|png)|fonts/.*|.*\\.png$).*)',
  ],
};
