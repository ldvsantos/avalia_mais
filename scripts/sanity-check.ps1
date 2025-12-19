param(
  [int]$Port = 3010,
  [string]$HostName = 'localhost',
  [int]$StartupSeconds = 3,
  [string]$NodeEnv = 'development',
  [string]$AdminUser = 'admin',
  [string]$AdminPass = 'admin',
  [string]$HmacSecret = 'dev-secret-change-me'
)

$ErrorActionPreference = 'Stop'

function Write-Step([string]$Message) {
  Write-Host ("[sanity] {0}" -f $Message)
}

$RepoRoot = Split-Path -Parent $PSScriptRoot
$ServerDir = Join-Path $RepoRoot 'server'

if (-not (Test-Path $ServerDir)) {
  throw "Diretório do servidor não encontrado: $ServerDir"
}

Write-Step "ServerDir=$ServerDir"
Write-Step "Port=$Port"

# 1) npm install (garante dependências)
Write-Step 'npm install (server)'
Push-Location $ServerDir
try {
  npm install | Out-Host
} finally {
  Pop-Location
}

# 2) require do entrypoint (pega erros rápidos de sintaxe/import)
Write-Step 'node -e require(server/index.js)'
Push-Location $RepoRoot
try {
  node -e "require('./server/index.js'); console.log('server/index.js carregou');" | Out-Host
} finally {
  Pop-Location
}

# 3) sobe servidor em background (job) + smoke HTTP
Write-Step 'Subindo servidor (job) + smoke HTTP'

$cwd = $ServerDir
$job = Start-Job -ScriptBlock {
  param($port,$adminUser,$adminPass,$hmac,$nodeEnv,$cwd)

  $ErrorActionPreference = 'Stop'
  Set-Location $cwd

  $env:PORT = "$port"
  $env:ADMIN_USER = $adminUser
  $env:ADMIN_PASS = $adminPass
  $env:HMAC_SECRET = $hmac
  $env:NODE_ENV = $nodeEnv

  node index.js
} -ArgumentList $Port,$AdminUser,$AdminPass,$HmacSecret,$NodeEnv,$cwd

try {
  Start-Sleep -Seconds $StartupSeconds

  $baseUrl = "http://$HostName`:$Port"

  try {
    Invoke-WebRequest -UseBasicParsing "$baseUrl/" | Out-Null
    Write-Step 'GET / OK'
  } catch {
    throw "GET / FALHOU: $($_.Exception.Message)"
  }

  try {
    Invoke-WebRequest -UseBasicParsing "$baseUrl/consulta" | Out-Null
    Write-Step 'GET /consulta OK'
  } catch {
    throw "GET /consulta FALHOU: $($_.Exception.Message)"
  }

  Write-Step 'Sanity checks OK'
} finally {
  # Encerra job e limpa
  try { Stop-Job -Job $job | Out-Null } catch {}
  try { Remove-Job -Job $job -Force | Out-Null } catch {}
  Write-Step 'Servidor (job) encerrado'
}
