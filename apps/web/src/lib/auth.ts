// Auth.js completo com Prisma adapter — usado em Server Components / route handlers.
// O middleware (Edge) usa src/auth.config.ts diretamente.

import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@estoque/db';
import { authConfig } from '../auth.config';

export const {
  handlers,
  auth,
  signIn,
  signOut,
} = NextAuth({
  adapter: PrismaAdapter(prisma),
  ...authConfig,
});

// Helper para Server Components / route handlers que precisam da session com user.id.
export type AuthSession = NonNullable<Awaited<ReturnType<typeof auth>>>;

// Tipos customizados — extende o User da session com id.
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}
