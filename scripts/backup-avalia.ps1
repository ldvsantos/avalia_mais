Param(
  [string]$Root = "",
  [switch]$NoZip
)

$ErrorActionPreference = 'Stop'

function Resolve-RepoRoot {
  if ($Root -and (Test-Path $Root)) { return (Resolve-Path $Root).Path }
  return (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
}

$repoRoot = Resolve-RepoRoot
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupRoot = Join-Path $repoRoot "backups"
$dest = Join-Path $backupRoot "avalia-backup-$timestamp"

New-Item -ItemType Directory -Force -Path $dest | Out-Null

# Pastas/arquivos a preservar (sem incluir segredos como .env)
$items = @(
  @{ Source = Join-Path $repoRoot "server\data"; Dest = "server-data" },
  @{ Source = Join-Path $repoRoot "server\logs"; Dest = "server-logs" },
  @{ Source = Join-Path $repoRoot "src\results"; Dest = "public-results" }
)

foreach ($it in $items) {
  $src = $it.Source
  $dst = Join-Path $dest $it.Dest
  if (Test-Path $src) {
    New-Item -ItemType Directory -Force -Path $dst | Out-Null
    Copy-Item -Recurse -Force -Path (Join-Path $src '*') -Destination $dst -ErrorAction SilentlyContinue
  }
}

# Copia arquivos úteis (NÃO copia .env por segurança)
$maybeFiles = @(
  Join-Path $repoRoot "server\.admin-secret",
  Join-Path $repoRoot "server\data\config.json",
  Join-Path $repoRoot "server\data\process_calendar.json",
  Join-Path $repoRoot "server\data\public_files.json"
)

$filesDir = Join-Path $dest "files"
New-Item -ItemType Directory -Force -Path $filesDir | Out-Null
foreach ($f in $maybeFiles) {
  if (Test-Path $f) {
    Copy-Item -Force -Path $f -Destination $filesDir
  }
}

if (-not $NoZip) {
  $zip = "$dest.zip"
  if (Test-Path $zip) { Remove-Item -Force $zip }
  Compress-Archive -Path (Join-Path $dest '*') -DestinationPath $zip
}

Write-Host "Backup criado em: $dest" -ForegroundColor Green
if (-not $NoZip) { Write-Host "ZIP criado em: $dest.zip" -ForegroundColor Green }
Write-Host "Obs.: por segurança, este script NÃO copia .env/.pem/.key." -ForegroundColor Yellow
