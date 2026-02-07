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

# Páginas auxiliares embutidas no deck (ex.: iframes locais)
$casesSource = Join-Path $pasta "cases"
$casesDest = Join-Path $siteDir "cases"
if (Test-Path -LiteralPath $casesSource) {
  if (Test-Path -LiteralPath $casesDest) {
    Remove-Item -LiteralPath $casesDest -Recurse -Force
  }
  New-Item -ItemType Directory -Path $casesDest | Out-Null
  Copy-Item -Path (Join-Path $casesSource "*") -Destination $casesDest -Recurse -Force
}

# Prints referenciados pelo deck (ex.: prints/manual/...)
# Fonte de verdade: projeto_centelha/prints (permite atualizar prints específicos do deck sem sobrescrita)
# Fallback: ../prints (para bootstrap em clones novos)
$printsBootstrap = Join-Path $pasta "..\prints"
$printsLocal = Join-Path $pasta "prints"
$printsSource = $printsLocal
$printsDest = Join-Path $siteDir "prints"

if (-not (Test-Path -LiteralPath $printsLocal)) {
  New-Item -ItemType Directory -Path $printsLocal | Out-Null
}

# Se a pasta local estiver vazia e existir bootstrap, inicializa uma vez
$localHasContent = @(Get-ChildItem -LiteralPath $printsLocal -Recurse -Force -ErrorAction SilentlyContinue | Where-Object { -not $_.PSIsContainer }).Count -gt 0
if (-not $localHasContent -and (Test-Path -LiteralPath $printsBootstrap)) {
  Copy-Item -Path (Join-Path $printsBootstrap "*") -Destination $printsLocal -Recurse -Force
}

if (Test-Path -LiteralPath $printsSource) {
  function Sync-TreePreferNewer {
    param(
      [Parameter(Mandatory = $true)][string]$SourceDir,
      [Parameter(Mandatory = $true)][string]$DestDir
    )

    $sourceRoot = (Resolve-Path -LiteralPath $SourceDir).Path
    $destRoot = $DestDir
    if (Test-Path -LiteralPath $DestDir) {
      $destRoot = (Resolve-Path -LiteralPath $DestDir).Path
    }

    if (-not $sourceRoot.EndsWith('\\')) { $sourceRoot += '\\' }
    if (-not $destRoot.EndsWith('\\')) { $destRoot += '\\' }

    if (-not (Test-Path -LiteralPath $destRoot)) {
      New-Item -ItemType Directory -Path $destRoot | Out-Null
    }

    Get-ChildItem -LiteralPath $sourceRoot -Recurse -Force | ForEach-Object {
      $full = $_.FullName
      if ($full.Length -lt $sourceRoot.Length) {
        return
      }

      $relative = $full.Substring($sourceRoot.Length)
      $destPath = Join-Path $destRoot $relative

      if ($_.PSIsContainer) {
        if (-not (Test-Path -LiteralPath $destPath)) {
          New-Item -ItemType Directory -Path $destPath | Out-Null
        }
        return
      }

      $shouldCopy = $true
      if (Test-Path -LiteralPath $destPath) {
        $destItem = Get-Item -LiteralPath $destPath
        # Só sobrescreve se a fonte for mais nova (ou seja, não apaga atualizações manuais no destino)
        $shouldCopy = ($_.LastWriteTimeUtc -gt $destItem.LastWriteTimeUtc)
      }

      if ($shouldCopy) {
        Copy-Item -LiteralPath $_.FullName -Destination $destPath -Force
      }
    }
  }

  # 1. Copia incremental para o site (src/projeto_centelha/prints)
  # Não removemos a pasta para evitar apagar prints adicionados manualmente.
  if (-not (Test-Path -LiteralPath $printsDest)) {
    New-Item -ItemType Directory -Path $printsDest | Out-Null
  }
  Sync-TreePreferNewer -SourceDir $printsSource -DestDir $printsDest
}

# Imagens locais do deck (ex.: img/cover.png)
$imgSource = Join-Path $pasta "img"
$imgDest = Join-Path $siteDir "img"
if (Test-Path -LiteralPath $imgSource) {
    if (-not (Test-Path -LiteralPath $imgDest)) {
        New-Item -ItemType Directory -Path $imgDest | Out-Null
    }

  # Copia arquivos e pastas, sem apagar tudo (evita falhar se um arquivo estiver em uso, ex: video rodando)
  Get-ChildItem -Path $imgSource | ForEach-Object {
    try {
      if ($_.PSIsContainer) {
        $destSubdir = Join-Path $imgDest $_.Name
        if (-not (Test-Path -LiteralPath $destSubdir)) {
          New-Item -ItemType Directory -Path $destSubdir | Out-Null
        }

        # Copiar CONTEÚDO da pasta (evita criar img/team/team quando já existe)
        Copy-Item -Path (Join-Path $_.FullName "*") -Destination $destSubdir -Recurse -Force -ErrorAction Stop

        # Limpeza de resíduo de cópia antiga (caso tenha criado pasta duplicada)
        $nested = Join-Path $destSubdir $_.Name
        if (Test-Path -LiteralPath $nested) {
          Remove-Item -LiteralPath $nested -Recurse -Force
        }
      } else {
        Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $imgDest $_.Name) -Force -ErrorAction Stop
      }
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
