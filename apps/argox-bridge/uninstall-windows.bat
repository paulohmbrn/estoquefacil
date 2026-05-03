@echo off
REM Remove o serviço ArgoxBridge.
setlocal
set SERVICE=ArgoxBridge
"%~dp0nssm.exe" stop %SERVICE%
"%~dp0nssm.exe" remove %SERVICE% confirm
netsh advfirewall firewall delete rule name="ArgoxBridge 9101" >nul 2>&1
echo Servico %SERVICE% removido.
endlocal
pause
