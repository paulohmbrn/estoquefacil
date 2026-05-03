import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __estoquePrisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  globalThis.__estoquePrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__estoquePrisma = prisma;
}

export * from '@prisma/client';
export { Prisma } from '@prisma/client';
