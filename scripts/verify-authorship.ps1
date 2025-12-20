param(
  [string]$Tag = "",
  [string]$ArtifactPath = ""
)

$ErrorActionPreference = 'Stop'

Write-Host "[verify] Repo: $PWD"

# Basic sanity
git rev-parse --is-inside-work-tree | Out-Null

Write-Host "[verify] Último commit (com assinatura, se existir):"
git log --show-signature -1

if ($Tag -and $Tag.Trim().Length -gt 0) {
  Write-Host "[verify] Verificando tag: $Tag"
  git verify-tag $Tag
}

if ($ArtifactPath -and $ArtifactPath.Trim().Length -gt 0) {
  if (-not (Test-Path $ArtifactPath)) {
    throw "ArtifactPath não existe: $ArtifactPath"
  }

  $hash = (Get-FileHash -Algorithm SHA256 -Path $ArtifactPath).Hash.ToLowerInvariant()
  Write-Host "[verify] SHA256($ArtifactPath) = $hash"

  $sumsFile = Join-Path $PSScriptRoot "..\checksums\SHA256SUMS.txt"
  if (Test-Path $sumsFile) {
    $name = Split-Path -Leaf $ArtifactPath
    $expected = (Get-Content $sumsFile | Where-Object { $_ -match "^[0-9a-fA-F]{64}\s+" } | Where-Object { $_ -match [regex]::Escape($name) } | Select-Object -First 1)
    if ($expected) {
      $expectedHash = ($expected -split "\s+")[0].ToLowerInvariant()
      if ($expectedHash -ne $hash) {
        throw "Checksum NÃO confere para $name. Esperado=$expectedHash Atual=$hash"
      }
      Write-Host "[verify] Checksum confere com checksums/SHA256SUMS.txt"
    } else {
      Write-Host "[verify] Nenhuma linha encontrada para $name em checksums/SHA256SUMS.txt"
    }
  } else {
    Write-Host "[verify] checksums/SHA256SUMS.txt não encontrado (ok)"
  }
}

Write-Host "[verify] OK"
