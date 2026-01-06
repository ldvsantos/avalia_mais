@echo off
setlocal
cd /d "%~dp0"
REM Uso:
REM   deploy.cmd                -> fluxo normal (git + pacote + deploy)
REM   deploy.cmd emergency       -> ignora git e força deploy do estado local

if /I "%~1"=="emergency" (
	echo.
	echo [EMERGENCY] Deploy sem Git (SkipGit + AllowDirty)
	powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\deploy.ps1" -Emergency
) else (
	powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\deploy.ps1" -AutoCommit
)
echo.
echo Deploy finalizado. Se houver erro, copie a mensagem acima.
pause
