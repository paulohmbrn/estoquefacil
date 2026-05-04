// Argox Bridge — agente local que recebe ZPL e repassa pra impressora térmica.
// Roda como serviço Windows na rede da loja. Suporta ZEBRA (nativo) e ARGOX em
// modo PPLZ (emulação ZPL). Funciona com qualquer impressora que entenda ZPL.
//
// 2 modos de SAÍDA pra impressora (PRINTER_MODE):
//   - tcp (default): socket raw TCP:9100 — pra impressora com IP na rede.
//   - usb           : escreve ZPL num arquivo temp e manda via spooler do
//                     Windows pra fila local compartilhada (`copy /b` em
//                     `\\localhost\<share>`). Requer driver "Generic / Text
//                     Only" instalado e a fila compartilhada como SMB.
//                     Use isso quando a impressora estiver plugada via USB.
//
// 2 modos de RECEBER jobs:
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
//   PRINTER_MODE=tcp                 # ou: usb
//   # Quando PRINTER_MODE=tcp:
//   PRINTER_HOST=192.168.1.50
//   PRINTER_PORT=9100
//   # Quando PRINTER_MODE=usb (Windows):
//   PRINTER_NAME=ZEBRA               # share name SMB da fila local
//
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
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

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

const PRINTER_MODE = (process.env.PRINTER_MODE || 'tcp').toLowerCase();
const PRINTER_HOST = process.env.PRINTER_HOST || '127.0.0.1';
const PRINTER_PORT = Number(process.env.PRINTER_PORT || 9100);
const PRINTER_NAME = process.env.PRINTER_NAME || '';
const LISTEN_PORT = Number(process.env.LISTEN_PORT || 9101);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://estoque.reismagos.com.br';
const BRIDGE_TOKEN = process.env.BRIDGE_TOKEN || '';
const SERVER_WS_URL = process.env.SERVER_WS_URL || '';
const VERSION = '0.3.0';

if (PRINTER_MODE !== 'tcp' && PRINTER_MODE !== 'usb') {
  console.error(`[fatal] PRINTER_MODE inválido: "${PRINTER_MODE}". Use "tcp" ou "usb".`);
  process.exit(1);
}
if (PRINTER_MODE === 'usb' && !PRINTER_NAME) {
  console.error('[fatal] PRINTER_MODE=usb exige PRINTER_NAME (share name SMB da fila local).');
  process.exit(1);
}
if (PRINTER_MODE === 'usb' && process.platform !== 'win32') {
  console.error('[fatal] PRINTER_MODE=usb só funciona no Windows.');
  process.exit(1);
}

function log(...args) {
  console.log(`[${new Date().toISOString()}]`, ...args);
}

// --- Envio TCP raw pra impressora (porta 9100) ---
function sendToPrinterTcp(zpl) {
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

// --- Envio via fila de impressão Windows (USB) ---
// Estratégia: escreve ZPL em arquivo temp e usa `cmd /c copy /b` pra mandar
// raw pra fila local compartilhada via UNC `\\localhost\<share>`. Funciona
// com driver "Generic / Text Only" (que NÃO renderiza, repassa raw).
function sendToPrinterWindowsQueue(zpl) {
  return new Promise((resolve, reject) => {
    const bytes = Buffer.byteLength(zpl, 'utf8');
    const tmpFile = path.join(os.tmpdir(), `zpl-${Date.now()}-${process.pid}.zpl`);
    try { fs.writeFileSync(tmpFile, Buffer.from(zpl, 'utf8')); }
    catch (err) { return reject(new Error(`Falha ao escrever temp: ${err.message}`)); }
    const cleanup = () => { try { fs.unlinkSync(tmpFile); } catch { /* ignore */ } };
    // `\\localhost\<share>` vira `\\\\localhost\\<share>` na string JS.
    const target = `\\\\localhost\\${PRINTER_NAME}`;
    const child = spawn('cmd.exe', ['/c', 'copy', '/b', tmpFile, target], { windowsHide: true });
    let stderr = '';
    let stdout = '';
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    const timer = setTimeout(() => {
      try { child.kill(); } catch { /* ignore */ }
      cleanup();
      reject(new Error(`Timeout (10s) ao enviar pra fila "${PRINTER_NAME}"`));
    }, 10_000);
    child.on('error', (err) => { clearTimeout(timer); cleanup(); reject(new Error(`spawn cmd: ${err.message}`)); });
    child.on('close', (code) => {
      clearTimeout(timer);
      cleanup();
      if (code === 0) return resolve({ bytes });
      const tail = (stderr || stdout).trim().split(/\r?\n/).slice(-3).join(' | ');
      reject(new Error(`copy exit ${code} (fila "${PRINTER_NAME}"): ${tail || 'sem detalhes'}`));
    });
  });
}

function sendToPrinter(zpl) {
  return PRINTER_MODE === 'usb' ? sendToPrinterWindowsQueue(zpl) : sendToPrinterTcp(zpl);
}

function printerLabel() {
  return PRINTER_MODE === 'usb' ? `USB \\\\localhost\\${PRINTER_NAME}` : `TCP ${PRINTER_HOST}:${PRINTER_PORT}`;
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
        mode: PRINTER_MODE,
        printer: printerLabel(),
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
  log(`Impressora: [${PRINTER_MODE.toUpperCase()}] ${printerLabel()}`);
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
