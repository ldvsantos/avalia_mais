# Script de Backup para Windows (PowerShell)
$ErrorActionPreference = "Stop"

$sourceDir = Join-Path $PSScriptRoot "..\server\data"
$backupDir = Join-Path $PSScriptRoot "..\backups"
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$zipFile = Join-Path $backupDir "backup-data-$timestamp.zip"

# Criar diretório de backups se não existir
if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir | Out-Null
}

Write-Host "Iniciando backup de $sourceDir para $zipFile..."

# Compactar pasta data
Compress-Archive -Path "$sourceDir\*" -DestinationPath $zipFile

Write-Host "Backup concluído com sucesso: $zipFile"
