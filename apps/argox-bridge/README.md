# Argox Bridge

Pequeno agente HTTP que fica rodando no PC da loja, recebe ZPL via REST e
repassa pra impressora térmica que entenda ZPL (Zebra nativo ou Argox em PPLZ).

Necessário porque o app web (`https://estoque.reismagos.com.br`) está numa
cloud que não consegue alcançar IPs privados da loja (`192.168.x.x`). Esse
agente é o "túnel" local: o navegador na rede da loja fala com ele em HTTP
local (ou via WebSocket persistente cloud→agente), ele fala com a impressora.

## Modos de saída (PRINTER_MODE)

| Modo  | Uso                                       | Configuração obrigatória         |
| ----- | ----------------------------------------- | -------------------------------- |
| `tcp` | Impressora com IP de rede (Ethernet/WiFi) | `PRINTER_HOST`, `PRINTER_PORT`   |
| `usb` | Impressora plugada via USB no PC do agente (somente Windows) | `PRINTER_NAME` (share SMB) |

## Pré-requisitos

- **Node.js LTS 20+** instalado (Windows Server, 10 ou 11). Baixe em https://nodejs.org
- **Impressora em modo ZPL** (Zebra é nativo; Argox precisa de PPLZ ou AUTO via QLabel).
- Para `PRINTER_MODE=tcp`: **mesma rede** entre PC do agente e impressora.
- Para `PRINTER_MODE=usb`: driver **"Generic / Text Only"** instalado e fila compartilhada (ver abaixo).
- (Opcional, pra rodar como serviço Windows): **NSSM** — baixe `nssm-2.24.zip` em https://nssm.cc/download e coloque o `nssm.exe` (32 ou 64 bit) na pasta deste agente.

## Instalação rápida — Modo TCP (impressora de rede)

```
1. Baixe esta pasta inteira pra C:\argox-bridge
2. Edite o .env:
     PRINTER_MODE=tcp
     PRINTER_HOST=192.168.1.50
     PRINTER_PORT=9100
3. (opcional) baixe nssm.exe e cole na pasta
4. Click direito > Executar como administrador: install-windows.bat
```

## Instalação rápida — Modo USB (impressora local Zebra/Argox)

```
1. Plugue a impressora via USB e ligue.
2. NÃO instale o driver oficial (ZDesigner) — ele renderiza e quebra ZPL.
   Em vez disso:
   a) Painel de Controle → Dispositivos e Impressoras → Adicionar impressora
   b) Escolha "A impressora que quero não está na lista"
   c) "Adicionar impressora local com configurações manuais"
   d) Porta: USB001 (ou a porta USB que apareceu pra impressora)
   e) Fabricante: "Generic"   Modelo: "Generic / Text Only"
   f) Nome amigável: "ZEBRA-FFB" (ou o que preferir)
3. Compartilhe a fila:
   a) Click direito na impressora → Propriedades de impressora → Aba Compartilhamento
   b) Marque "Compartilhar esta impressora"
   c) Nome do compartilhamento: ZEBRA   (sem espaços; este vai virar PRINTER_NAME)
4. Baixe esta pasta inteira pra C:\argox-bridge
5. Edite o .env:
     PRINTER_MODE=usb
     PRINTER_NAME=ZEBRA
6. (opcional) baixe nssm.exe e cole na pasta
7. Click direito > Executar como administrador: install-windows.bat
```

## Teste rápido (sem instalar como serviço)

```cmd
cd C:\argox-bridge
copy .env.example .env
notepad .env       :: ajuste PRINTER_MODE / PRINTER_HOST ou PRINTER_NAME
node server.js
```

Em outra janela:
```cmd
curl http://localhost:9101/health
curl -X POST http://localhost:9101/test-print
```

Deve responder algo como:
```json
{"status":"ok","mode":"usb","printer":"USB \\\\localhost\\ZEBRA","version":"0.3.0"}
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
- A Zebra GC420t pode estar em EPL2 (padrão de fábrica antigo). Use o **Zebra Setup Utilities** → "Configure Printer Connectivity" → "Set Language" → ZPL.

**Modo USB: `copy exit 1` ou "O sistema não pode encontrar o caminho especificado"**
- A fila não está compartilhada com o nome em `PRINTER_NAME`. Confira em
  Painel de Controle → Dispositivos e Impressoras → click direito na fila
  → Propriedades → Compartilhamento. O nome do compartilhamento (`Share name`)
  precisa bater EXATAMENTE com `PRINTER_NAME` no `.env`.

**Modo USB: imprime página em branco**
- Driver errado. O ZDesigner (driver oficial Zebra) renderiza e descarta os
  comandos ZPL. Use o driver "Generic / Text Only" do próprio Windows.

## Logs

- Modo serviço: `bridge.log` na pasta de instalação (rotação a 1MB)
- Modo standalone: stdout
