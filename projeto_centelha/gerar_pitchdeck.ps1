Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$pasta = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $pasta

$qmd = Join-Path $pasta "PITCH_DECK.qmd"
$pptx = Join-Path $pasta "PITCH_DECK.pptx"
$html = Join-Path $pasta "PITCH_DECK.html"
$htmlAssets = Join-Path $pasta "PITCH_DECK_files"

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

Copy-Item -LiteralPath $html -Destination (Join-Path $siteDir "PITCH_DECK.html") -Force

# Assets do HTML (CSS/JS do Reveal/Quarto)
if (-not (Test-Path -LiteralPath $htmlAssets)) {
  throw "Pasta de assets não encontrada: $htmlAssets"
}

$publishedAssets = Join-Path $siteDir "PITCH_DECK_files"
if (Test-Path -LiteralPath $publishedAssets) {
  Remove-Item -LiteralPath $publishedAssets -Recurse -Force
}
Copy-Item -LiteralPath $htmlAssets -Destination $publishedAssets -Recurse -Force

# Prints referenciados pelo deck (ex.: prints/manual/...)
# Copiamos para a pasta local (para o Quarto achar) e para o site (para o browser achar)
$printsSource = Join-Path $pasta "..\prints"
$printsLocal = Join-Path $pasta "prints"
$printsDest = Join-Path $siteDir "prints"

if (Test-Path -LiteralPath $printsSource) {
  # 1. Copia para local (projeto_centelha/prints)
  if (Test-Path -LiteralPath $printsLocal) {
    Remove-Item -LiteralPath $printsLocal -Recurse -Force
  }
  New-Item -ItemType Directory -Path $printsLocal | Out-Null
  Copy-Item -Path (Join-Path $printsSource "*") -Destination $printsLocal -Recurse -Force

  # 2. Copia para o site (src/projeto_centelha/prints)
  if (Test-Path -LiteralPath $printsDest) {
    Remove-Item -LiteralPath $printsDest -Recurse -Force
  }
  New-Item -ItemType Directory -Path $printsDest | Out-Null
  Copy-Item -Path (Join-Path $printsSource "*") -Destination $printsDest -Recurse -Force
}

# Imagens locais do deck (ex.: img/cover.png)
$imgSource = Join-Path $pasta "img"
$imgDest = Join-Path $siteDir "img"
if (Test-Path -LiteralPath $imgSource) {
    if (-not (Test-Path -LiteralPath $imgDest)) {
        New-Item -ItemType Directory -Path $imgDest | Out-Null
    }
    # Copia arquivos forçando sobrescrita, ignorando erros se arquivo estiver em uso (ex: video rodando)
    Get-ChildItem -Path $imgSource | ForEach-Object {
        try {
            Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $imgDest $_.Name) -Force -ErrorAction Stop
        } catch {
            Write-Warning "Não foi possível copiar $($_.Name): $($_.Exception.Message)"
        }
    }
}

# No site público, manter somente a versão HTML
$publishedPptx = Join-Path $siteDir "PITCH_DECK.pptx"
if (Test-Path -LiteralPath $publishedPptx) {
  Remove-Item -LiteralPath $publishedPptx -Force
}

Get-Item -LiteralPath $pptx, $html | Select-Object Name, Length, FullName
