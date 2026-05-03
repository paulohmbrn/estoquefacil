// Config edge-safe (sem Prisma adapter) — usado pelo middleware no Edge Runtime.
// O config completo com adapter fica em src/lib/auth.ts.

import type { NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';

const ALLOWED_DOMAIN = (process.env.ALLOWED_EMAIL_DOMAIN || 'reismagos.com.br').toLowerCase();

export const authConfig = {
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          prompt: 'select_account',
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      // Whitelist de domínio. Aplica para Google e qualquer provider futuro.
      const email = (user.email || profile?.email || '').toLowerCase();
      if (!email) return false;
      if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
        return `/login?error=DomainNotAllowed&email=${encodeURIComponent(email)}`;
      }
      // Validação extra: Google devolve email_verified — exigir true.
      if (account?.provider === 'google' && profile && profile.email_verified === false) {
        return `/login?error=EmailNotVerified`;
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token?.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
    authorized({ auth, request }) {
      const isLoggedIn = Boolean(auth?.user);
      const { pathname } = request.nextUrl;
      const isPublic =
        pathname.startsWith('/login') ||
        pathname.startsWith('/api/auth') ||
        pathname.startsWith('/_next') ||
        pathname === '/favicon.svg' ||
        pathname.startsWith('/fonts');
      if (isPublic) return true;
      return isLoggedIn;
    },
  },
  session: { strategy: 'jwt' },
  trustHost: true,
} satisfies NextAuthConfig;
