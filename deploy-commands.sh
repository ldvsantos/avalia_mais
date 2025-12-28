#!/bin/bash
cd /opt/avalia
echo "📥 Puxando últimas alterações do GitHub..."
git pull origin main

echo "📦 Instalando dependências..."
npm install --prefix server

echo "🔄 Reiniciando aplicação..."
pm2 restart avalia

echo "✅ Deploy concluído!"
echo "🌐 Acesse: http://18.222.198.84"
echo "🔐 Admin: http://18.222.198.84/secret/4a98a736-811d-447a-bfb3-6f4c2bc0dbc7/admin"

pm2 status
