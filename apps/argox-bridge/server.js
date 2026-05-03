// Argox Bridge — agente local que recebe ZPL e repassa pra impressora
// térmica via TCP raw 9100. Roda como serviço Windows na rede da loja.
//
// 2 modos de receber jobs:
//   1. HTTP local (POST /print) — caso o app esteja sendo usado no mesmo
//      PC do agente, ou outro PC da LAN aceitando mixed content.
//   2. WebSocket persistente com o servidor cloud — caso o app esteja sendo
//      usado de qualquer dispositivo (mobile, tablet) sem precisar enxergar
//      o agente diretamente. Esta é a recomendada pra produção.
//
// Endpoints HTTP locais:
//   GET  /health           → { status, printer, version, ws }
//   POST /test-print       → ZPL "TESTE OK" pra diagnóstico
//   POST /print            → body: ZPL puro ou { zpl: "..." } → impressora
//
// Config via .env (mesmo diretório):
//   PRINTER_HOST=192.168.1.50
//   PRINTER_PORT=9100
//   LISTEN_PORT=9101
//   ALLOWED_ORIGIN=https://estoque.reismagos.com.br
//
//   # WebSocket persistente (opcional mas recomendado pra mobile):
//   BRIDGE_TOKEN=...64-char-hex...     # gerado no painel Cadastros → Lojas
//   SERVER_WS_URL=wss://estoque.reismagos.com.br/argox/agent

'use strict';

const http = require('node:http');
const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');

// --- Carrega .env simples ---
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const k = trimmed.slice(0, eq).trim();
    const v = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[k]) process.env[k] = v;
  }
}
loadEnv();

const PRINTER_HOST = process.env.PRINTER_HOST || '127.0.0.1';
const PRINTER_PORT = Number(process.env.PRINTER_PORT || 9100);
const LISTEN_PORT = Number(process.env.LISTEN_PORT || 9101);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://estoque.reismagos.com.br';
const BRIDGE_TOKEN = process.env.BRIDGE_TOKEN || '';
const SERVER_WS_URL = process.env.SERVER_WS_URL || '';
const VERSION = '0.2.0';

function log(...args) {
  console.log(`[${new Date().toISOString()}]`, ...args);
}

// --- Envio TCP pra impressora ---
function sendToPrinter(zpl) {
  return new Promise((resolve, reject) => {
    const bytes = Buffer.byteLength(zpl, 'utf8');
    const socket = net.createConnection({ host: PRINTER_HOST, port: PRINTER_PORT });
    socket.setTimeout(5000);
    let resolved = false;
    const done = (err) => {
      if (resolved) return;
      resolved = true;
      try { socket.destroy(); } catch { /* ignore */ }
      if (err) reject(err); else resolve({ bytes });
    };
    socket.on('connect', () => {
      socket.write(zpl, 'utf8', (err) => {
        if (err) return done(err);
        socket.end(() => done(null));
      });
    });
    socket.on('close', () => done(null));
    socket.on('error', (err) => done(new Error(`TCP ${PRINTER_HOST}:${PRINTER_PORT} — ${err.message}`)));
    socket.on('timeout', () => done(new Error(`Timeout (5s) em ${PRINTER_HOST}:${PRINTER_PORT}`)));
  });
}

// =====================================================================
// HTTP server local — modo "PC mesmo da impressora", legado
// =====================================================================
const httpServer = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');

  if (req.method === 'OPTIONS') { res.writeHead(204).end(); return; }

  try {
    if (req.url === '/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        printer: `${PRINTER_HOST}:${PRINTER_PORT}`,
        version: VERSION,
        ws: { configured: Boolean(SERVER_WS_URL && BRIDGE_TOKEN), connected: wsConnected, lastError: wsLastError },
      }));
      return;
    }

    if (req.url === '/test-print' && (req.method === 'POST' || req.method === 'GET')) {
      const zplTeste = [
        '^XA', '^CI28', '^PW480', '^LL320', '^LH0,0',
        '^FO40,40^A0N,80,80^FDTESTE OK^FS',
        '^FO40,140^A0N,40,40^FDArgox Bridge^FS',
        '^FO40,200^A0N,30,30^FD' + new Date().toISOString().slice(0, 19) + '^FS',
        '^XZ',
      ].join('\n');
      log(`/test-print — ${Buffer.byteLength(zplTeste, 'utf8')} bytes`);
      const r = await sendToPrinter(zplTeste);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, bytes: r.bytes, message: 'Se nada saiu, impressora não está em PPLZ/AUTO' }));
      return;
    }

    if (req.url === '/print' && req.method === 'POST') {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const raw = Buffer.concat(chunks).toString('utf8');
      let zpl = raw;
      const ct = (req.headers['content-type'] || '').toLowerCase();
      if (ct.includes('application/json')) {
        try { zpl = JSON.parse(raw).zpl || ''; }
        catch { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'JSON inválido' })); return; }
      }
      if (!zpl || !zpl.includes('^XA')) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'ZPL inválido' }));
        return;
      }
      log(`/print (HTTP) — ${Buffer.byteLength(zpl, 'utf8')} bytes`);
      const result = await sendToPrinter(zpl);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, bytes: result.bytes }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  } catch (err) {
    log('HTTP ERRO:', err.message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
});

httpServer.listen(LISTEN_PORT, () => {
  log(`Argox Bridge v${VERSION}`);
  log(`HTTP local: http://0.0.0.0:${LISTEN_PORT}`);
  log(`Impressora: TCP ${PRINTER_HOST}:${PRINTER_PORT}`);
});

// =====================================================================
// WebSocket persistente com o server cloud — modo "qualquer dispositivo"
// =====================================================================
let ws = null;
let wsConnected = false;
let wsLastError = null;
let wsReconnectTimer = null;
let wsReconnectDelay = 1000; // backoff exponencial: 1s → 2s → 4s ... → max 30s
const WS_RECONNECT_MAX = 30_000;

function connectWs() {
  if (!SERVER_WS_URL || !BRIDGE_TOKEN) {
    log('WebSocket: BRIDGE_TOKEN ou SERVER_WS_URL não configurado — modo HTTP local apenas');
    return;
  }
  if (typeof WebSocket === 'undefined') {
    log('WebSocket: requer Node.js 22+ (não disponível neste runtime)');
    return;
  }
  const url = `${SERVER_WS_URL}?token=${encodeURIComponent(BRIDGE_TOKEN)}`;
  log(`WS: conectando em ${SERVER_WS_URL}…`);
  ws = new WebSocket(url);

  ws.addEventListener('open', () => {
    wsConnected = true;
    wsLastError = null;
    wsReconnectDelay = 1000;
    log('WS: conectado ao server');
  });

  ws.addEventListener('message', async (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'hello') {
        log(`WS: identificado pelo server — lojaId=${msg.lojaId}, zmartbiId=${msg.zmartbiId}`);
        return;
      }
      if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
        return;
      }
      if (msg.type === 'print' && msg.requestId && msg.zpl) {
        log(`WS: /print job ${msg.requestId} — ${Buffer.byteLength(msg.zpl, 'utf8')} bytes`);
        try {
          const r = await sendToPrinter(msg.zpl);
          ws.send(JSON.stringify({ type: 'print-result', requestId: msg.requestId, ok: true, bytes: r.bytes }));
        } catch (err) {
          log(`WS: print falhou — ${err.message}`);
          ws.send(JSON.stringify({ type: 'print-result', requestId: msg.requestId, ok: false, error: err.message }));
        }
        return;
      }
      if (msg.type === 'error') {
        log(`WS: server retornou erro — ${msg.error}`);
        wsLastError = msg.error;
      }
    } catch (err) {
      log(`WS: mensagem inválida — ${err.message}`);
    }
  });

  ws.addEventListener('close', (event) => {
    wsConnected = false;
    log(`WS: desconectado (code=${event.code} reason="${event.reason}") — reconectando em ${wsReconnectDelay}ms`);
    scheduleReconnect();
  });

  ws.addEventListener('error', (event) => {
    wsLastError = event?.message ?? 'erro de WS';
    log(`WS: erro — ${wsLastError}`);
  });
}

function scheduleReconnect() {
  if (wsReconnectTimer) clearTimeout(wsReconnectTimer);
  wsReconnectTimer = setTimeout(() => {
    wsReconnectTimer = null;
    connectWs();
  }, wsReconnectDelay);
  wsReconnectDelay = Math.min(wsReconnectDelay * 2, WS_RECONNECT_MAX);
}

connectWs();

// =====================================================================
// Shutdown
// =====================================================================
const shutdown = (sig) => {
  log(`${sig} — encerrando`);
  if (wsReconnectTimer) clearTimeout(wsReconnectTimer);
  try { ws?.close(); } catch { /* ignore */ }
  httpServer.close(() => process.exit(0));
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
