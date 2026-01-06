# Configurações
$ServerIP = "13.59.96.218"
$User = "ubuntu"
$KeyPath = "$env:USERPROFILE\.ssh\planterr.pem"
$RemoteStage = "/home/ubuntu/stage_deploy"

Write-Host "🚀 Iniciando Deploy Manual para $ServerIP..." -ForegroundColor Cyan

# 1. Verificar Chave e Envio de Arquivos
if (-not (Test-Path $KeyPath)) { Write-Error "Key not found"; exit 1 }

ssh -i $KeyPath -o StrictHostKeyChecking=no $User@$ServerIP "rm -rf $RemoteStage && mkdir -p $RemoteStage"
scp -i $KeyPath -o StrictHostKeyChecking=no server/index.js "$User@$ServerIP`:$RemoteStage/index.js"
scp -i $KeyPath -o StrictHostKeyChecking=no -r src/apresentacao "$User@$ServerIP`:$RemoteStage/"

# 2. Comandos Remotos Simplificados
$Commands = @"
    echo '--- Aplicando Arquivos ---'
    sudo cp $RemoteStage/index.js /opt/avalia/server/index.js
    sudo rm -rf /opt/avalia/src/apresentacao
    sudo cp -r $RemoteStage/apresentacao /opt/avalia/src/
    
    echo '--- Permissoes ---'
    sudo chown -R ubuntu:ubuntu /opt/avalia
    sudo chmod -R 755 /opt/avalia

    echo '--- Reiniciando ---'
    pm2 stop avalia
    cd /opt/avalia/server
    pm2 delete avalia
    
    # Simple start
    pm2 start index.js --name avalia
    pm2 save
    
    echo 'FINISHED'
"@

ssh -i $KeyPath -o StrictHostKeyChecking=no $User@$ServerIP $Commands
Write-Host "✅ Done."
