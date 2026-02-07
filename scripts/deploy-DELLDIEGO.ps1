param(
  [Parameter(Mandatory = $false)]
  [Alias('Host')]
  [string]$Server = '13.59.96.218',

  [Parameter(Mandatory = $false)]
  [string]$User = 'ubuntu',

  [Parameter(Mandatory = $false)]
  [string]$KeyPath = "$env:USERPROFILE\.ssh\planterr.pem",

  [Parameter(Mandatory = $false)]
  [int]$SshPort = 22,

  [Parameter(Mandatory = $false)]
  [int]$SshConnectTimeoutSeconds = 15,

  [Parameter(Mandatory = $false)]
  [string]$RemoteDir = '/opt/avalia',

  [Parameter(Mandatory = $false)]
  [string]$Pm2Name = 'avalia',

  [Parameter(Mandatory = $false)]
  [string]$Branch = '',

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

function Fail([string]$Message) {
  Write-Host "ERRO: $Message" -ForegroundColor Red
  exit 1
}

function TestTcpPort {
  param(
    [Parameter(Mandatory = $true)][string]$ComputerName,
    [Parameter(Mandatory = $true)][int]$Port,
    [Parameter(Mandatory = $false)][int]$TimeoutMs = 1500
  )

  $tnc = Get-Command Test-NetConnection -ErrorAction SilentlyContinue
  if ($null -ne $tnc) {
    try {
      $r = Test-NetConnection -ComputerName $ComputerName -Port $Port -WarningAction SilentlyContinue
      return [bool]$r.TcpTestSucceeded
    } catch {
      return $false
    }
  }

  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $async = $client.BeginConnect($ComputerName, $Port, $null, $null)
    $ok = $async.AsyncWaitHandle.WaitOne($TimeoutMs, $false)
    if (-not $ok) { return $false }
    $client.EndConnect($async)
    return $true
  } catch {
    return $false
  } finally {
    try { $client.Close() } catch {}
  }
}

function EnsureGitCredentialHelper {
  if (-not (Get-Command git -ErrorAction SilentlyContinue)) { return }

  $globalHelpers = @(git config --global --get-all credential.helper 2>$null)
  if ($globalHelpers -contains 'manager-core') {
    $hasManagerCore = $null -ne (Get-Command git-credential-manager-core -ErrorAction SilentlyContinue)
    if (-not $hasManagerCore) {
      Write-Host "Aviso: credential.helper='manager-core' está configurado, mas 'git-credential-manager-core' não existe. Ajustando para 'manager'..." -ForegroundColor Yellow
      git config --global --replace-all credential.helper manager
      if ($LASTEXITCODE -ne 0) {
        Fail "Falha ao ajustar credential.helper. Rode manualmente: git config --global --replace-all credential.helper manager"
      }
    }
  }
}

# Em PowerShell 7+, alguns comandos nativos escrevendo em stderr podem virar erro (NativeCommandError)
# quando $ErrorActionPreference='Stop'. Para o fluxo do git, isso atrapalha.
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -Scope Global -ErrorAction SilentlyContinue) {
  $global:PSNativeCommandUseErrorActionPreference = $false
}

# Carrega configuração local opcional (não versionada)
$configPath = Join-Path $PSScriptRoot 'deploy-config.ps1'
if (Test-Path $configPath) {
  try {
    $cfg = . $configPath
    if ($cfg -is [hashtable]) {
      if ($cfg.ContainsKey('Host'))      { $Server = [string]$cfg['Host'] }
      if ($cfg.ContainsKey('User'))      { $User = [string]$cfg['User'] }
      if ($cfg.ContainsKey('KeyPath'))   { $KeyPath = [string]$cfg['KeyPath'] }
      if ($cfg.ContainsKey('SshPort'))   { $SshPort = [int]$cfg['SshPort'] }
      if ($cfg.ContainsKey('SshConnectTimeoutSeconds')) { $SshConnectTimeoutSeconds = [int]$cfg['SshConnectTimeoutSeconds'] }
      if ($cfg.ContainsKey('RemoteDir')) { $RemoteDir = [string]$cfg['RemoteDir'] }
      if ($cfg.ContainsKey('Pm2Name'))   { $Pm2Name = [string]$cfg['Pm2Name'] }
      if ($cfg.ContainsKey('Branch'))    { $Branch = [string]$cfg['Branch'] }
    }
  } catch {
    Fail ("Falha ao carregar ${configPath}: " + $_.Exception.Message)
  }
}

# Verificação da chave SSH
if (-not (Test-Path $KeyPath)) {
    # Tenta encontrar no diretório do script como fallback
    $localKey = Join-Path $PSScriptRoot "planterr.pem"
    if (Test-Path $localKey) {
        Write-Host "AVISO: Chave não encontrada em '$KeyPath'." -ForegroundColor Yellow
        Write-Host "       Usando chave local encontrada em '$localKey'." -ForegroundColor Yellow
        $KeyPath = $localKey
    } else {
        Fail "Arquivo de chave privada (PEM) não encontrado!`n   Esperado em: '$KeyPath'`n`n   SOLUÇÃO:`n   1. Copie o arquivo 'planterr.pem' para '$KeyPath'`n   2. Ou coloque-o na pasta 'scripts/'`n   3. Ou crie 'scripts/deploy-config.ps1' para configurar um caminho diferente."
    }
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
  # Testa SSH o quanto antes para evitar commits/push acidentais quando o servidor está inacessível.
  Write-Host "Testando conectividade SSH: ${Server}:$SshPort ..." -ForegroundColor DarkGray
  $timeoutMs = [Math]::Max(1000, $SshConnectTimeoutSeconds * 1000)
  $canConnectEarly = TestTcpPort -ComputerName $Server -Port $SshPort -TimeoutMs $timeoutMs
  if (-not $canConnectEarly) {
    Fail (
      "Não foi possível conectar em ${Server}:$SshPort (TCP). " +
      "Isso normalmente é Security Group/NACL bloqueando a porta 22, IP público errado, instância desligada, ou rede local bloqueando SSH.\n\n" +
      "Checklist rápido:\n" +
      "- Confirme o IP público atual da EC2 (pode ter mudado)\n" +
      "- AWS Security Group: inbound TCP 22 liberado para SEU IP\n" +
      "- NACL/Firewall da VPC liberando TCP 22\n" +
      "- Se estiver em rede corporativa, teste via 4G/VPN (algumas redes bloqueiam 22)\n\n" +
      "Teste manual: Test-NetConnection -ComputerName ${Server} -Port $SshPort"
    )
  }

  if (-not $SkipGit) {
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
      Fail 'Git não encontrado. Instale o Git ou rode com -SkipGit.'
    }

    $isRepo = git rev-parse --is-inside-work-tree 2>$null
    if ($LASTEXITCODE -ne 0) {
      Fail 'Esta pasta não parece ser um repositório Git.'
    }

    # Antes de qualquer operação remota (fetch/pull/push), garante que o helper de credenciais não está quebrado.
    EnsureGitCredentialHelper

    $statusPorcelain = git status --porcelain
    if ($statusPorcelain) {
      # Nunca permitir commitar dados persistentes do servidor.
      if ($statusPorcelain -match "\sserver/data/") {
        Fail "Há alterações em 'server/data/'. Esses dados não devem ser commitados/deployados.\n\nPendências:\n$statusPorcelain\n\nDica: git checkout -- server/data"
      }

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

    # Detecta branch atual (e usa ele por padrão, se não foi configurado)
    $currentBranch = (git rev-parse --abbrev-ref HEAD).Trim()
    if (-not $Branch -or -not $Branch.Trim()) {
      $Branch = $currentBranch
    }

    # Garante que estamos no branch esperado
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
    '--exclude=*/node_modules',
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
    '--exclude=temp',
    '--exclude=*.zip',
    '--exclude=*.tgz',
    '--exclude=*.tar.gz',
    '--exclude=documentacao',
    '--exclude=templates',
    '--exclude=server.log',
    '--exclude=src/results'
  )

  Write-Host "Gerando pacote: $archiveLocal" -ForegroundColor Cyan
  $tarTime = Measure-Command {
    & tar -czf $archiveLocal @excludes .
  }
  if ($LASTEXITCODE -ne 0) { Fail 'Falha ao gerar o .tgz' }

  Write-Host ("Empacotamento concluído em {0:N2}s" -f $tarTime.TotalSeconds) -ForegroundColor DarkGray

  $pkgSize = (Get-Item $archiveLocal).Length
  $pkgSizeMB = "{0:N2}" -f ($pkgSize / 1MB)
  Write-Host "Tamanho do pacote: $pkgSizeMB MB" -ForegroundColor Yellow
  
  # SSH já foi testado antes (antes de git/empacotar) para evitar commits quando offline.

  Write-Host "Iniciando upload para $Server..." -ForegroundColor Cyan
  $scpTime = Measure-Command {
    & scp -P $SshPort -o ConnectTimeout=$SshConnectTimeoutSeconds -o StrictHostKeyChecking=no -i $KeyPath $archiveLocal "${User}@${Server}:$remoteArchive"
  }
  if ($LASTEXITCODE -ne 0) { Fail 'Falha no SCP' }

  Write-Host ("Upload concluído em {0:N2}s" -f $scpTime.TotalSeconds) -ForegroundColor DarkGray

  Write-Host "Upload concluído!" -ForegroundColor Green

  $remoteScript = @'
set -euo pipefail

REMOTE_DIR="__REMOTE_DIR__"
PM2_NAME="__PM2_NAME__"
ARCHIVE="__ARCHIVE__"
TS="__TS__"

APP_USER="${SUDO_USER:-ubuntu}"

STAGING="/opt/avalia_staging_$TS"
BACKUP_DIR="/opt/avalia_backups"
BACKUP_TGZ="$BACKUP_DIR/avalia-persist-$TS.tgz"

# Migração automática de planterr -> avalia
if [ ! -d "$REMOTE_DIR" ] && [ -d "/opt/planterr" ]; then
  echo ">>> Migrando instalação antiga (/opt/planterr -> $REMOTE_DIR)..."
  pm2 stop planterr || true
  pm2 delete planterr || true
  mv /opt/planterr "$REMOTE_DIR"
fi

mkdir -p "$BACKUP_DIR"

# Backup do que não pode ser perdido (persistência)
# Obs: tar não consegue "append" de forma confiável em .tgz; por isso gera um único backup com tudo.
PERSIST_PATHS=""
if [ -d "$REMOTE_DIR/server/data" ]; then PERSIST_PATHS="$PERSIST_PATHS server/data"; fi
if [ -d "$REMOTE_DIR/server/logs" ]; then PERSIST_PATHS="$PERSIST_PATHS server/logs"; fi
if [ -d "$REMOTE_DIR/server/certs" ]; then PERSIST_PATHS="$PERSIST_PATHS server/certs"; fi
if [ -f "$REMOTE_DIR/server/.admin-secret" ]; then PERSIST_PATHS="$PERSIST_PATHS server/.admin-secret"; fi
if [ -f "$REMOTE_DIR/server/.env" ]; then PERSIST_PATHS="$PERSIST_PATHS server/.env"; fi
if [ -d "$REMOTE_DIR/src/results" ]; then PERSIST_PATHS="$PERSIST_PATHS src/results"; fi
if [ -d "$REMOTE_DIR/img/events" ]; then PERSIST_PATHS="$PERSIST_PATHS img/events"; fi

if [ -n "$PERSIST_PATHS" ]; then
  # shellcheck disable=SC2086
  tar -czf "$BACKUP_TGZ" -C "$REMOTE_DIR" $PERSIST_PATHS 2>/dev/null || true
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
mkdir -p "$STAGING/src"

if [ -f "$REMOTE_DIR/server/.env" ]; then
  cp -f "$REMOTE_DIR/server/.env" "$STAGING/server/.env"
  chown "$APP_USER:$APP_USER" "$STAGING/server/.env" || true
  chmod 600 "$STAGING/server/.env" || true
fi

if [ -f "$REMOTE_DIR/server/.admin-secret" ]; then
  cp -f "$REMOTE_DIR/server/.admin-secret" "$STAGING/server/.admin-secret"
fi

if [ -d "$REMOTE_DIR/server/data" ]; then
  rm -rf "$STAGING/server/data"
  cp -a "$REMOTE_DIR/server/data" "$STAGING/server/data"
fi

# Restaura logs do servidor (auditoria/segurança)
if [ -d "$REMOTE_DIR/server/logs" ]; then
  rm -rf "$STAGING/server/logs"
  cp -a "$REMOTE_DIR/server/logs" "$STAGING/server/logs"
fi

# Restaura certificados (usado para assinatura de PDFs)
if [ -d "$REMOTE_DIR/server/certs" ]; then
  rm -rf "$STAGING/server/certs"
  cp -a "$REMOTE_DIR/server/certs" "$STAGING/server/certs"
fi

# Restaura PDFs publicados (tabela “Editais/Resultados”)
if [ -d "$REMOTE_DIR/src/results" ]; then
  rm -rf "$STAGING/src/results"
  mkdir -p "$STAGING/src"
  cp -a "$REMOTE_DIR/src/results" "$STAGING/src/results"
fi

# Restaura imagens de eventos
if [ -d "$REMOTE_DIR/img/events" ]; then
  rm -rf "$STAGING/img/events"
  mkdir -p "$STAGING/img"
  cp -a "$REMOTE_DIR/img/events" "$STAGING/img/events"
fi

# Garante ownership/permissões após copiar persistência
chown -R "$APP_USER:$APP_USER" "$STAGING/server" "$STAGING/src" "$STAGING/img" || true
chmod -R u+rwX "$STAGING/server" "$STAGING/src" "$STAGING/img" || true

# Dependências do Node
sudo -u "$APP_USER" -H bash -lc "cd '$STAGING/server' && if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi"

# Troca atômica (mantém um backup do código anterior)
if [ -d "$REMOTE_DIR" ]; then
  rm -rf "${REMOTE_DIR}_prev" || true
  mv "$REMOTE_DIR" "${REMOTE_DIR}_prev"
fi
mv "$STAGING" "$REMOTE_DIR"

# Ajusta Nginx para permitir uploads maiores (10MB)
NGINX_CONF="/etc/nginx/sites-available/default"
if [ -f "$NGINX_CONF" ]; then
  echo "Verificando configuracao do Nginx..."
  if grep -q "client_max_body_size" "$NGINX_CONF"; then
    sudo sed -i "s/client_max_body_size .*/client_max_body_size 10M;/g" "$NGINX_CONF"
  else
    # Insere no bloco server
    sudo sed -i "/server {/a \    client_max_body_size 10M;" "$NGINX_CONF"
  fi
  sudo nginx -t && sudo systemctl reload nginx
fi

# Reinicia app
cd "$REMOTE_DIR/server"
# Importante: o PM2 mantém env no processo. Para garantir que alterações em server/.env
# (ex.: ADMIN_PASS/HMAC_SECRET) tenham efeito, atualiza o env do processo no restart.
sudo -u "$APP_USER" -H bash -lc "set -e; envf='$REMOTE_DIR/server/.env'; if [ -f \"\$envf\" ]; then ADMIN_USER=\$(grep -m1 '^ADMIN_USER=' \"\$envf\" | cut -d= -f2- || true); ADMIN_PASS=\$(grep -m1 '^ADMIN_PASS=' \"\$envf\" | cut -d= -f2- || true); HMAC_SECRET=\$(grep -m1 '^HMAC_SECRET=' \"\$envf\" | cut -d= -f2- || true); export ADMIN_USER ADMIN_PASS HMAC_SECRET; fi; if pm2 describe '$PM2_NAME' > /dev/null 2>&1; then pm2 restart '$PM2_NAME' --update-env; else pm2 start index.js --name '$PM2_NAME'; fi"
sudo -u "$APP_USER" -H pm2 save || true

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
  $remoteTime = Measure-Command {
    $remoteScriptContent | & ssh -p $SshPort -o ConnectTimeout=$SshConnectTimeoutSeconds -o StrictHostKeyChecking=no -i $KeyPath "${User}@${Server}" "sudo bash -s"
  }
  if ($LASTEXITCODE -ne 0) { Fail 'Deploy remoto falhou' }

  Write-Host ("Etapa remota concluída em {0:N2}s" -f $remoteTime.TotalSeconds) -ForegroundColor DarkGray

  Write-Host 'Validando resposta pública...' -ForegroundColor Cyan
  & curl.exe -I "http://$Server/" | Select-Object -First 1

  Write-Host "DEPLOY FINALIZADO: http://$Server/" -ForegroundColor Green
}
finally {
  Pop-Location
  if (Test-Path $remoteScriptLocal) { Remove-Item -Force $remoteScriptLocal -ErrorAction SilentlyContinue }
  if (Test-Path $archiveLocal) { Remove-Item -Force $archiveLocal -ErrorAction SilentlyContinue }
}
