# Guia de Deployment na AWS (Tudo junto: Front + API) — sem domínio (via IP)

Este guia hospeda **tudo no mesmo servidor**:
- Nginx na porta **80** (HTTP público)
- Node.js/Express na porta **3000** (somente local)
- Frontend estático servido pelo próprio Node (como já funciona localmente)

> Observação importante: **sem domínio** você não consegue emitir certificado Let's Encrypt/Certbot para HTTPS. Você pode:
> - começar em HTTP usando o **IP público**;
> - depois, quando tiver domínio, ativar HTTPS com Certbot (o guia abaixo já deixa o Nginx pronto para isso).

---

## 1) Criar servidor na AWS

### Recomendação (mais simples): Lightsail
- Crie uma instância Linux (Ubuntu 22.04)
- Anexe um **Static IP**
- Firewall (Networking): liberar
  - TCP **22** (SSH)
  - TCP **80** (HTTP)
  - (opcional por enquanto) TCP **443** (HTTPS, quando tiver domínio)

> Dica: **não** exponha a porta 3000 publicamente.

(Alternativa) EC2 também funciona igual. O procedimento no Linux é o mesmo.

---

## 2) Acessar por SSH

No Windows (PowerShell), exemplo:

```powershell
ssh -i "C:\caminho\sua-chave.pem" ubuntu@SEU_IP_PUBLICO
```

---

## 3) Instalar dependências do sistema

No servidor:

```bash
sudo apt update
sudo apt install -y git nginx

# Node 18 (alinhado ao projeto)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# PM2 (para manter o Node rodando)
sudo npm i -g pm2
```

---

## 4) Clonar e instalar o projeto

Sugestão de pasta:

```bash
sudo mkdir -p /opt/planterr
sudo chown -R $USER:$USER /opt/planterr

git clone SEU_REPO_GIT /opt/planterr
cd /opt/planterr/server
npm ci --omit=dev
```

---

## 5) Configurar variáveis de ambiente (produção)

Crie um arquivo local no servidor (NÃO versionar no git):

```bash
sudo nano /opt/planterr/server/.env
```

Conteúdo sugerido:

```bash
NODE_ENV=production
PORT=3000

# Troque em produção
ADMIN_USER=admin
ADMIN_PASS=troque-uma-senha-forte

# Obrigatório (evita duplicidade por CPF e protege hash)
HMAC_SECRET=coloque-uma-chave-longa-aleatoria-com-32+caracteres

# Recomendado fixar para não invalidar tokens a cada restart
JWT_SECRET=outra-chave-longa-aleatoria-com-32+caracteres

# Opcional: restringir admin por IP (csv)
# ADMIN_IPS=200.128.10.10,200.128.10.11

# Opcional: CORS (se for usar chamadas externas)
# ALLOWED_ORIGINS=https://seu-dominio-futuro

# Opcional (recomendado só com HTTPS + cert válido): habilita HSTS
# ENABLE_HSTS=true
```

---

## 6) Subir o Node com PM2

Carregue as variáveis e inicie:

```bash
cd /opt/planterr/server
set -a
source ./.env
set +a

pm2 start index.js --name planterr
pm2 save
pm2 startup
```

O comando `pm2 startup` vai imprimir uma linha que você precisa rodar com `sudo`.

Verifique se respondeu localmente:

```bash
curl -i http://127.0.0.1:3000/api/registration-window
```

---

## 7) Configurar Nginx (HTTP via IP)

Crie o arquivo:

```bash
sudo nano /etc/nginx/sites-available/planterr
```

Conteúdo (sem domínio):

```nginx
server {
    listen 80;
    listen [::]:80;

    # Sem domínio, respondemos por IP.
    server_name _;

    # Logs úteis
    access_log /var/log/nginx/planterr.access.log;
    error_log  /var/log/nginx/planterr.error.log;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        # Headers para o Node entender IP/HTTPS atrás do proxy
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Websocket/upgrade (não deve ser necessário aqui, mas é seguro)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Ative e recarregue:

```bash
sudo ln -sf /etc/nginx/sites-available/planterr /etc/nginx/sites-enabled/planterr
sudo nginx -t
sudo systemctl reload nginx
```

Agora abra no navegador:
- `http://SEU_IP_PUBLICO/`

> Se você vir `net::ERR_CONNECTION_REFUSED` tentando carregar `style.css`, `script.js`, etc, confirme que está abrindo **http://** (não https://) e que o servidor não está forçando upgrade para HTTPS via headers.

---

## 8) Onde ver o ADMIN SECRET

O UUID secreto fica persistido em:
- `/opt/planterr/server/.admin-secret`

Você pode visualizar com cuidado:

```bash
cat /opt/planterr/server/.admin-secret
```

A URL admin fica:
- `http://SEU_IP_PUBLICO/secret/{UUID}/admin`

---

## 9) Backup (essencial)

Os dados ficam em:
- `/opt/planterr/server/data/`

Faça backup periódico (exemplo simples):

```bash
sudo tar -czf /opt/planterr-backup-$(date +%F).tgz /opt/planterr/server/data /opt/planterr/server/.admin-secret
```

---

## 10) Quando você tiver domínio (migrar para HTTPS)

1) Aponte o DNS (A record) para o IP
2) Instale e rode certbot:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d SEU_DOMINIO
```

Depois disso, você pode:
- liberar **443** no firewall
- (opcional) redirecionar 80 → 443

---

## Diagnóstico rápido

- Status do app:
  - `pm2 status`
  - `pm2 logs planterr --lines 200`
- Status do Nginx:
  - `sudo systemctl status nginx --no-pager`
- Porta local do Node:
  - `sudo ss -lntp | grep 3000`
