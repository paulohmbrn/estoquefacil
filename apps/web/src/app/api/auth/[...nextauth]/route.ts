import { handlers } from '@/lib/auth';

export const { GET, POST } = handlers;

// next-auth v5 já gerencia session via Prisma adapter — Node runtime obrigatório.
export const runtime = 'nodejs';
