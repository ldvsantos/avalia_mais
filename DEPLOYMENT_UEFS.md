# Guia de Deployment no Domínio planterr.uefs.br

Este documento orienta passo a passo como hospedar o Sistema de Avaliação de Inscrições do PLANTERR no domínio institucional da UEFS.

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Pré-requisitos](#pré-requisitos)
3. [Etapa 1: Contato com TI da UEFS](#etapa-1-contato-com-ti-da-uefs)
4. [Etapa 2: Preparação Técnica](#etapa-2-preparação-técnica)
5. [Etapa 3: Instalação no Servidor](#etapa-3-instalação-no-servidor)
6. [Etapa 4: Configuração do Nginx](#etapa-4-configuração-do-nginx)
7. [Etapa 5: SSL/TLS com Certbot](#etapa-5-ssltls-com-certbot)
8. [Etapa 6: Monitoramento e Manutenção](#etapa-6-monitoramento-e-manutenção)
9. [Solução de Problemas](#solução-de-problemas)

---

## Visão Geral

O Sistema de Avaliação de Inscrições é uma aplicação Node.js que permite:
- Gerenciar inscrições (receber, validar, armazenar)
- Realizar avaliações com múltiplos avaliadores
- Gerar rankings e relatórios (CSV)
- Autenticação segura para acesso administrativo

**URL pretendida:** `https://inscricoes.planterr.uefs.br/`

### Arquitetura

```
Internet (HTTPS:443)
    ↓
Nginx (Reverse Proxy)
    ↓
Aplicação Node.js (Porta 3000, interna)
    ↓
Armazenamento JSON (server/data/)
```

---

## Pré-requisitos

### Para você (Coordenação/Gestor do PLANTERR)

- ✅ Repositório Git com acesso (este projeto)
- ✅ Credenciais de git (usuário e token/SSH)
- ✅ Capacidade de contatar STI da UEFS
- ✅ Documentação das regras de negócio (avaliação, pesos, etc.)

### Para TI da UEFS

- Node.js 18+ ou superior
- npm (gerenciador de pacotes)
- Nginx (servidor web/reverse proxy)
- Certbot (geração de certificado SSL)
- Acesso sudo no servidor
- ~512MB RAM mínimo
- ~100MB espaço em disco

---

## Etapa 1: Contato com TI da UEFS

### Passo 1.1: Identificar contato da STI

Procure por:
- **Email:** sti@uefs.br ou suporte@uefs.br
- **Portal:** Intranet UEFS → Serviços de TI
- **Telefone:** Ramal de TI (consultar coordenação do PLANTERR)

### Passo 1.2: Preparar solicitação

**Crie um e-mail ou abra um ticket com:**

```
ASSUNTO: Solicitação de Hospedagem - Sistema de Inscrições PLANTERR

CORPO:

Prezados,

Solicitamos suporte para hospedar um sistema web de gerenciamento de 
inscrições e avaliações para o processo seletivo do Programa de Pós-Graduação 
em Planejamento Territorial (PLANTERR).

INFORMAÇÕES DA SOLICITAÇÃO:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Domínio pretendido: inscricoes.planterr.uefs.br (ou subdomínio sugerido pela STI)
- Tipo de aplicação: Web Application (Node.js)
- Responsável técnico: [Seu Nome] ([seu email])
- Responsável administrativo: [Coordenador/a PLANTERR] ([email])

REQUISITOS TÉCNICOS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Node.js 18+ (ou versão mais recente)
✓ npm (já incluso com Node.js)
✓ Nginx ou Apache (reverse proxy)
✓ Certbot (certificado SSL/TLS)
✓ ~512 MB de RAM
✓ ~100 MB de espaço em disco
✓ Suporte a aplicações Node.js persistentes (PM2 ou systemd)

DESCRIÇÃO:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Sistema responsivo para:
1. Receber inscrições de candidatos
2. Gerenciar avaliações de até 3 avaliadores por fase
3. Calcular notas finais automaticamente
4. Gerar relatórios em CSV
5. Acesso administrativo por autenticação HTTP Basic

SEGURANÇA:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Helmet.js (proteção de headers HTTP)
- Rate limiting (proteção contra abuso)
- Validação de CPF
- Hash de integridade (verificação de dados)
- Autenticação admin via credenciais (configuráveis)
- HTTPS/TLS obrigatório

PRÓXIMOS PASSOS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Viabilidade técnica e aprovação
2. Alocação de recursos (servidor/VM/container)
3. Criação de registro DNS (A ou CNAME)
4. Acesso SSH para instalação
5. Apoio para configuração inicial

DOCUMENTAÇÃO:
O código-fonte está disponível no repositório Git (privado/público):
[URL do repositório]

Ficamos à disposição para esclarecimentos técnicos.

Atenciosamente,
[Seu Nome]
[Telefone]
[E-mail]
```

### Passo 1.3: Esclarecer expectativas

Pergunte à STI:

- [ ] Qual infraestrutura será usada? (VM, container, servidor físico)
- [ ] Qual o subdomínio recomendado?
- [ ] Como será fornecido acesso? (SSH, painel, outro)
- [ ] Qual o SLA (disponibilidade esperada)?
- [ ] Há política de backup?
- [ ] Quem gerencia certificados SSL?
- [ ] Prazo estimado para aprovação e setup?

---

## Etapa 2: Preparação Técnica

### Passo 2.1: Verificar código localmente

Certifique-se de que o projeto roda sem erros:

```bash
# No diretório do projeto
cd site_planter_projeto
cd server
npm install
npm start
```

Acesse: http://localhost:3000 (deve exibir formulário de inscrição)

### Passo 2.2: Criar arquivo .env (se usar)

Opcionalmente, crie um arquivo `.env.production` para armazenar variáveis:

```bash
# server/.env.production
NODE_ENV=production
PORT=3000
ADMIN_USER=admin_planterr_2025
ADMIN_PASS=SenhaSegura123!
HMAC_SECRET=chaveSecretaMuitoLongaEAleatoriaComPeloMenos32caracteres123456789
```

**⚠️ IMPORTANTE:** Nunca commitar este arquivo no Git. Adicione a `.gitignore`:

```bash
# No arquivo .gitignore
.env
.env.local
.env.production
server/.env*
```

### Passo 2.3: Verificar dependências

Confirme que `package.json` está completo:

```bash
cat server/package.json
```

Deve conter:
```json
{
  "name": "planterr-server",
  "version": "1.0.0",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "express": "^4.x",
    "helmet": "^7.x",
    "express-rate-limit": "^x.x"
  }
}
```

### Passo 2.4: Criar docker (opcional, mas recomendado)

Se TI usar Docker, crie `Dockerfile` na raiz:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
WORKDIR /app/server
RUN npm ci --production
EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "index.js"]
```

Teste localmente:

```bash
docker build -t planterr-inscricoes .
docker run -p 3000:3000 -e ADMIN_USER=admin -e ADMIN_PASS=senha planterr-inscricoes
```

### Passo 2.5: Documentação de entrega

Crie arquivo `README_DEPLOYMENT.txt`:

```
SISTEMA DE INSCRIÇÕES PLANTERR - GUIA DE DEPLOYMENT
════════════════════════════════════════════════════

ESTRUTURA DO PROJETO:
├── src/                    (Frontend estático - HTML/CSS/JS)
├── server/
│   ├── index.js           (Aplicação Express.js principal)
│   ├── storage.js         (Camada de persistência)
│   ├── util.js            (Utilitários e validações)
│   ├── package.json       (Dependências)
│   ├── data/              (Armazenamento JSON)
│   └── node_modules/      (Dependências instaladas)
└── README.md

INSTALAÇÃO RÁPIDA:
1. git clone [URL do repositório]
2. cd site_planter_projeto/server
3. npm install --production
4. NODE_ENV=production npm start

VARIÁVEIS DE AMBIENTE OBRIGATÓRIAS:
- ADMIN_USER: Usuário administrativo
- ADMIN_PASS: Senha administrativa
- HMAC_SECRET: Chave para hash de integridade (mín 32 caracteres)
- PORT: Porta (padrão: 3000)

ROTAS PRINCIPAIS:
- GET  /                    → Página de inscrição
- POST /api/submissions     → Enviar inscrição
- GET  /admin               → Painel administrativo (requer auth)
- GET  /committee           → Avaliações (requer auth)
- GET  /committee/results   → Ranking (requer auth)
```

---

## Etapa 3: Instalação no Servidor

### Passo 3.1: Conectar via SSH

Após receber acesso da STI:

```bash
ssh usuario@servidor.uefs.br
# Ou com chave:
ssh -i /caminho/para/chave usuario@servidor.uefs.br
```

### Passo 3.2: Atualizar o sistema

```bash
sudo apt update
sudo apt upgrade -y
```

### Passo 3.3: Instalar Node.js e npm

```bash
# Instalar Node.js 18+ (recomendado: 20 LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verificar instalação
node --version
npm --version
```

### Passo 3.4: Instalar Nginx e Certbot

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
sudo apt install -y git curl wget
```

### Passo 3.5: Clonar repositório

```bash
# Criar diretório para aplicação
sudo mkdir -p /var/www/planterr-inscricoes
sudo chown -R $USER:$USER /var/www/planterr-inscricoes

# Clonar repositório (usar deploy key ou token se privado)
git clone https://github.com/seu-usuario/site_planter_projeto.git /var/www/planterr-inscricoes
cd /var/www/planterr-inscricoes
```

### Passo 3.6: Instalar dependências Node

```bash
cd /var/www/planterr-inscricoes/server
npm install --production

# Verificar instalação
ls node_modules | head
```

### Passo 3.7: Configurar variáveis de ambiente

```bash
# Opção A: Via arquivo .env (se aplicação ler .env)
nano /var/www/planterr-inscricoes/server/.env

# Adicionar:
NODE_ENV=production
PORT=3000
ADMIN_USER=admin_planterr_2025
ADMIN_PASS=$(openssl rand -base64 16)  # Gera senha aleatória
HMAC_SECRET=$(openssl rand -base64 32) # Gera chave aleatória
```

**Ou Opção B: Via systemd environment**

```bash
sudo nano /etc/systemd/system/planterr.service
```

(Ver seção "Passo 3.8" abaixo)

### Passo 3.8: Instalar PM2 (gerenciador de processos)

```bash
sudo npm install -g pm2

# Iniciar aplicação com PM2
cd /var/www/planterr-inscricoes/server
pm2 start index.js --name "planterr-inscricoes" \
  --env "NODE_ENV=production" \
  --env "PORT=3000" \
  --env "ADMIN_USER=admin_planterr_2025" \
  --env "ADMIN_PASS=SenhaSegura123!" \
  --env "HMAC_SECRET=ChaveSecretaMuitoLongaEAleatoria123456789"

# Ou via arquivo de configuração PM2 (ecosystem.config.js)
pm2 start ecosystem.config.js

# Salvar configuração PM2 para reiniciar após reboot
pm2 startup systemd -u $USER --hp /home/$USER
pm2 save

# Verificar status
pm2 status
pm2 logs planterr-inscricoes
```

**Arquivo ecosystem.config.js (opcional):**

```javascript
module.exports = {
  apps: [
    {
      name: 'planterr-inscricoes',
      script: './index.js',
      cwd: '/var/www/planterr-inscricoes/server',
      instances: 1,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        ADMIN_USER: 'admin_planterr_2025',
        ADMIN_PASS: 'SenhaSegura123!',
        HMAC_SECRET: 'ChaveSecretaMuitoLongaEAleatoria123456789'
      }
    }
  ]
};
```

### Passo 3.9: Criar data directory com permissões

```bash
sudo mkdir -p /var/www/planterr-inscricoes/server/data
sudo chown -R nobody:nogroup /var/www/planterr-inscricoes/server/data
sudo chmod 755 /var/www/planterr-inscricoes/server/data

# Testar se aplicação consegue escrever
touch /var/www/planterr-inscricoes/server/data/test.txt
rm /var/www/planterr-inscricoes/server/data/test.txt
```

### Passo 3.10: Verificar se está rodando

```bash
# Verificar se processo PM2 está ativo
pm2 status

# Verificar se porta 3000 está aberta localmente
netstat -tlnp | grep 3000
# Ou:
curl http://localhost:3000

# Ver logs
pm2 logs planterr-inscricoes --lines 50
```

---

## Etapa 4: Configuração do Nginx

### Passo 4.1: Criar arquivo de configuração do Nginx

```bash
sudo nano /etc/nginx/sites-available/inscricoes.planterr.uefs.br
```

### Passo 4.2: Adicionar conteúdo (ANTES de SSL)

```nginx
# Configuração inicial (HTTP)
server {
    listen 80;
    listen [::]:80;
    
    server_name inscricoes.planterr.uefs.br;
    
    # Logs
    access_log /var/log/nginx/planterr-access.log;
    error_log /var/log/nginx/planterr-error.log warn;
    
    # Compressão
    gzip on;
    gzip_types text/plain text/css text/javascript application/json;
    gzip_min_length 1000;
    
    # Reverse proxy para aplicação Node.js
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        
        # Headers obrigatórios
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Não fazer cache
        proxy_cache_bypass $http_upgrade;
    }
    
    # Limite de tamanho de upload
    client_max_body_size 10M;
}
```

### Passo 4.3: Ativar o site

```bash
# Criar link simbólico
sudo ln -s /etc/nginx/sites-available/inscricoes.planterr.uefs.br \
           /etc/nginx/sites-enabled/

# Testar configuração
sudo nginx -t

# Recarregar Nginx
sudo systemctl reload nginx

# Verificar status
sudo systemctl status nginx
```

### Passo 4.4: Verificar acesso HTTP (antes do SSL)

```bash
# Localmente no servidor:
curl -H "Host: inscricoes.planterr.uefs.br" http://localhost

# Ou de fora (se já houver DNS):
curl http://inscricoes.planterr.uefs.br
```

---

## Etapa 5: SSL/TLS com Certbot

### Passo 5.1: Gerar certificado

```bash
sudo certbot certonly --nginx -d inscricoes.planterr.uefs.br

# Responder às perguntas:
# - Email: [seu email institucional]
# - Aceitar termos: Y
# - Compartilhar email: N (ou Y)
```

### Passo 5.2: Atualizar configuração Nginx com SSL

```bash
sudo nano /etc/nginx/sites-available/inscricoes.planterr.uefs.br
```

Substituir conteúdo por:

```nginx
# Redirecionar HTTP para HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name inscricoes.planterr.uefs.br;
    
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS (principal)
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    
    server_name inscricoes.planterr.uefs.br;
    
    # Certificados SSL
    ssl_certificate /etc/letsencrypt/live/inscricoes.planterr.uefs.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/inscricoes.planterr.uefs.br/privkey.pem;
    
    # Configuração SSL recomendada
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # HSTS (força HTTPS futuro)
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Logs
    access_log /var/log/nginx/planterr-access.log;
    error_log /var/log/nginx/planterr-error.log warn;
    
    # Compressão
    gzip on;
    gzip_types text/plain text/css text/javascript application/json;
    gzip_min_length 1000;
    
    # Reverse proxy
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    client_max_body_size 10M;
}
```

### Passo 5.3: Recarregar Nginx

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### Passo 5.4: Configurar renovação automática

```bash
# Certbot já configura isso, mas verificar:
sudo systemctl status certbot.timer

# Ver renovações agendadas:
sudo certbot renew --dry-run
```

### Passo 5.5: Testar HTTPS

```bash
curl https://inscricoes.planterr.uefs.br/

# Ou acessar no navegador:
# https://inscricoes.planterr.uefs.br/
```

---

## Etapa 6: Monitoramento e Manutenção

### Passo 6.1: Verificar status diário

```bash
# Status da aplicação
pm2 status
pm2 logs planterr-inscricoes --lines 20

# Status do Nginx
sudo systemctl status nginx

# Uso de recursos
free -h
df -h
top -n1 | head -20
```

### Passo 6.2: Backup automático

Crie script `/usr/local/bin/backup-planterr.sh`:

```bash
#!/bin/bash

BACKUP_DIR="/var/backups/planterr"
SOURCE_DIR="/var/www/planterr-inscricoes"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup de dados
tar -czf $BACKUP_DIR/planterr-data-$DATE.tar.gz $SOURCE_DIR/server/data/

# Manter apenas últimos 30 dias
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete

echo "Backup realizado: $DATE"
```

Dar permissão:

```bash
sudo chmod +x /usr/local/bin/backup-planterr.sh

# Agendar no crontab (diário às 3 da manhã)
sudo crontab -e

# Adicionar linha:
0 3 * * * /usr/local/bin/backup-planterr.sh >> /var/log/planterr-backup.log 2>&1
```

### Passo 6.3: Monitoramento de certificado SSL

```bash
# Verificar data de expiração
echo | openssl s_client -servername inscricoes.planterr.uefs.br \
  -connect inscricoes.planterr.uefs.br:443 2>/dev/null | \
  openssl x509 -noout -dates

# Ou:
certbot certificates
```

### Passo 6.4: Logs e diagnósticos

```bash
# Logs da aplicação
tail -f /var/log/pm2/planterr-inscricoes.log

# Logs do Nginx
sudo tail -f /var/log/nginx/planterr-error.log
sudo tail -f /var/log/nginx/planterr-access.log

# Verificar erros de sintaxe Node
cd /var/www/planterr-inscricoes/server
node -c index.js
```

### Passo 6.5: Atualizar aplicação

```bash
cd /var/www/planterr-inscricoes

# Buscar atualizações
git fetch origin
git pull origin main  # ou main/master, conforme seu padrão

# Reinstalar dependências (se necessário)
cd server
npm install --production

# Reiniciar aplicação
pm2 restart planterr-inscricoes

# Verificar
pm2 logs planterr-inscricoes --lines 5
```

---

## Solução de Problemas

### Problema: Aplicação não inicia

**Sintomas:** `pm2 status` mostra status "stopped" ou "errored"

**Solução:**

```bash
# Ver logs detalhados
pm2 logs planterr-inscricoes --lines 100

# Tentar iniciar manualmente para ver erros
cd /var/www/planterr-inscricoes/server
node index.js

# Verificar se porta 3000 está livre
sudo lsof -i :3000
```

### Problema: 502 Bad Gateway no Nginx

**Sintomas:** Erro ao acessar https://inscricoes.planterr.uefs.br/

**Solução:**

```bash
# Verificar se aplicação está rodando
pm2 status

# Verificar se porta 3000 está aberta
netstat -tlnp | grep 3000

# Verificar logs do Nginx
sudo tail -50 /var/log/nginx/planterr-error.log

# Reiniciar Nginx
sudo systemctl restart nginx

# Verificar sintaxe
sudo nginx -t
```

### Problema: Certificado SSL expirado

**Sintomas:** Aviso de certificado inválido no navegador

**Solução:**

```bash
# Renovar certificado
sudo certbot renew --force-renewal -d inscricoes.planterr.uefs.br

# Recarregar Nginx
sudo systemctl reload nginx
```

### Problema: Dados não persistem entre reinicializações

**Sintomas:** Inscrições desaparecem após reiniciar servidor

**Solução:**

```bash
# Verificar se diretório de dados tem permissões corretas
ls -la /var/www/planterr-inscricoes/server/data/

# Deve ser:
# drwxr-xr-x ou drwx--x---

# Se necessário, corrigir:
sudo chmod 755 /var/www/planterr-inscricoes/server/data
sudo chown nobody:nogroup /var/www/planterr-inscricoes/server/data

# Verificar se arquivo tem conteúdo
cat /var/www/planterr-inscricoes/server/data/submissions.json | head
```

### Problema: Muitas requisições são bloqueadas

**Sintomas:** Taxa de rejeição alta ou usuários reportam "Too many requests"

**Solução:**

```bash
# Aumentar limite de rate limiting em server/index.js
# Padrão: 60 requisições por 15 minutos

# Ou aguardar 15 minutos (ou tempo configurado)
# ou fazer reset do servidor
pm2 restart planterr-inscricoes
```

### Problema: Falta de espaço em disco

**Sintomas:** `pm2 logs` para de funcionar ou aplicação falha ao salvar dados

**Solução:**

```bash
# Verificar espaço disponível
df -h

# Limpar backups antigos
sudo rm /var/backups/planterr/*-* -f

# Compactar logs grandes
sudo gzip /var/log/nginx/planterr-*.log

# Arquivar dados antigos (se tiver política de retenção)
tar -czf /var/backups/planterr-dados-$(date +%Y).tar.gz \
  /var/www/planterr-inscricoes/server/data/
```

---

## Checklist Final

Antes de liberar para uso em produção:

- [ ] Aplicação rodando com PM2
- [ ] Nginx reverse proxy configurado
- [ ] HTTPS/SSL funcionando
- [ ] Certificado válido
- [ ] Backup automático configurado
- [ ] Variáveis de ambiente seguras (senhas fortes)
- [ ] Dados persistindo corretamente
- [ ] Logs funcionando
- [ ] Acesso admin testado (http://inscricoes.planterr.uefs.br/admin)
- [ ] Formulário de inscrição testado
- [ ] Avaliações testadas
- [ ] CSV de exportação testado
- [ ] Equipe do PLANTERR treinada

---

## Contatos Úteis

- **Suporte STI UEFS:** sti@uefs.br
- **Coordenação PLANTERR:** [contato da coordenação]
- **Responsável Técnico:** [seu contato]

---

## Referências

- [Documentação Node.js](https://nodejs.org/docs/)
- [Express.js](https://expressjs.com/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [Certbot](https://certbot.eff.org/)
- [PM2](https://pm2.keymetrics.io/)

---

**Última atualização:** dezembro de 2025  
**Versão:** 1.0
