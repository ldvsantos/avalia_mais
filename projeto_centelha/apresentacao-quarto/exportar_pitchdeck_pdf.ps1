Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$pasta = Split-Path -Parent $MyInvocation.MyCommand.Path
$pptx = Join-Path $pasta "PITCH_DECK.pptx"
$pdf = Join-Path $pasta "PITCH_DECK.pdf"

if (-not (Test-Path -LiteralPath $pptx)) {
  throw "Arquivo PPTX não encontrado em $pptx"
}

$powerPoint = $null
$apresentacao = $null

try {
  $powerPoint = New-Object -ComObject PowerPoint.Application
  $powerPoint.Visible = [Microsoft.Office.Core.MsoTriState]::msoTrue

  $apresentacao = $powerPoint.Presentations.Open(
    $pptx,
    [Microsoft.Office.Core.MsoTriState]::msoTrue,
    [Microsoft.Office.Core.MsoTriState]::msoFalse,
    [Microsoft.Office.Core.MsoTriState]::msoTrue
  )

  if (Test-Path -LiteralPath $pdf) {
    Remove-Item -LiteralPath $pdf -Force
  }

  $ppSaveAsPDF = 32
  $apresentacao.SaveAs($pdf, $ppSaveAsPDF)

} finally {
  if ($apresentacao -ne $null) {
    $apresentacao.Close()
  }
  if ($powerPoint -ne $null) {
    $powerPoint.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($powerPoint) | Out-Null
  }
}

if (-not (Test-Path -LiteralPath $pdf)) {
  throw "Falha ao gerar PDF em $pdf"
}

Get-Item -LiteralPath $pdf | Select-Object Name, Length, FullName
