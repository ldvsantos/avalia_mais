@echo off
setlocal
cd /d "%~dp0"
REM Uso:
REM   deploy.cmd                -> fluxo normal (git + pacote + deploy)
REM   deploy.cmd emergency       -> ignora git e força deploy do estado local

set "PSFILE=%~dp0scripts\deploy.ps1"

if /I "%~1"=="emergency" (
	echo.
	echo [EMERGENCY] Deploy sem Git (SkipGit + AllowDirty)
	shift
	powershell -NoProfile -ExecutionPolicy Bypass -File "%PSFILE%" -Emergency %*
) else (
	powershell -NoProfile -ExecutionPolicy Bypass -File "%PSFILE%" -AutoCommit %*
)
echo.
echo Deploy finalizado. Se houver erro, copie a mensagem acima.
pause
