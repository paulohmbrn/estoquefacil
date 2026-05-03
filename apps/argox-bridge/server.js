// Argox Bridge — agente local que recebe ZPL via HTTP e repassa pra impressora
// térmica via TCP raw 9100. Roda como serviço Windows (via NSSM) na rede da loja.
//
// Endpoints:
//   GET  /health           → { status, printer, version }
//   POST /print            → body: ZPL puro (text/plain) ou { zpl: "..." } (json)
//                          → repassa pra PRINTER_HOST:PRINTER_PORT
//
// Config via .env (mesmo diretório):
//   PRINTER_HOST=192.168.1.50    # IP da Argox na LAN
//   PRINTER_PORT=9100             # porta raw da impressora (default 9100)
//   LISTEN_PORT=9101              # porta HTTP do agente
//   ALLOWED_ORIGIN=https://estoque.reismagos.com.br  # CORS
//
// Uso standalone (sem instalar):
//   cd C:\argox-bridge
//   node server.js

'use strict';

const http = require('node:http');
const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');

// --- Carrega .env simples (sem dependência externa) ---
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
const VERSION = '0.1.0';

function log(...args) {
  console.log(`[${new Date().toISOString()}]`, ...args);
}

// --- Envio TCP pra impressora ---
function sendToPrinter(zpl) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: PRINTER_HOST, port: PRINTER_PORT });
    socket.setTimeout(10000);
    socket.on('connect', () => {
      socket.write(zpl, 'utf8', (err) => {
        if (err) { reject(err); return; }
        socket.end();
      });
    });
    socket.on('end', () => resolve({ bytes: Buffer.byteLength(zpl, 'utf8') }));
    socket.on('error', (err) => {
      reject(new Error(`TCP ${PRINTER_HOST}:${PRINTER_PORT} — ${err.message}`));
    });
    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error(`Timeout ao conectar em ${PRINTER_HOST}:${PRINTER_PORT}`));
    });
  });
}

// --- HTTP server ---
const server = http.createServer(async (req, res) => {
  // CORS preflight
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');

  if (req.method === 'OPTIONS') {
    res.writeHead(204).end();
    return;
  }

  try {
    if (req.url === '/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        printer: `${PRINTER_HOST}:${PRINTER_PORT}`,
        version: VERSION,
      }));
      return;
    }

    if (req.url === '/print' && req.method === 'POST') {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const raw = Buffer.concat(chunks).toString('utf8');
      let zpl = raw;
      const ct = (req.headers['content-type'] || '').toLowerCase();
      if (ct.includes('application/json')) {
        try {
          const parsed = JSON.parse(raw);
          zpl = parsed.zpl || '';
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'JSON inválido' }));
          return;
        }
      }
      if (!zpl || !zpl.includes('^XA')) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'ZPL ausente ou inválido (precisa começar com ^XA)' }));
        return;
      }
      log(`/print — ${Buffer.byteLength(zpl, 'utf8')} bytes`);
      const result = await sendToPrinter(zpl);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, bytes: result.bytes }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  } catch (err) {
    log('ERRO:', err.message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
});

server.listen(LISTEN_PORT, () => {
  log(`Argox Bridge v${VERSION} ouvindo em http://0.0.0.0:${LISTEN_PORT}`);
  log(`Impressora: TCP ${PRINTER_HOST}:${PRINTER_PORT}`);
  log(`CORS: ${ALLOWED_ORIGIN}`);
});

process.on('SIGINT', () => { log('SIGINT — encerrando'); server.close(() => process.exit(0)); });
process.on('SIGTERM', () => { log('SIGTERM — encerrando'); server.close(() => process.exit(0)); });
