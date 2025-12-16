# 🔐 Implementações de Segurança - PLANTERR

## ✅ O que foi implementado

Este projeto agora possui **múltiplas camadas de segurança** contra invasões, ataques e acesso não autorizado.

### 1. **Camuflar Rotas Administrativas com UUID** ✨ DESTAQUE

Todas as rotas administrativas foram **movidas para um UUID aleatório**:

```
ANTES (Vulnerável):
  /admin                    → Fácil descobrir
  /committee                → Fácil descobrir
  /committee/results        → Exposição de funcionalidade

AGORA (Seguro):
  /secret/{UUID-ALEATÓRIO}/admin
  /secret/{UUID-ALEATÓRIO}/committee
  /secret/{UUID-ALEATÓRIO}/committee/results
  /secret/{UUID-ALEATÓRIO}/committee/evaluate/:protocol
```

**O UUID é gerado na primeira execução e armazenado em `server/.admin-secret`**

```bash
# Ao iniciar o servidor, você verá:
⚠️  ADMIN SECRET CRIADO - SALVE EM LOCAL SEGURO
=======================================================================
UUID Administrativo (salve em cofre seguro):

   a7b9c2d1-e4f6-8g9h-0i1j-k2l3m4n5o6p7

URL de acesso:

   http://localhost:3000/secret/a7b9c2d1-e4f6-8g9h-0i1j-k2l3m4n5o6p7/admin
```

**Scanners automáticos não conseguem descobrir este UUID.**

---

### 2. **Autenticação JWT Segura** 🔑

Substituído **HTTP Basic Auth** (credenciais em Base64) por **JWT tokens**:

#### Login seguro:
```bash
POST /secret/{UUID}/login
Content-Type: application/json

{
  "username": "admin",
  "password": "sua_senha_super_segura"
}

RESPOSTA:
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": "2h"
}
```

#### Endpoints autenticados agora requerem:
```
Authorization: Bearer {token}
```

**Características de segurança:**
- ✅ Tokens expiram em 2 horas
- ✅ Token vinculado ao IP do usuário
- ✅ Não armazenado em localStorage (XSS-safe)
- ✅ Armazenado em sessão segura com HttpOnly

---

### 3. **Rate Limiting Agressivo** ⏱️

Proteção contra força bruta e DDoS:

```javascript
// 5 tentativas de login por 15 minutos (depois bloqueia)
POST /secret/{UUID}/login  → Max 5 tentativas/15min

// 100 requisições gerais por IP/15min
GET /                      → Max 100 req/15min

// 30 requisições de API por minuto
POST /api/submissions      → Max 30 req/1min
```

**Ataque bloqueado automaticamente após limite excedido**

---

### 4. **Headers de Segurança HTTP** 🛡️

Implementado **Helmet.js** com configuração robusta:

```
✅ Content-Security-Policy    → Bloqueia injeção de scripts
✅ X-Frame-Options: DENY       → Bloqueia clickjacking
✅ X-Content-Type-Options     → Bloqueia MIME sniffing
✅ Strict-Transport-Security  → Força HTTPS (1 ano)
✅ Referrer-Policy            → Não vaza URLs
✅ Permissions-Policy         → Bloqueia acesso a câmera, microfone, geolocalização
```

---

### 5. **Detecção de Padrões de Ataque** 🚨

Detecta e bloqueia automaticamente:

```
✅ SQL Injection       → UNION SELECT, DROP TABLE, etc.
✅ NoSQL Injection     → $where, $ne, $gt, etc.
✅ XSS Attacks         → <script>, javascript:, eval()
✅ Path Traversal      → ../../etc/passwd, %2e%2e/
✅ Command Injection   → cat, ls, rm, curl; nc
```

**Resposta:** Bloqueio imediato com status 403

---

### 6. **CORS Restritivo** 🌐

Apenas origins permitidas podem acessar a API:

```bash
# Configure em .env:
ALLOWED_ORIGINS=https://inscricoes.planterr.uefs.br,https://admin.planterr.uefs.br
```

**Requisições de outros domínios são rejeitadas**

---

### 7. **IP Whitelist para Admin** 🔒

Apenas IPs confiáveis podem acessar área administrativa:

```bash
# Configure em .env:
ADMIN_IPS=192.168.1.100,203.0.113.50,2001:db8::1
```

**Requisições de outros IPs recebem erro 403**

---

### 8. **Logging de Segurança** 📋

Todos os eventos de segurança são registrados em `server/logs/`:

```bash
server/logs/
├── security.log    → Todos os eventos de segurança
└── error.log       → Erros e exceções
```

**Eventos registrados:**
- ✅ Login bem-sucedido/falho
- ✅ Tentativas de acesso não autorizado
- ✅ Padrões de ataque detectados
- ✅ Limite de taxa excedido
- ✅ Ações administrativas
- ✅ Exportação de dados

**Governança (controle de modificações):**
- ✅ Criação/alteração de inscrições (`SUBMISSION_CREATED`, `SUBMISSION_MODIFIED`)
- ✅ Criação/alteração de avaliações (`EVALUATION_CREATED`, `EVALUATION_MODIFIED`)
- ✅ Alterações de configuração (`CONFIG_MODIFIED`)

**Correlação:** cada resposta inclui `X-Request-Id`, que também aparece nos eventos do `security.log`.

---

### 9. **Validação e Sanitização** ✨

Todas as entradas são validadas:

```javascript
✅ Comprimento máximo
✅ Caracteres permitidos
✅ Tipo de dado esperado
✅ Escape HTML na saída
✅ Prevenção de XSS
```

---

### 10. **Proteção contra Timeout** ⏳

Requisições muito longas são terminadas:

```javascript
// Timeout de 30 segundos
Requisições sem resposta → Erro 408
```

---

## 📁 Arquivos de Segurança Criados

```
server/
├── admin-secret.js           → Geração/gerenciamento de UUID
├── security-logger.js        → Logging estruturado de eventos
├── security-middleware.js    → Middlewares de segurança
└── logs/                      → Arquivos de log (gitignore)
    ├── security.log
    └── error.log

projeto-root/
├── .env.example              → Modelo de configurações
├── .admin-secret             → ⚠️ NUNCA commitar (gitignore)
└── SECURITY_HARDENING.md     → Guia completo de segurança
```

---

## 🔧 Como Configurar

### 1. Copiar `.env.example`

```bash
cp .env.example .env
```

### 2. Editar `.env` com seus valores

```bash
# Autenticação
ADMIN_USER=seu_usuario
ADMIN_PASS=sua_senha_super_segura_e_longa

# Segurança - MUDE EM PRODUÇÃO
JWT_SECRET=gere_uma_string_aleatoria_muito_longa_aqui
HMAC_SECRET=outra_string_aleatoria_muito_longa_aqui

# IP Whitelist (apenas produção)
ADMIN_IPS=203.0.113.50,2001:db8::1

# CORS
ALLOWED_ORIGINS=https://inscricoes.planterr.uefs.br
```

### 3. Instalar dependências

```bash
cd server
npm install
```

### 4. Executar servidor

```bash
npm start
```

Você verá o UUID ao iniciar:
```
⚠️  ADMIN SECRET CRIADO - SALVE EM LOCAL SEGURO
UUID: a7b9c2d1-e4f6-8g9h-0i1j-k2l3m4n5o6p7
```

---

## 🚀 Acessar a Área Admin

### Desenvolvimento

```
1. Acesse: http://localhost:3000/secret/{SEU-UUID}/login
2. Entre com:
   Username: (valor de ADMIN_USER em .env)
   Password: (valor de ADMIN_PASS em .env)
3. Copie o token JWT
4. Use em requisições:
   Authorization: Bearer {token}
```

### Produção (UEFS)

```
1. Acesse: https://inscricoes.planterr.uefs.br/secret/{UUID-SECRETO}/login
2. UUID deve ser guardado em cofre seguro (LastPass, 1Password, Vault)
3. Trocar senha ADMIN_PASS regularmente
4. Habilitar 2FA (opcional, documentado em SECURITY_HARDENING.md)
```

---

## 📊 Monitoramento de Logs

### Ver logs em tempo real

```bash
# Logs de segurança
tail -f server/logs/security.log

# Logs de erro
tail -f server/logs/error.log

# Filtrar apenas ataques detectados
grep "ATTACK_PATTERN_DETECTED" server/logs/security.log

# Filtrar apenas login
grep "LOGIN" server/logs/security.log
```

### Analisar tentativas suspeitas

```bash
# Tentativas de login falhadas
grep "LOGIN_FAILED" server/logs/security.log | wc -l

# IPs que tentaram acessar
grep "UNAUTHORIZED_ACCESS" server/logs/security.log | grep -oE '\b[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\b' | sort | uniq -c
```

---

## ⚠️ Checklist de Segurança

### Antes de Deploy

- [ ] ✅ UUID administrativo gerado e guardado em cofre seguro
- [ ] ✅ HTTPS obrigatório (não usar HTTP em produção)
- [ ] ✅ `.env` nunca foi commitado no Git
- [ ] ✅ `.admin-secret` adicionado ao `.gitignore`
- [ ] ✅ Trocar `ADMIN_USER` e `ADMIN_PASS` de padrão
- [ ] ✅ Gerar novo `JWT_SECRET` (string aleatória longa)
- [ ] ✅ Gerar novo `HMAC_SECRET` (string aleatória longa)
- [ ] ✅ Configurar `ADMIN_IPS` whitelist
- [ ] ✅ Configurar `ALLOWED_ORIGINS` para domínios permitidos

### Pós-Deploy

- [ ] ✅ Testar login em `/secret/{UUID}/login`
- [ ] ✅ Verificar logs em `server/logs/security.log`
- [ ] ✅ Confirmar rate limiting bloqueando requisições excessivas
- [ ] ✅ Testar acesso a `/admin` (deve retornar 404)
- [ ] ✅ Testar acesso a `/committee` (deve retornar 404)
- [ ] ✅ Certificado SSL válido
- [ ] ✅ Backups automáticos configurados
- [ ] ✅ Monitoramento de logs ativo

---

## 🔄 Atualizar Configurações

### Trocar Senha Admin

```bash
# Editar .env
ADMIN_PASS=nova_senha_super_segura

# Reiniciar servidor
npm restart
```

### Gerar novo UUID

```bash
# Remover arquivo antigo
rm server/.admin-secret

# Reiniciar servidor (vai gerar novo UUID)
npm restart

# Copiar novo UUID de local seguro
```

### Adicionar novo IP ao Whitelist

```bash
# Editar .env
ADMIN_IPS=203.0.113.50,203.0.113.51,2001:db8::1

# Reiniciar servidor
npm restart
```

---

## 📚 Documentação Complementar

Para detalhes técnicos completos, veja:
- **[SECURITY_HARDENING.md](./SECURITY_HARDENING.md)** → Guia técnico completo
- **[.env.example](./.env.example)** → Todas as variáveis de ambiente
- **[server/security-logger.js](./server/security-logger.js)** → API de logging
- **[server/security-middleware.js](./server/security-middleware.js)** → Middlewares implementados

---

## 🆘 Troubleshooting

### Erro: "HTTPS obrigatório"

**Solução:** Em produção, usar HTTPS. Em desenvolvimento, remover check ou usar `X-Forwarded-Proto` header.

### Erro: "IP não autorizado"

**Solução:** Adicionar seu IP a `ADMIN_IPS` em `.env`

### Erro: "Rate limit exceeded"

**Solução:** Aguardar 15 minutos ou reiniciar servidor

### Token expirado após 2 horas

**Solução:** Fazer login novamente em `/secret/{UUID}/login`

---

## 📞 Contato e Suporte

Para questões de segurança:
1. Não publicar vulnerabilidade publicamente
2. Contatar `seguranca@planterr.uefs.br`
3. Descrever o problema detalhadamente
4. Aguardar resposta em até 48 horas

---

**Última atualização:** 15 de dezembro de 2025  
**Versão:** 1.0 - Implementações Completas  
**Status:** ✅ Produção-Ready
