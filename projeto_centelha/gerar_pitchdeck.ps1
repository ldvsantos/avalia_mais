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

Get-Item -LiteralPath $pptx, $html | Select-Object Name, Length, FullName
