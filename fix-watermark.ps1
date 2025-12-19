$filePath = 'c:\Users\vidal\OneDrive\Documentos\13 - CLONEGIT\site_planter_projeto\server\src\infrastructure\services\PdfService.js'
$content = Get-Content $filePath -Raw -Encoding UTF8

# Adicionar doc.y = savedY antes do fechamento do if da marca d'água
$pattern1 = 'const savedY = doc.y;'
if ($content -notmatch [regex]::Escape($pattern1)) {
    # Adiciona savedY logo após hasUefs
    $content = $content -replace '(?ms)(const hasUefs = fs\.existsSync\(this\.uefsLogoPath\);[\r\n\s]+if \(hasUefs\) \{[\r\n\s]+)', "`$1        const savedY = doc.y;`r`n        "
}

# Restaura Y após desenhar marca d'água
$pattern2 = 'doc.y = savedY;'
if ($content -notmatch [regex]::Escape($pattern2)) {
    $content = $content -replace '(?ms)(doc\.opacity\(1\);[\r\n\s]+)(\}\s+// Logos no topo)', "`$1        doc.y = savedY;`r`n      `$2"
}

# Força Y=140 após logos do topo
$content = $content -replace '(?ms)(if \(hasPlanter\) \{[\r\n\s]+doc\.image\(this\.planterLogoPath[^\}]+\}[\r\n\s]+)(\/\/ Espaçamento após logos[\r\n\s]+doc\.moveDown\(4\);)', "`$1      doc.y = 140;`r`n`r`n      // Título`r`n      doc.moveDown(2);"

[System.IO.File]::WriteAllText($filePath, $content, [System.Text.UTF8Encoding]::new($false))
Write-Host "Arquivo editado com sucesso"
