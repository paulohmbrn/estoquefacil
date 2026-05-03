# Argox Bridge

Pequeno agente HTTP que fica rodando no PC da loja, recebe ZPL via REST e
repassa pra impressora térmica Argox via TCP raw 9100.

Necessário porque o app web (`https://estoque.reismagos.com.br`) está numa
cloud que não consegue alcançar IPs privados da loja (`192.168.x.x`). Esse
agente é o "túnel" local: o navegador na rede da loja fala com ele em HTTP
local, ele fala com a impressora.

## Pré-requisitos

- **Node.js LTS 20+** instalado (Windows Server, 10 ou 11). Baixe em https://nodejs.org
- **Argox em modo PPLZ ou AUTO** (configure pelo Argox QLabel).
- **Mesma rede** entre PC do agente e impressora.
- (Opcional, pra rodar como serviço Windows): **NSSM** — baixe `nssm-2.24.zip` em https://nssm.cc/download e coloque o `nssm.exe` (32 ou 64 bit) na pasta deste agente.

## Instalação rápida (Windows)

```
1. Baixe esta pasta inteira pra C:\argox-bridge
2. Edite o .env com o IP da sua impressora:
     PRINTER_HOST=192.168.1.50
     PRINTER_PORT=9100
3. (opcional) baixe nssm.exe e cole na pasta
4. Click direito > Executar como administrador: install-windows.bat
```

Pronto — o serviço sobe junto com o boot.

## Teste rápido (sem instalar como serviço)

```cmd
cd C:\argox-bridge
copy .env.example .env
notepad .env       :: edite PRINTER_HOST
node server.js
```

Em outra janela:
```cmd
curl http://localhost:9101/health
```

Deve responder algo como:
```json
{"status":"ok","printer":"192.168.1.50:9100","version":"0.1.0"}
```

## Como o app usa

1. No painel: **Cadastros → Lojas → [sua loja] → Impressora Argox**
2. Cadastre a URL do agente (ex.: `http://localhost:9101` se rodar no mesmo PC, ou `http://192.168.x.x:9101` de outro PC da LAN)
3. Click **Testar conexão** — deve mostrar `Agente OK · impressora ...`
4. Em **Etiquetas**, escolha o formato **"Argox 100×60mm — Imprimir agora"** (só aparece se a URL estiver cadastrada)

## Endpoints

- `GET /health` → status do agente + IP da impressora configurado
- `POST /print` → corpo: ZPL (text/plain) ou `{"zpl":"..."}` (json)
  - Resposta: `{"ok":true,"bytes":N}` ou `{"error":"..."}`
- CORS: aceita só `https://estoque.reismagos.com.br` por padrão (configurável via `ALLOWED_ORIGIN`)

## Troubleshooting

**"Failed to fetch" no app**
- Browser está bloqueando mixed content (HTTPS → HTTP). Soluções:
  - Abra o app no MESMO PC do agente e use `http://localhost:9101`
  - OU use Chrome → flag site permissions → permitir HTTP inseguro pra esse host
  - OU configure HTTPS no agente (gerar cert auto-assinado e apontar `LISTEN_HTTPS=true`) — em breve

**Agente loga `Timeout ao conectar em 192.168.x.x:9100`**
- A impressora não está acessível ou em outro IP
- Confira: `ping 192.168.x.x` e depois `telnet 192.168.x.x 9100`

**Impressora imprime caracteres aleatórios**
- A Argox NÃO está em modo PPLZ. Abra o **Argox QLabel → Configure → Printer Setting → Language Mode → AUTO ou PPLZ → Apply** e reinicie a impressora.

## Logs

- Modo serviço: `bridge.log` na pasta de instalação (rotação a 1MB)
- Modo standalone: stdout
