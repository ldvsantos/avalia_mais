# Script para gerar PDF da apresentação Reveal.js usando DeckTape
# Este script instala e usa o DeckTape via npm

$apresentacao = "tema04_apresentacao.html"
$pdfOutput = "tema04_apresentacao.pdf"

# Caminho completo
$caminhoCompleto = Join-Path $PSScriptRoot $apresentacao
$pdfCompleto = Join-Path $PSScriptRoot $pdfOutput

Write-Host "Verificando se o Node.js está instalado..." -ForegroundColor Cyan

# Verifica se o Node.js está instalado
try {
    $nodeVersion = node --version 2>$null
    if ($nodeVersion) {
        Write-Host "Node.js encontrado: $nodeVersion" -ForegroundColor Green
    }
} catch {
    Write-Host "Node.js não encontrado. Por favor, instale o Node.js de https://nodejs.org/" -ForegroundColor Red
    exit 1
}

# Verifica se o DeckTape está instalado globalmente
$deckTapeInstalled = $false
try {
    $null = Get-Command decktape -ErrorAction Stop
    $deckTapeInstalled = $true
    Write-Host "DeckTape já instalado." -ForegroundColor Green
} catch {
    Write-Host "DeckTape não encontrado. Instalando..." -ForegroundColor Yellow
    npm install -g decktape
    if ($LASTEXITCODE -eq 0) {
        $deckTapeInstalled = $true
        Write-Host "DeckTape instalado com sucesso!" -ForegroundColor Green
    } else {
        Write-Host "Erro ao instalar DeckTape." -ForegroundColor Red
        exit 1
    }
}

if ($deckTapeInstalled) {
    Write-Host "Gerando PDF da apresentação..." -ForegroundColor Cyan
    
    # Usa DeckTape para gerar o PDF
    $fileUrl = "file:///$($caminhoCompleto.Replace('\', '/'))"
    
    decktape reveal $fileUrl $pdfCompleto --size 1280x720
    
    Start-Sleep -Seconds 2
    
    if (Test-Path $pdfCompleto) {
        Write-Host "PDF gerado com sucesso: $pdfOutput" -ForegroundColor Green
        Write-Host "Abrindo PDF..." -ForegroundColor Cyan
        Start-Process $pdfCompleto
    } else {
        Write-Host "Erro ao gerar PDF." -ForegroundColor Red
    }
}
