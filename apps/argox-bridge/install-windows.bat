@echo off
REM Instala o Argox Bridge como serviço Windows usando NSSM.
REM Pré-requisitos:
REM   1. Node.js LTS instalado (https://nodejs.org)
REM   2. nssm.exe na mesma pasta deste .bat (baixar em https://nssm.cc/download)
REM   3. Arquivo .env configurado (PRINTER_HOST, PRINTER_PORT)
REM
REM Rodar como Administrador.

setlocal
set SERVICE=ArgoxBridge
set BRIDGE_DIR=%~dp0
set SCRIPT=%BRIDGE_DIR%server.js

if not exist "%BRIDGE_DIR%nssm.exe" (
  echo [ERRO] nssm.exe nao encontrado em %BRIDGE_DIR%
  echo Baixe em https://nssm.cc/download e coloque aqui.
  exit /b 1
)

REM Resolve o caminho ABSOLUTO do node.exe — sem isso, o NSSM grava só
REM "node.exe" e o serviço LocalSystem (que tem PATH diferente do user)
REM nao consegue achar.
set NODE_EXE=
for /f "delims=" %%I in ('where node.exe 2^>nul') do (
  if not defined NODE_EXE set NODE_EXE=%%I
)
if not defined NODE_EXE (
  echo [ERRO] node.exe nao encontrado no PATH.
  echo Instale Node.js LTS 22+ de https://nodejs.org com a opcao "Add to PATH".
  exit /b 1
)
echo Node.js: %NODE_EXE%

if not exist "%BRIDGE_DIR%.env" (
  echo [AVISO] .env nao encontrado. Copiando .env.example...
  copy "%BRIDGE_DIR%.env.example" "%BRIDGE_DIR%.env"
  echo Edite o .env com o IP da sua impressora antes de iniciar o servico.
)

echo Instalando servico %SERVICE%...
"%BRIDGE_DIR%nssm.exe" install %SERVICE% "%NODE_EXE%" "%SCRIPT%"
"%BRIDGE_DIR%nssm.exe" set %SERVICE% AppDirectory "%BRIDGE_DIR%"
"%BRIDGE_DIR%nssm.exe" set %SERVICE% DisplayName "Argox Bridge (Estoque Facil)"
"%BRIDGE_DIR%nssm.exe" set %SERVICE% Description "Recebe ZPL via HTTP local e repassa pra impressora Argox via TCP 9100."
"%BRIDGE_DIR%nssm.exe" set %SERVICE% Start SERVICE_AUTO_START
"%BRIDGE_DIR%nssm.exe" set %SERVICE% AppStdout "%BRIDGE_DIR%bridge.log"
"%BRIDGE_DIR%nssm.exe" set %SERVICE% AppStderr "%BRIDGE_DIR%bridge.log"
"%BRIDGE_DIR%nssm.exe" set %SERVICE% AppRotateFiles 1
"%BRIDGE_DIR%nssm.exe" set %SERVICE% AppRotateBytes 1048576

echo Abrindo porta no firewall...
netsh advfirewall firewall add rule name="ArgoxBridge 9101" dir=in action=allow protocol=TCP localport=9101 >nul 2>&1

echo Iniciando servico...
"%BRIDGE_DIR%nssm.exe" start %SERVICE%

echo.
echo ====================================
echo  Argox Bridge instalado com sucesso
echo ====================================
echo  Servico:    %SERVICE% (auto-start)
echo  Diretorio:  %BRIDGE_DIR%
echo  Log:        %BRIDGE_DIR%bridge.log
echo  Health:     http://localhost:9101/health
echo ====================================
endlocal
pause
