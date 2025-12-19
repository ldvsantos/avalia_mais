#!/usr/bin/env pwsh
# Deploy manual - Execute no servidor via AWS Console Session Manager

$commands = @"
#!/bin/bash
cd /opt/planterr
echo "📥 Puxando últimas alterações do GitHub..."
git pull origin main

echo "📦 Instalando dependências..."
npm install --prefix server

echo "🔄 Reiniciando aplicação..."
pm2 restart planterr

echo "✅ Deploy concluído!"
echo "🌐 Acesse: http://18.222.198.84"
echo "🔐 Admin: http://18.222.198.84/secret/4a98a736-811d-447a-bfb3-6f4c2bc0dbc7/admin"

pm2 status
"@

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "   INSTRUÇÕES DE DEPLOY MANUAL" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "1️⃣  Acesse AWS Console:" -ForegroundColor Yellow
Write-Host "   https://console.aws.amazon.com/ec2`n"

Write-Host "2️⃣  Vá em: EC2 → Instances → Selecione a instância → Connect → Session Manager`n" -ForegroundColor Yellow

Write-Host "3️⃣  Cole e execute os comandos abaixo:`n" -ForegroundColor Yellow

Write-Host $commands -ForegroundColor Green

Write-Host "`n========================================`n" -ForegroundColor Cyan

# Salvar comandos em arquivo para fácil cópia
$commands | Out-File -FilePath "deploy-commands.sh" -Encoding UTF8
Write-Host "✅ Comandos salvos em: deploy-commands.sh" -ForegroundColor Green
Write-Host "   Você pode copiar deste arquivo também!`n"
