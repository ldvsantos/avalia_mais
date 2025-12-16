# ⚠️ PRÓXIMOS PASSOS - Implementação de Segurança

## Situação Atual

O arquivo `server/index.js` ficou corrompido durante as edições em lote. As alterações de segurança **foram criadas e estão prontas**, mas precisam ser aplicadas **manualmente** ao arquivo principal.

## Arquivos de Segurança Criados ✅

```
server/
├── admin-secret.js              ✅ Gerador de UUID (NOVO)
├── security-logger.js           ✅ Sistema de logs (NOVO)
├── security-middleware.js       ✅ Middlewares de segurança (NOVO)
└── package.json                 ✅ Dependências instaladas

projeto-root/
├── SECURITY_HARDENING.md        ✅ Guia completo (NOVO)
├── SECURITY_IMPLEMENTATION.md   ✅ Guia prático (NOVO)
├── .env.example                 ✅ Configurações (NOVO)
└── .gitignore                   ✅ Atualizado
```

## O que precisa ser feito

### Opção 1: Restaurar index.js e Reapplicar (Recomendado)

```bash
# 1. Restaurar arquivo do Git
git checkout server/index.js

# 2. Então aplicar mudanças manualmente usando o padrão:
#    - Adicionar imports novos no topo
#    - Substituir basicAuth() por adminAuth()
#    - Camuflar rotas com UUID
```

### Opção 2: Manual - Editar index.js Manualmente

Se preferir editar manualmente, copie e cole as seções abaixo:

#### 1. **Adicione no início do arquivo (após os requires)**

```javascript
const cors = require('cors');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');

const { generateOrReadAdminSecret } = require('./admin-secret');
const {
  securityLogger,
  logLoginSuccess,
  logLoginFailed,
  logUnauthorizedAccess,
  logAttackDetected,
  logAdminAction,
  logDataExport,
} = require('./security-logger');
const {
  detectAttackPatterns,
  securityHeaders,
  enforceHTTPS,
  verifyJWT,
  validateIPWhitelist,
  getClientIP,
  sanitizeInput,
  validateInput,
} = require('./security-middleware');
```

#### 2. **Adicione após definição de constantes**

```javascript
const ADMIN_SECRET = generateOrReadAdminSecret();
const ADMIN_IPS = (process.env.ADMIN_IPS || '').split(',').map(ip => ip.trim()).filter(ip => ip);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim()).filter(o => o);
const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-change-in-production-' + Math.random().toString(36);
```

#### 3. **Substitua `function basicAuth()` por:**

```javascript
function adminAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : req.session.token;
  
  if (!token) {
    return res.status(401).json({ error: 'Autenticação necessária' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (err) {
    logUnauthorizedAccess(req.path, getClientIP(req), req.method, { error: err.message });
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

function checkAdminIP(req, res, next) {
  if (ADMIN_IPS.length === 0) return next();
  
  const clientIP = getClientIP(req);
  if (!ADMIN_IPS.includes(clientIP)) {
    logUnauthorizedAccess(req.path, clientIP, req.method, { reason: 'IP não whitelisted' });
    return res.status(403).json({ error: 'Acesso negado para este IP' });
  }
  
  next();
}
```

#### 4. **Adicione endpoints de autenticação (antes de `/admin`)**

```javascript
app.post(`/secret/${ADMIN_SECRET}/login`, authLimiter, (req, res) => {
  const { username, password } = req.body;
  const clientIP = getClientIP(req);
  
  if (!username || !password) {
    logLoginFailed(username || 'unknown', clientIP, 'Credenciais incompletas');
    return res.status(400).json({ error: 'Credenciais incompletas' });
  }
  
  if (username !== ADMIN_USER || password !== ADMIN_PASS) {
    logLoginFailed(username, clientIP, 'Credenciais inválidas');
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }
  
  const token = jwt.sign(
    {
      user: username,
      iat: Date.now(),
      ip: clientIP,
    },
    JWT_SECRET,
    { expiresIn: '2h' }
  );
  
  req.session.token = token;
  logLoginSuccess(username, clientIP, req.headers['user-agent'] || 'unknown');
  
  return res.json({
    success: true,
    token,
    expiresIn: '2h',
    message: 'Login realizado com sucesso'
  });
});

app.post(`/secret/${ADMIN_SECRET}/logout`, adminAuth, (req, res) => {
  req.session.destroy();
  res.json({ success: true, message: 'Logout realizado' });
});

app.get(`/secret/${ADMIN_SECRET}/auth-status`, (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : req.session.token;
  
  if (!token) {
    return res.json({ authenticated: false });
  }
  
  try {
    jwt.verify(token, JWT_SECRET);
    return res.json({ authenticated: true });
  } catch {
    return res.json({ authenticated: false });
  }
});
```

#### 5. **Substitua todas as rotas de admin**

| De | Para |
|---|---|
| `app.get('/admin', basicAuth,` | `app.get(\`/secret/${ADMIN_SECRET}/admin\`, checkAdminIP, adminAuth,` |
| `app.get('/admin/export.csv', basicAuth,` | `app.get(\`/secret/${ADMIN_SECRET}/admin/export.csv\`, checkAdminIP, adminAuth,` |
| `app.post('/admin/reset', basicAuth,` | `app.post(\`/secret/${ADMIN_SECRET}/admin/reset\`, checkAdminIP, adminAuth,` |
| `app.get('/admin/submission/:protocol', basicAuth,` | `app.get(\`/secret/${ADMIN_SECRET}/admin/submission/:protocol\`, checkAdminIP, adminAuth,` |
| `app.post('/admin/submission/:protocol', basicAuth,` | `app.post(\`/secret/${ADMIN_SECRET}/admin/submission/:protocol\`, checkAdminIP, adminAuth,` |

| De | Para |
|---|---|
| `app.get('/committee', basicAuth,` | `app.get(\`/secret/${ADMIN_SECRET}/committee\`, checkAdminIP, adminAuth,` |
| `app.get('/committee/results', basicAuth,` | `app.get(\`/secret/${ADMIN_SECRET}/committee/results\`, checkAdminIP, adminAuth,` |
| `app.get('/committee/evaluate/:protocol', basicAuth,` | `app.get(\`/secret/${ADMIN_SECRET}/committee/evaluate/:protocol\`, checkAdminIP, adminAuth,` |
| `app.post('/committee/evaluate/:protocol', basicAuth,` | `app.post(\`/secret/${ADMIN_SECRET}/committee/evaluate/:protocol\`, checkAdminIP, adminAuth,` |

#### 6. **Adicione após `app.use(helmet())`**

```javascript
// Middlewares de segurança adicionais
app.use(securityHeaders);
app.use(enforceHTTPS);
app.use(detectAttackPatterns);
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(session({
  secret: JWT_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 2 * 60 * 60 * 1000,
  },
}));
```

---

## Procedimento Recomendado

### **Passo 1: Restaurar arquivo**

```bash
cd c:\Users\vidal\OneDrive\Documentos\13\ -\ CLONEGIT\site_planter_projeto
git status
git checkout server/index.js
```

### **Passo 2: Fazer backup**

```bash
cp server/index.js server/index.js.backup.$(date +%s)
```

### **Passo 3: Aplicar mudanças manualmente**

Use VS Code e aplique cada uma das 6 seções acima ao arquivo.

### **Passo 4: Testar sintaxe**

```bash
cd server
node -c index.js
```

### **Passo 5: Rodar servidor**

```bash
npm start
```

---

## Próximos Passos

Após restaurar o arquivo com sucesso:

1. ✅ Arquivos de segurança criados (admin-secret.js, security-logger.js, security-middleware.js)
2. ✅ Dependências npm instaladas
3. ✅ Documentação criada (SECURITY_HARDENING.md, SECURITY_IMPLEMENTATION.md)
4. ⏳ Restaurar e aplicar mudanças ao index.js
5. ⏳ Testar servidor
6. ⏳ Validar UUID gerado
7. ⏳ Fazer login via `/secret/{UUID}/login`

---

## URLs de Acesso Após Implementação

```
Desenvolvimento:
  /secret/{UUID-ALEATÓRIO}/admin
  /secret/{UUID-ALEATÓRIO}/committee  
  /secret/{UUID-ALEATÓRIO}/committee/results

Produção UEFS:
  https://inscricoes.planterr.uefs.br/secret/{UUID-SECRETO}/admin
```

---

## Suporte

Se encontrar problemas:

1. Verificar erros de sintaxe: `node -c server/index.js`
2. Consultar [SECURITY_HARDENING.md](./SECURITY_HARDENING.md)
3. Ver logs em: `server/logs/security.log`
4. Contatar equipe técnica

---

**Status:** 🟡 Parcialmente Implementado  
**Próximo passo:** Restaurar e reapplicar mudanças ao index.js
