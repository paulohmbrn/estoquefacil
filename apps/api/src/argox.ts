// Endpoint Argox: WS pra agentes locais (1 por loja) + REST interno pra
// disparar impressão a partir do apps/web.
//
// Fluxo:
//   1. Agente da loja conecta em wss://api-estoque.reismagos.com.br/argox/agent
//      com header Authorization: Bearer <argoxBridgeToken>
//   2. Server identifica a loja via token e mantém ws no mapa lojaConnections.
//   3. apps/web faz POST /argox/print {lojaId, zpl} com X-Internal-Token.
//   4. Server encontra ws da loja, envia {type:'print', requestId, zpl}, espera
//      resposta {type:'print-result', requestId, ok, error?, bytes?} com timeout.

import type { FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';
import { randomBytes } from 'node:crypto';
import { prisma } from '@estoque/db';

interface AgentConnection {
  ws: WebSocket;
  lojaId: string;
  zmartbiId: string;
  connectedAt: Date;
}

// Mapa em memória: lojaId → conexão WS ativa.
// (1 réplica de api só. Se escalar, trocar por pub/sub no Redis.)
const lojaConnections = new Map<string, AgentConnection>();

// Promises pendentes de print: requestId → resolver
interface PendingPrint {
  resolve: (r: { ok: boolean; bytes?: number; error?: string }) => void;
  timer: NodeJS.Timeout;
}
const pendingPrints = new Map<string, PendingPrint>();

const INTERNAL_TOKEN = process.env.INTERNAL_API_TOKEN ?? '';
const PRINT_TIMEOUT_MS = 15_000;

export async function registerArgoxRoutes(app: FastifyInstance): Promise<void> {
  await app.register(websocket);

  // ============================================================
  // WS: agente conecta aqui
  // ============================================================
  app.get('/argox/agent', { websocket: true }, async (socket, req) => {
    const auth = req.headers.authorization ?? '';
    const fromHeader = auth.replace(/^Bearer\s+/i, '').trim();
    const fromQuery = (req.query as { token?: string })?.token ?? '';
    const token = (fromHeader || fromQuery).trim();
    if (!token) {
      socket.send(JSON.stringify({ type: 'error', error: 'sem token' }));
      socket.close(1008, 'sem token');
      return;
    }

    const loja = await prisma.loja.findUnique({
      where: { argoxBridgeToken: token },
      select: { id: true, zmartbiId: true, nome: true },
    });
    if (!loja) {
      socket.send(JSON.stringify({ type: 'error', error: 'token inválido' }));
      socket.close(1008, 'token inválido');
      return;
    }

    // Se já tinha conexão pra esta loja, fecha a antiga.
    const old = lojaConnections.get(loja.id);
    if (old) {
      try { old.ws.close(1000, 'substituído'); } catch { /* ignore */ }
    }

    lojaConnections.set(loja.id, {
      ws: socket as unknown as WebSocket,
      lojaId: loja.id,
      zmartbiId: loja.zmartbiId,
      connectedAt: new Date(),
    });
    app.log.info({ lojaId: loja.id, zmartbiId: loja.zmartbiId, nome: loja.nome }, '[argox] agente conectado');
    socket.send(JSON.stringify({ type: 'hello', lojaId: loja.id, zmartbiId: loja.zmartbiId }));

    socket.on('message', (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString()) as { type?: string; requestId?: string; ok?: boolean; bytes?: number; error?: string };
        if (msg.type === 'print-result' && msg.requestId) {
          const pending = pendingPrints.get(msg.requestId);
          if (pending) {
            clearTimeout(pending.timer);
            pendingPrints.delete(msg.requestId);
            pending.resolve({ ok: Boolean(msg.ok), bytes: msg.bytes, error: msg.error });
          }
        } else if (msg.type === 'pong') {
          // keepalive
        }
      } catch (err) {
        app.log.warn({ err: (err as Error).message }, '[argox] mensagem WS inválida');
      }
    });

    socket.on('close', () => {
      const cur = lojaConnections.get(loja.id);
      if (cur && cur.ws === (socket as unknown as WebSocket)) {
        lojaConnections.delete(loja.id);
        app.log.info({ lojaId: loja.id }, '[argox] agente desconectado');
      }
    });

    socket.on('error', (err: Error) => {
      app.log.warn({ lojaId: loja.id, err: err.message }, '[argox] erro no socket');
    });
  });

  // ============================================================
  // REST interno: status de conexão de uma loja
  // ============================================================
  app.get<{ Querystring: { lojaId?: string } }>('/argox/status', async (req, reply) => {
    if (!checkInternalToken(req.headers['x-internal-token'])) {
      return reply.code(401).send({ error: 'unauthorized' });
    }
    const lojaId = req.query.lojaId;
    if (!lojaId) return reply.code(400).send({ error: 'lojaId obrigatório' });
    const conn = lojaConnections.get(lojaId);
    return {
      connected: Boolean(conn),
      connectedAt: conn?.connectedAt?.toISOString() ?? null,
    };
  });

  // ============================================================
  // REST interno: dispara impressão
  // ============================================================
  app.post<{ Body: { lojaId: string; zpl: string } }>('/argox/print', async (req, reply) => {
    if (!checkInternalToken(req.headers['x-internal-token'])) {
      return reply.code(401).send({ error: 'unauthorized' });
    }
    const { lojaId, zpl } = req.body ?? ({} as { lojaId: string; zpl: string });
    if (!lojaId || !zpl) return reply.code(400).send({ error: 'lojaId e zpl obrigatórios' });
    if (!zpl.includes('^XA')) return reply.code(400).send({ error: 'ZPL inválido (precisa começar com ^XA)' });

    const conn = lojaConnections.get(lojaId);
    if (!conn) return reply.code(503).send({ error: 'agente da loja desconectado' });

    const requestId = randomBytes(8).toString('hex');
    const result = await new Promise<{ ok: boolean; bytes?: number; error?: string }>((resolve) => {
      const timer = setTimeout(() => {
        pendingPrints.delete(requestId);
        resolve({ ok: false, error: `timeout (${PRINT_TIMEOUT_MS}ms) — agente não respondeu` });
      }, PRINT_TIMEOUT_MS);
      pendingPrints.set(requestId, { resolve, timer });
      try {
        conn.ws.send(JSON.stringify({ type: 'print', requestId, zpl }));
      } catch (err) {
        clearTimeout(timer);
        pendingPrints.delete(requestId);
        resolve({ ok: false, error: `falha ao enviar pro agente: ${(err as Error).message}` });
      }
    });

    if (!result.ok) return reply.code(502).send({ error: result.error ?? 'erro desconhecido' });
    return { ok: true, bytes: result.bytes };
  });

  // Keepalive: a cada 30s envia ping pra todas conexões
  setInterval(() => {
    for (const conn of lojaConnections.values()) {
      try { conn.ws.send(JSON.stringify({ type: 'ping' })); } catch { /* ignore */ }
    }
  }, 30_000).unref();

  app.log.info('[argox] rotas registradas');
}

function checkInternalToken(headerVal: string | string[] | undefined): boolean {
  if (!INTERNAL_TOKEN) return false;
  const v = Array.isArray(headerVal) ? headerVal[0] : headerVal;
  return v === INTERNAL_TOKEN;
}
