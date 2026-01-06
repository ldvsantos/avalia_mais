@echo off
setlocal
cd /d "%~dp0"
REM Uso:
REM   deploy.cmd                -> fluxo normal (git + pacote + deploy) SEM auto-commit
REM   deploy.cmd autocommit      -> fluxo normal com AutoCommit
REM   deploy.cmd emergency       -> ignora git e força deploy do estado local

set "PSFILE=%~dp0scripts\deploy.ps1"

if /I "%~1"=="emergency" (
	echo.
	echo [EMERGENCY] Deploy sem Git - SkipGit + AllowDirty
	powershell -NoProfile -ExecutionPolicy Bypass -File "%PSFILE%" -Emergency
) else if /I "%~1"=="autocommit" (
	echo.
	echo [AUTOCOMMIT] Deploy com AutoCommit
	powershell -NoProfile -ExecutionPolicy Bypass -File "%PSFILE%" -AutoCommit
) else (
	powershell -NoProfile -ExecutionPolicy Bypass -File "%PSFILE%" %*
)
echo.
echo Deploy finalizado. Se houver erro, copie a mensagem acima.
pause
