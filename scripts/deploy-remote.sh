#!/bin/bash
# Script de Deploy Remoto
# Execute este script no servidor AWS/EC2

echo "🚀 Iniciando deploy..."

# Navegar para o diretório do projeto
cd /opt/avalia || { echo "❌ Erro: Pasta /opt/avalia não encontrada"; exit 1; }

echo "📥 Baixando atualizações do GitHub..."
sudo git pull origin main || { echo "❌ Erro ao baixar atualizações"; exit 1; }

echo "📦 Instalando dependências (se houver novas)..."
cd server
npm ci --omit=dev

echo "🔄 Reiniciando aplicação..."
pm2 restart avalia

echo "✅ Deploy concluído com sucesso!"
echo "🌐 Acesse: https://avaliamais.tec.br"

pm2 status
