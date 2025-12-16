@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\deploy.ps1" -AutoCommit
echo.
echo Deploy finalizado. Se houver erro, copie a mensagem acima.
pause
