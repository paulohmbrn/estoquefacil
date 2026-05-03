import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { prisma } from '@estoque/db';
import { FILIAIS_MVP } from '@estoque/shared';
import { env } from './env.js';
import { registerArgoxRoutes } from './argox.js';

async function buildServer() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'development' ? 'debug' : 'info',
      transport:
        env.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } }
          : undefined,
    },
  });

  await app.register(cors, {
    origin: (origin, cb) => cb(null, true),
    credentials: true,
  });
  await app.register(sensible);
  await registerArgoxRoutes(app);

  app.get('/health', async () => ({
    status: 'ok',
    service: 'estoque-api',
    env: env.NODE_ENV,
    time: new Date().toISOString(),
  }));

  app.get('/health/db', async (_req, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      const lojas = await prisma.loja.count();
      return { status: 'ok', lojas };
    } catch (err) {
      app.log.error({ err }, 'falha em /health/db');
      return reply.code(503).send({ status: 'down', error: (err as Error).message });
    }
  });

  app.get('/me', async (_req, reply) => {
    return reply.code(501).send({ error: 'not_implemented', hint: 'Sprint 1: implementar lookup via session do next-auth' });
  });

  app.get('/lojas', async () => {
    const lojas = await prisma.loja.findMany({
      where: { ativo: true, zmartbiId: { in: [...FILIAIS_MVP] } },
      orderBy: { zmartbiId: 'asc' },
      select: { id: true, zmartbiId: true, nome: true, apelido: true },
    });
    return { lojas };
  });

  app.get('/sync/status', async () => {
    const [last, running, totalProdutos] = await Promise.all([
      prisma.syncRun.findFirst({ orderBy: { startedAt: 'desc' } }),
      prisma.syncRun.findFirst({ where: { status: 'RUNNING' } }),
      prisma.produto.count({ where: { ativo: true } }),
    ]);
    return {
      last: last && {
        id: last.id,
        status: last.status,
        startedAt: last.startedAt,
        finishedAt: last.finishedAt,
        durationMs: last.durationMs,
        itensProcessados: last.itensProcessados,
        produtosCriados: last.produtosCriados,
        produtosAtualizados: last.produtosAtualizados,
        produtosDesativados: last.produtosDesativados,
        errorMessage: last.errorMessage,
      },
      isRunning: Boolean(running),
      totalProdutosAtivos: totalProdutos,
    };
  });

  app.get('/produtos', async (req) => {
    const q = req.query as { lojaId?: string; q?: string; grupoId?: string; take?: string };
    const take = Math.min(Number(q.take ?? 50), 200);
    const lojaId = q.lojaId;
    const where = {
      ativo: true,
      ...(lojaId ? { lojaId } : {}),
      ...(q.grupoId ? { grupoId: q.grupoId } : {}),
      ...(q.q
        ? {
            OR: [
              { nome: { contains: q.q, mode: 'insensitive' as const } },
              { cdarvprod: { contains: q.q } },
              { cdProduto: { contains: q.q } },
            ],
          }
        : {}),
    };
    const produtos = await prisma.produto.findMany({
      where,
      take,
      orderBy: { nome: 'asc' },
      include: { grupo: { select: { nome: true } }, subgrupo: { select: { nome: true } } },
    });
    return { produtos, count: produtos.length };
  });

  app.addHook('onClose', async () => {
    await prisma.$disconnect();
  });

  return app;
}

const app = await buildServer();
app.listen({ port: env.API_PORT, host: '0.0.0.0' }, (err, address) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  app.log.info(`estoque-api listening on ${address}`);
});
