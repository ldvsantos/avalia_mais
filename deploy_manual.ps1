# Configurações
$ServerIP = "13.59.96.218"
$User = "ubuntu"
$KeyPath = "$env:USERPROFILE\.ssh\planterr.pem"
$RemoteStage = "/home/ubuntu/stage_deploy"

Write-Host "🚀 Iniciando Deploy Manual para $ServerIP..." -ForegroundColor Cyan

# 1. Verificar Chave
if (-not (Test-Path $KeyPath)) {
    Write-Error "❌ Chave PEM não encontrada em: $KeyPath"
    exit 1
}

# 2. Criar pasta de staging remota
Write-Host "📂 Criando diretório temporário no servidor..."
ssh -i $KeyPath -o StrictHostKeyChecking=no $User@$ServerIP "rm -rf $RemoteStage && mkdir -p $RemoteStage"

# 3. Enviar Index.js atualizado
Write-Host "📤 Enviando server/index.js..."
scp -i $KeyPath -o StrictHostKeyChecking=no server/index.js "$User@$ServerIP`:$RemoteStage/index.js"

# 4. Enviar pasta de apresentação
Write-Host "📤 Enviando pasta src/apresentacao (isso pode levar alguns segundos)..."
scp -i $KeyPath -o StrictHostKeyChecking=no -r src/apresentacao "$User@$ServerIP`:$RemoteStage/"

# 5. Aplicar mudanças e reiniciar
Write-Host "🔄 Movendo arquivos e reiniciando PM2..."
$Commands = "
    echo '--- Aplicando Arquivos ---'
    sudo cp $RemoteStage/index.js /opt/avalia/server/index.js
    sudo rm -rf /opt/avalia/src/apresentacao
    sudo cp -r $RemoteStage/apresentacao /opt/avalia/src/
    
    echo '--- Corrigindo Permissões ---'
    sudo chown -R ubuntu:ubuntu /opt/avalia
    sudo chmod -R 755 /opt/avalia
    
    echo '--- Verificando .env ---'
    if [ ! -f /opt/avalia/server/.env ]; then
        echo 'WARN: .env not found in /opt/avalia/server. Searching...'
        sudo find /opt -maxdepth 4 -name '.env' -exec cp {} /opt/avalia/server/.env \; -quit
    fi
    
    echo '--- Reiniciando Servidor ---'
    pm2 stop avalia
    cd /opt/avalia/server
    pm2 delete avalia
    
    # Garantir que as variáveis de ambiente carreguem corretamente
    pm2 start index.js --name avalia
    pm2 save
    
    echo 'DEPLOY FINISHED'
"

ssh -i $KeyPath -o StrictHostKeyChecking=no $User@$ServerIP $Commands

Write-Host "🌍 Teste o acesso: https://avaliamais.tec.br/apresentacao/index.html" -ForegroundColor Green