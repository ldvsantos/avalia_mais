Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$pasta = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $pasta

$qmd = Join-Path $pasta "PITCH_DECK.qmd"
$pptx = Join-Path $pasta "PITCH_DECK.pptx"
$html = Join-Path $pasta "PITCH_DECK.html"

if (-not (Test-Path -LiteralPath $qmd)) {
  throw "Arquivo QMD não encontrado em $qmd"
}

if (Test-Path -LiteralPath $pptx) {
  Remove-Item -LiteralPath $pptx -Force
}

if (Test-Path -LiteralPath $html) {
  Remove-Item -LiteralPath $html -Force
}

if (-not (Get-Command quarto -ErrorAction SilentlyContinue)) {
  throw "Quarto não encontrado no PATH. Instale o Quarto e tente novamente."
}

quarto render $qmd --to pptx

quarto render $qmd --to revealjs

# Copia para a pasta do site (para publicar via /projeto_centelha/...)
$siteDir = Join-Path $pasta "..\src\projeto_centelha"
if (-not (Test-Path -LiteralPath $siteDir)) {
  New-Item -ItemType Directory -Path $siteDir | Out-Null
}

Copy-Item -LiteralPath $pptx -Destination (Join-Path $siteDir "PITCH_DECK.pptx") -Force
Copy-Item -LiteralPath $html -Destination (Join-Path $siteDir "PITCH_DECK.html") -Force

Get-Item -LiteralPath $pptx, $html | Select-Object Name, Length, FullName
