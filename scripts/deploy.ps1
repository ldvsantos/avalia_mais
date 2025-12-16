param(
  [Parameter(Mandatory = $false)]
  [Alias('Host')]
  [string]$Server = '13.59.123.67',

  [Parameter(Mandatory = $false)]
  [string]$User = 'ubuntu',

  [Parameter(Mandatory = $false)]
  [string]$KeyPath = "$env:USERPROFILE\.ssh\planterr.pem",

  [Parameter(Mandatory = $false)]
  [string]$RemoteDir = '/opt/planterr',

  [Parameter(Mandatory = $false)]
  [string]$Pm2Name = 'planterr',

  [Parameter(Mandatory = $false)]
  [string]$Branch = 'master',

  [Parameter(Mandatory = $false)]
  [switch]$SkipGit,

  [Parameter(Mandatory = $false)]
  [switch]$AllowDirty,

  # Se houver mudanças locais, faz git add/commit automaticamente e depois push.
  # (Para evitar bagunça, ele pede uma mensagem e recusa se estiver vazia.)
  [Parameter(Mandatory = $false)]
  [switch]$AutoCommit,

  [Parameter(Mandatory = $false)]
  [string]$CommitMessage
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Carrega configuração local opcional (não versionada)
$configPath = Join-Path $PSScriptRoot 'deploy-config.ps1'
if (Test-Path $configPath) {
  try {
    $cfg = . $configPath
    if ($cfg -is [hashtable]) {
      if ($cfg.Host)      { $Server = [string]$cfg.Host }
      if ($cfg.User)      { $User = [string]$cfg.User }
      if ($cfg.KeyPath)   { $KeyPath = [string]$cfg.KeyPath }
      if ($cfg.RemoteDir) { $RemoteDir = [string]$cfg.RemoteDir }
      if ($cfg.Pm2Name)   { $Pm2Name = [string]$cfg.Pm2Name }
      if ($cfg.Branch)    { $Branch = [string]$cfg.Branch }
    }
  } catch {
    Fail ("Falha ao carregar ${configPath}: " + $_.Exception.Message)
  }
}

function Fail([string]$Message) {
  Write-Host "ERRO: $Message" -ForegroundColor Red
  exit 1
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$archiveLocal = Join-Path $env:TEMP "planterr-deploy-$timestamp.tgz"
$remoteArchive = "/tmp/planterr-deploy-$timestamp.tgz"
$remoteScriptLocal = Join-Path $env:TEMP "planterr-remote-deploy-$timestamp.sh"

if (-not (Test-Path $KeyPath)) {
  Fail "Chave SSH não encontrada em: $KeyPath"
}

foreach ($cmd in @('ssh', 'scp', 'tar')) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
    Fail "Comando não encontrado no PATH: $cmd"
  }
}

Push-Location $repoRoot
try {
  if (-not $SkipGit) {
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
      Fail 'Git não encontrado. Instale o Git ou rode com -SkipGit.'
    }

    $isRepo = git rev-parse --is-inside-work-tree 2>$null
    if ($LASTEXITCODE -ne 0) {
      Fail 'Esta pasta não parece ser um repositório Git.'
    }

    $statusPorcelain = git status --porcelain
    if ($statusPorcelain) {
      if ($AutoCommit) {
        if (-not $CommitMessage) {
          $CommitMessage = Read-Host 'Digite a mensagem do commit (obrigatório)'
        }
        if (-not $CommitMessage -or -not $CommitMessage.Trim()) {
          Fail "Mensagem de commit vazia. Operação cancelada para evitar commit ruim."
        }

        git add -A
        if ($LASTEXITCODE -ne 0) { Fail 'git add falhou' }

        git commit -m $CommitMessage
        if ($LASTEXITCODE -ne 0) {
          Fail 'git commit falhou (talvez nada para commitar?)'
        }
      } elseif (-not $AllowDirty) {
        Fail "Há alterações locais não commitadas. Rode o deploy com -AutoCommit ou faça commit manualmente.\n\nPendências:\n$statusPorcelain"
      }
    }

    # Evita merge commits e conflitos: rebase antes de push
    git fetch --prune
    if ($LASTEXITCODE -ne 0) { Fail 'git fetch falhou' }

    # Garante que estamos no branch esperado
    $currentBranch = (git rev-parse --abbrev-ref HEAD).Trim()
    if ($currentBranch -ne $Branch) {
      Fail "Branch atual é '$currentBranch', mas o deploy está configurado para '$Branch'. Troque de branch ou passe -Branch $currentBranch."
    }

    git pull --rebase
    if ($LASTEXITCODE -ne 0) { Fail 'git pull --rebase falhou' }

    git push
    if ($LASTEXITCODE -ne 0) { Fail 'git push falhou' }
  }

  if (Test-Path $archiveLocal) { Remove-Item -Force $archiveLocal }

  # Empacota o código SEM dados persistentes do servidor
  # (server/data e server/.admin-secret devem ficar no host)
  $excludes = @(
    '--exclude=.git',
    '--exclude=.github',
    '--exclude=.qodo',
    '--exclude=node_modules',
    '--exclude=server/node_modules',
    '--exclude=.venv',
    '--exclude=server/data',
    '--exclude=server/.admin-secret',
    '--exclude=server/logs',
    '--exclude=server/.env',
    '--exclude=*.pem',
    '--exclude=*.key',
    '--exclude=*.crt',
    '--exclude=tmp',
    '--exclude=temp'
  )

  Write-Host "Gerando pacote: $archiveLocal" -ForegroundColor Cyan
  & tar -czf $archiveLocal @excludes .
  if ($LASTEXITCODE -ne 0) { Fail 'Falha ao gerar o .tgz' }

  Write-Host "Enviando pacote para o servidor: $User@$Server" -ForegroundColor Cyan
  & scp -i $KeyPath $archiveLocal "${User}@${Server}:$remoteArchive"
  if ($LASTEXITCODE -ne 0) { Fail 'Falha no SCP' }

  $remoteScript = @'
set -euo pipefail

REMOTE_DIR="__REMOTE_DIR__"
PM2_NAME="__PM2_NAME__"
ARCHIVE="__ARCHIVE__"
TS="__TS__"

APP_USER="${SUDO_USER:-ubuntu}"

STAGING="/opt/planterr_staging_$TS"
BACKUP_DIR="/opt/planterr_backups"
BACKUP_TGZ="$BACKUP_DIR/planterr-persist-$TS.tgz"

mkdir -p "$BACKUP_DIR"

# Backup do que não pode ser perdido
if [ -d "$REMOTE_DIR/server/data" ] || [ -f "$REMOTE_DIR/server/.admin-secret" ] || [ -f "$REMOTE_DIR/server/.env" ]; then
  tar -czf "$BACKUP_TGZ" \
    -C "$REMOTE_DIR" \
    server/data \
    server/.admin-secret \
    server/.env \
    2>/dev/null || true
fi

rm -rf "$STAGING"
mkdir -p "$STAGING"

tar -xzf "$ARCHIVE" -C "$STAGING"

# Deixa o staging no mesmo usuário que roda o app
chown -R "$APP_USER:$APP_USER" "$STAGING" || true

# Garante que pastas sejam graváveis (tar do Windows pode chegar com diretórios 555)
chmod -R u+rwX "$STAGING" || true

# Restaura persistência no staging
mkdir -p "$STAGING/server"

if [ -f "$REMOTE_DIR/server/.env" ]; then
  cp -f "$REMOTE_DIR/server/.env" "$STAGING/server/.env"
fi

if [ -f "$REMOTE_DIR/server/.admin-secret" ]; then
  cp -f "$REMOTE_DIR/server/.admin-secret" "$STAGING/server/.admin-secret"
fi

if [ -d "$REMOTE_DIR/server/data" ]; then
  rm -rf "$STAGING/server/data"
  cp -a "$REMOTE_DIR/server/data" "$STAGING/server/data"
fi

# Dependências do Node
sudo -u "$APP_USER" -H bash -lc "cd '$STAGING/server' && if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi"

# Troca atômica (mantém um backup do código anterior)
if [ -d "$REMOTE_DIR" ]; then
  rm -rf "${REMOTE_DIR}_prev" || true
  mv "$REMOTE_DIR" "${REMOTE_DIR}_prev"
fi
mv "$STAGING" "$REMOTE_DIR"

# Reinicia app
cd "$REMOTE_DIR/server"
sudo -u "$APP_USER" -H pm2 restart "$PM2_NAME" || sudo -u "$APP_USER" -H pm2 start index.js --name "$PM2_NAME"
sudo -u "$APP_USER" -H pm2 save

# Healthcheck local (pode levar alguns segundos após restart)
ok=0
for i in $(seq 1 20); do
  if curl -fsS http://127.0.0.1:3000/api/registration-window > /dev/null 2>&1; then
    ok=1
    break
  fi
  sleep 0.5
done

if [ "$ok" != "1" ]; then
  echo "HEALTHCHECK_FAILED"
  exit 1
fi

echo "DEPLOY_OK: $TS"
'@

  $remoteScript = $remoteScript.Replace('__REMOTE_DIR__', $RemoteDir)
  $remoteScript = $remoteScript.Replace('__PM2_NAME__', $Pm2Name)
  $remoteScript = $remoteScript.Replace('__ARCHIVE__', $remoteArchive)
  $remoteScript = $remoteScript.Replace('__TS__', $timestamp)

  Write-Host 'Aplicando update no servidor (backup + swap + pm2 restart)...' -ForegroundColor Cyan
  # Normaliza quebras de linha para LF (evita \r quebrando bash options como 'pipefail')
  $remoteScriptContent = ($remoteScript -replace "`r`n", "`n") -replace "`r", ""
  $remoteScriptContent | & ssh -i $KeyPath "${User}@${Server}" "sudo bash -s"
  if ($LASTEXITCODE -ne 0) { Fail 'Deploy remoto falhou' }

  Write-Host 'Validando resposta pública...' -ForegroundColor Cyan
  & curl.exe -I "http://$Server/" | Select-Object -First 1

  Write-Host "DEPLOY FINALIZADO: http://$Server/" -ForegroundColor Green
}
finally {
  Pop-Location
  if (Test-Path $remoteScriptLocal) { Remove-Item -Force $remoteScriptLocal -ErrorAction SilentlyContinue }
  if (Test-Path $archiveLocal) { Remove-Item -Force $archiveLocal -ErrorAction SilentlyContinue }
}
