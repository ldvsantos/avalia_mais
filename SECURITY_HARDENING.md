# Guia de Segurança - PLANTERR Sistema de Inscrições

Este documento apresenta técnicas avançadas para proteger a aplicação contra invasões, ataques e acesso não autorizado.

## 📋 Índice

1. [Visão Geral de Ameaças](#visão-geral-de-ameaças)
2. [Camuflar Rotas Administrativas](#camuflar-rotas-administrativas)
3. [Autenticação e Autorização Robustas](#autenticação-e-autorização-robustas)
4. [Rate Limiting e Proteção contra Brute Force](#rate-limiting-e-proteção-contra-brute-force)
5. [Headers de Segurança HTTP](#headers-de-segurança-http)
6. [CORS e Validação de Requisições](#cors-e-validação-de-requisições)
7. [Proteção contra Ataques Comuns](#proteção-contra-ataques-comuns)
8. [WAF (Web Application Firewall)](#waf-web-application-firewall)
9. [Monitoramento e Logging de Segurança](#monitoramento-e-logging-de-segurança)
10. [Checklist de Segurança](#checklist-de-segurança)

---

## Visão Geral de Ameaças

A aplicação enfrenta os seguintes riscos:

| Ameaça | Impacto | Mitigação |
|--------|--------|-----------|
| **Força Bruta em Admin** | Acesso não autorizado | Rate limiting, 2FA, camuflar rotas |
| **Injeção SQL/NoSQL** | Vazamento de dados | Validação rigorosa, prepared statements |
| **XSS (Cross-Site Scripting)** | Roubo de sessão, dados | Sanitização HTML, CSP headers |
| **CSRF (Cross-Site Request Forgery)** | Ações não autorizadas | CSRF tokens, SameSite cookies |
| **Enumeração de rotas** | Descoberta da área admin | Camuflar endpoints, WAF |
| **DoS (Negação de Serviço)** | Indisponibilidade | Rate limiting, IP blocking, CDN |
| **Exposição de variáveis ambiente** | Credenciais vazadas | Nunca commitar .env, usar secrets manager |
| **Acesso direto ao banco de dados** | Vazamento total | Validação, criptografia, backups isolados |

---

## Camuflar Rotas Administrativas

### Estratégia: Usar UUID aleatório em vez de `/admin`

Em vez de:
```
/admin              → Fácil de descobrir
/committee          → Fácil de descobrir
/committee/results  → Fácil de descobrir
```

Use:
```
/secret/a7b9c2d1-e4f6-8g9h-0i1j-k2l3m4n5o6p7  → Secreto
```

### Implementação

#### 1. Gerar UUID administrativo ao instalar

**arquivo: `server/admin-secret.js`**

```javascript
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ADMIN_SECRET_FILE = path.join(__dirname, '.admin-secret');

function generateOrReadAdminSecret() {
  if (fs.existsSync(ADMIN_SECRET_FILE)) {
    return fs.readFileSync(ADMIN_SECRET_FILE, 'utf8').trim();
  }
  
  const secret = crypto.randomUUID();
  fs.writeFileSync(ADMIN_SECRET_FILE, secret, { mode: 0o600 }); // Apenas leitura do proprietário
  console.log(`\n⚠️  ADMIN SECRET CRIADO: ${secret}\n`);
  console.log('Salve este UUID em local seguro. Ele não será mostrado novamente.\n');
  
  return secret;
}

module.exports = { generateOrReadAdminSecret };
```

#### 2. Usar o UUID nas rotas

**Modificar `server/index.js`**

```javascript
const { generateOrReadAdminSecret } = require('./admin-secret');

const app = express();
const ADMIN_SECRET = generateOrReadAdminSecret();

// Exemplo: rotas admin agora usam o UUID
app.get(`/secret/${ADMIN_SECRET}/admin`, basicAuth, (req, res) => {
  // Código da página admin
});

app.get(`/secret/${ADMIN_SECRET}/committee`, basicAuth, (req, res) => {
  // Código da página de comissão
});

app.get(`/secret/${ADMIN_SECRET}/committee/results`, basicAuth, (req, res) => {
  // Código de resultados
});

// Bloqueie rotas antigas para alertar administrador
app.get('/admin', (req, res) => {
  res.status(404).send('Página não encontrada. Se você é administrador, verifique o UUID secreto.');
});

app.get('/committee', (req, res) => {
  res.status(404).send('Página não encontrada.');
});
```

#### 3. Armazenar UUID com segurança

**`.gitignore`** (já deve estar lá):
```
.admin-secret
.env
.env.*
```

**`server/.admin-secret`** (gerado automaticamente):
```
a7b9c2d1-e4f6-8g9h-0i1j-k2l3m4n5o6p7
```

**Em produção (STI UEFS):**
```bash
# Nunca compartilhar via Git
# Guardar em cofre seguro (Vault, 1Password, LastPass)
# Ou em variável de ambiente:
ADMIN_SECRET_UUID=a7b9c2d1-e4f6-8g9h-0i1j-k2l3m4n5o6p7
```

### Benefício
- **Scanners automáticos** não encontram `/admin`
- **Scripts de ataque** buscam por rotas conhecidas
- **Força bruta** não consegue adivinhar UUID aleatório (128 bits)

---

## Autenticação e Autorização Robustas

### 1. Melhorar HTTP Basic Auth

**Problema atual:** Credenciais em Base64 (facilmente decodificável)

**Solução A: HTTPS obrigatório + Rate limiting agressivo**

```javascript
// Middleware para forçar HTTPS
app.use((req, res, next) => {
  if (req.headers['x-forwarded-proto'] !== 'https' && process.env.NODE_ENV === 'production') {
    return res.status(403).send('HTTPS obrigatório');
  }
  next();
});

// Rate limiting específico para autenticação
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5,                      // 5 tentativas
  skip: (req) => req.user,     // Não contar tentativas bem-sucedidas
  message: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
  standardHeaders: true,
  legacyHeaders: false,
  store: new MemoryStore(),    // Ou usar Redis para escala
});

app.use(`/secret/${ADMIN_SECRET}/`, authLimiter);
```

**Solução B: JWT + Sessão segura (mais robusta)**

```javascript
const jwt = require('jsonwebtoken');
const session = require('express-session');

const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

// Middleware de sessão segura
app.use(session({
  secret: JWT_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,           // HTTPS only
    httpOnly: true,         // Não acessível via JavaScript
    sameSite: 'strict',     // Proteção contra CSRF
    maxAge: 2 * 60 * 60 * 1000  // 2 horas
  }
}));

// Login endpoint (POST)
app.post(`/secret/${ADMIN_SECRET}/login`, (req, res) => {
  const { username, password } = req.body;
  
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    const token = jwt.sign(
      { user: username, iat: Date.now() },
      JWT_SECRET,
      { expiresIn: '2h' }
    );
    
    req.session.token = token;
    res.json({ success: true, token });
  } else {
    // Log tentativa falhada
    console.warn(`[SECURITY] Login falhou para usuário: ${username} em ${new Date()}`);
    res.status(401).json({ error: 'Credenciais inválidas' });
  }
});

// Verificar JWT em rotas protegidas
function verifyToken(req, res, next) {
  const token = req.session.token || req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).send('Token ausente');
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).send('Token inválido ou expirado');
  }
}

app.get(`/secret/${ADMIN_SECRET}/admin`, verifyToken, (req, res) => {
  // Rotas protegidas
});
```

### 2. Implementar 2FA (Autenticação em Dois Fatores)

**Usar totp (Time-based One-Time Password)**

```bash
npm install speakeasy qrcode
```

```javascript
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

// Gerar 2FA secret na primeira login
app.post(`/secret/${ADMIN_SECRET}/setup-2fa`, verifyToken, async (req, res) => {
  const secret = speakeasy.generateSecret({
    name: `PLANTERR Admin (${ADMIN_USER})`,
    issuer: 'PLANTERR UEFS'
  });
  
  const qrCode = await QRCode.toDataURL(secret.otpauth_url);
  
  // Salvar secret temporariamente (após confirmação será salvo permanentemente)
  req.session.pending2FA = secret.base32;
  
  res.json({ qrCode, secret: secret.base32 });
});

// Validar 2FA
app.post(`/secret/${ADMIN_SECRET}/verify-2fa`, verifyToken, (req, res) => {
  const { token } = req.body;
  const secret = req.session.pending2FA;
  
  const verified = speakeasy.totp.verify({
    secret: secret,
    encoding: 'base32',
    token: token,
    window: 2  // Permitir token anterior/próximo
  });
  
  if (verified) {
    // Salvar 2FA permanentemente
    fs.writeFileSync('.admin-2fa-secret', secret, { mode: 0o600 });
    delete req.session.pending2FA;
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Código inválido' });
  }
});

// Verificar 2FA em cada login
app.post(`/secret/${ADMIN_SECRET}/verify-login-2fa`, (req, res) => {
  const { username, password, totp } = req.body;
  
  if (username !== ADMIN_USER || password !== ADMIN_PASS) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }
  
  // Ler 2FA secret
  const twoFASecret = fs.readFileSync('.admin-2fa-secret', 'utf8').trim();
  
  const verified = speakeasy.totp.verify({
    secret: twoFASecret,
    encoding: 'base32',
    token: totp,
    window: 2
  });
  
  if (!verified) {
    return res.status(401).json({ error: 'Código 2FA inválido' });
  }
  
  // Login bem-sucedido
  const token = jwt.sign({ user: username }, JWT_SECRET, { expiresIn: '2h' });
  req.session.token = token;
  res.json({ success: true, token });
});
```

---

## Rate Limiting e Proteção contra Brute Force

### 1. Rate Limiting avançado

```javascript
const RedisStore = require('rate-limit-redis');
const redis = require('redis');

// Conectar ao Redis (opcional, mas recomendado para produção)
const redisClient = redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379
});

// Limitadores diferentes por tipo de rota
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,  // 100 requisições por IP
  message: 'Muitas requisições deste IP, tente novamente mais tarde.'
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,    // 5 tentativas por IP
  skipSuccessfulRequests: true,
  message: 'Muitas tentativas de autenticação. Aguarde 15 minutos.'
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,   // 30 requisições por minuto
  message: 'Limite de API excedido.'
});

// Aplicar globalmente
app.use(generalLimiter);

// Aplicar em endpoints sensíveis
app.post(`/secret/${ADMIN_SECRET}/verify-login-2fa`, authLimiter, (req, res) => {
  // ...
});

app.post('/api/submissions', apiLimiter, (req, res) => {
  // ...
});
```

### 2. IP Whitelist (para área admin)

```javascript
const ADMIN_IP_WHITELIST = (process.env.ADMIN_IPS || '').split(',').map(ip => ip.trim());

function checkAdminIP(req, res, next) {
  const clientIP = req.headers['x-forwarded-for'] || req.ip;
  
  if (ADMIN_IP_WHITELIST.length > 0 && !ADMIN_IP_WHITELIST.includes(clientIP)) {
    console.warn(`[SECURITY] Tentativa de acesso admin de IP não permitido: ${clientIP}`);
    return res.status(403).send('IP não autorizado para acesso administrativo');
  }
  
  next();
}

// Usar em rotas admin
app.get(`/secret/${ADMIN_SECRET}/admin`, checkAdminIP, verifyToken, (req, res) => {
  // ...
});
```

**Em `.env` ou variáveis de servidor:**
```
ADMIN_IPS=192.168.1.100,203.0.113.50,2001:db8::1
```

### 3. Detectar e bloquear padrões de ataque

```javascript
const attackPatterns = [
  /union.*select/i,           // SQL injection
  /drop.*table/i,
  /insert.*into/i,
  /<script/i,                 // XSS
  /javascript:/i,
  /%3cscript/i,               // XSS URL encoded
  /\.\.\/\.\.\//,             // Path traversal
  /passwd|shadow|etc/i,       // Acesso a arquivos sensíveis
];

function detectAttack(req, res, next) {
  const queryString = JSON.stringify(req.query) + JSON.stringify(req.body);
  
  for (const pattern of attackPatterns) {
    if (pattern.test(queryString)) {
      console.error(`[SECURITY ALERT] Possível ataque detectado:`, {
        ip: req.ip,
        pattern: pattern.source,
        path: req.path,
        timestamp: new Date()
      });
      
      // Opções:
      // 1. Bloquear imediatamente
      // return res.status(403).send('Requisição suspeita bloqueada');
      
      // 2. Log + permitir (monitoramento)
      res.set('X-Blocked-Pattern', pattern.source);
    }
  }
  
  next();
}

app.use(detectAttack);
```

---

## Headers de Segurança HTTP

### 1. Usar Helmet.js (já incluído)

```javascript
const helmet = require('helmet');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],  // Evite unsafe-inline em produção
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,        // 1 ano
    includeSubDomains: true,
    preload: true,
  },
  xssFilter: true,
  noSniff: true,
  referrerPolicy: { policy: 'no-referrer' },
  permittedCrossDomainPolicies: false,
}));
```

### 2. Headers customizados

```javascript
app.use((req, res, next) => {
  // Remover header que revela tecnologia
  res.removeHeader('X-Powered-By');
  
  // Adicionar headers de segurança
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  });
  
  next();
});
```

---

## CORS e Validação de Requisições

### 1. CORS restritivo

```javascript
const cors = require('cors');

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`[SECURITY] CORS bloqueado para origin: ${origin}`);
      callback(new Error('CORS não permitido'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600  // 10 minutos
}));
```

**Em produção:**
```
ALLOWED_ORIGINS=https://inscricoes.planterr.uefs.br,https://admin.planterr.uefs.br
```

### 2. CSRF tokens

```javascript
const csrf = require('csurf');
const cookieParser = require('cookie-parser');

app.use(cookieParser());
app.use(csrf({ cookie: false }));

// Fornecer token ao formulário
app.get('/', (req, res) => {
  const csrfToken = req.csrfToken();
  // Enviar token no HTML:
  // <input type="hidden" name="_csrf" value="${csrfToken}">
});

// Validar token em POST
app.post('/api/submissions', (req, res) => {
  // Middleware csrf já validou
  // Prosseguir com lógica
});
```

### 3. Validação e sanitização rigorosa

```javascript
const { body, validationResult } = require('express-validator');
const sanitizeHtml = require('sanitize-html');

const validateSubmission = [
  body('nome')
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Nome deve ter entre 3 e 100 caracteres')
    .matches(/^[a-záéíóúãõâêôàç\s'-]+$/i)
    .withMessage('Nome contém caracteres inválidos'),
  
  body('email')
    .isEmail()
    .withMessage('Email inválido')
    .normalizeEmail(),
  
  body('cpf')
    .matches(/^\d{11}$/)
    .withMessage('CPF deve ter 11 dígitos')
    .custom(isValidCPF)
    .withMessage('CPF inválido'),
  
  body('titulo_pt')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Título deve ter entre 5 e 200 caracteres'),
  
  body('resumo')
    .trim()
    .isLength({ max: 1800 })
    .withMessage('Resumo não pode exceder 1800 caracteres'),
];

app.post('/api/submissions', validateSubmission, (req, res) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  // Sanitizar HTML em campos de texto
  const cleanData = {
    nome: sanitizeHtml(req.body.nome, { allowedTags: [] }),
    resumo: sanitizeHtml(req.body.resumo, { allowedTags: [] }),
    // ...
  };
  
  // Processar submission
});
```

---

## Proteção contra Ataques Comuns

### 1. XSS (Cross-Site Scripting)

**Problema:** Usuário injeta `<script>alert('hackeado')</script>` em campo de texto

**Solução:**

```javascript
// Sanitização na entrada
const sanitizeHtml = require('sanitize-html');

const sanitize = (input) => sanitizeHtml(input, {
  allowedTags: [],  // Remover tags HTML
  allowedAttributes: {}
});

// Escape na saída (template HTML)
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// Usar ao renderizar
res.send(`
  <div>${escapeHtml(userData.nome)}</div>
`);
```

### 2. SQL/NoSQL Injection

**Já protegido por validação, mas reforçar:**

```javascript
// ❌ NUNCA fazer isso:
const query = `SELECT * FROM users WHERE email = '${email}'`;

// ✅ FAZER ISSO:
const userEmail = sanitizeEmail(email);
// Ou com parameterized query (se usar SQL real):
db.query('SELECT * FROM users WHERE email = ?', [userEmail]);
```

### 3. Path Traversal

**Problema:** Acessar `/api/file?path=../../etc/passwd`

**Solução:**

```javascript
const path = require('path');

app.get('/api/file', (req, res) => {
  const basePath = '/var/www/planterr-inscricoes/server/data';
  const requestedPath = path.join(basePath, req.query.path);
  
  // Verificar se caminho resultante está dentro de basePath
  if (!requestedPath.startsWith(basePath)) {
    return res.status(403).send('Acesso negado');
  }
  
  // Proceder com leitura
});
```

---

## WAF (Web Application Firewall)

### 1. ModSecurity (via Nginx)

**Em servidor (Nginx com ModSecurity):**

```bash
# Instalar ModSecurity
sudo apt install -y libmodsecurity3 libmodsecurity-dev

# Instalar OWASP CRS (Core Rule Set)
cd /opt
sudo git clone https://github.com/coreruleset/coreruleset.git
```

**Configuração Nginx (`/etc/nginx/sites-available/inscricoes.planterr.uefs.br`):**

```nginx
load_module modules/ngx_http_modsecurity_module.so;

server {
    listen 443 ssl http2;
    server_name inscricoes.planterr.uefs.br;
    
    # ModSecurity
    modsecurity on;
    modsecurity_rules_file /etc/nginx/modsec/main.conf;
    
    # ... resto da configuração
}
```

### 2. Cloudflare WAF (recomendado para produção)

Se usar Cloudflare como DNS:
- Dashboard → Security → WAF Rules
- Ativar "OWASP CRS"
- Configurar rate limiting
- Bloquear países (se necessário)
- Rate limiting por endpoint

---

## Monitoramento e Logging de Segurança

### 1. Log estruturado de eventos de segurança

```javascript
const winston = require('winston');

const securityLogger = winston.createLogger({
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: '/var/log/planterr-security.log' }),
    new winston.transports.Console({ format: winston.format.simple() })
  ]
});

// Eventos a logar:
// - Tentativas de login falhadas
// - Acesso a rotas admin
// - Tentativas de ataque detectadas
// - Mudanças de configuração
// - Acessos a dados sensíveis

function logSecurityEvent(event, details) {
  securityLogger.warn({
    timestamp: new Date(),
    event,
    ...details
  });
}

// Usar:
logSecurityEvent('LOGIN_FALHOU', {
  usuario: req.body.username,
  ip: req.ip,
  tentativa: 3
});
```

### 2. Alertas em tempo real

```javascript
const nodemailer = require('nodemailer');

async function alertarSeguranca(assunto, mensagem) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  
  await transporter.sendMail({
    from: 'seguranca@planterr.uefs.br',
    to: process.env.SECURITY_ALERTS_EMAIL,
    subject: `[ALERTA SEGURANÇA] ${assunto}`,
    text: mensagem,
    html: `<h2>${assunto}</h2><p>${mensagem}</p>`
  });
}

// Usar em eventos críticos:
logSecurityEvent('ATAQUE_DETECTADO', { ... });
await alertarSeguranca('Ataque XSS detectado', `IP: ${ip}, Padrão: ${pattern}`);
```

### 3. Auditoria de acessos

```javascript
function auditarAcesso(usuario, rota, acao, resultado) {
  const auditLog = {
    timestamp: new Date(),
    usuario,
    rota,
    acao,
    resultado,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  };
  
  // Salvar em arquivo ou banco de dados
  fs.appendFileSync('/var/log/planterr-audit.log', 
    JSON.stringify(auditLog) + '\n'
  );
}

// Usar em operações críticas:
auditarAcesso(req.user.username, '/api/submissions', 'DELETE', 'success');
```

---

## Checklist de Segurança

### Antes do Deployment

- [ ] **Rotas admin camufladas** com UUID aleatório
- [ ] **HTTPS obrigatório** (redirect de HTTP)
- [ ] **Rate limiting** em todos os endpoints sensíveis
- [ ] **Autenticação forte** (JWT + 2FA, não apenas Basic Auth)
- [ ] **CORS configurado** restritivamente
- [ ] **Headers de segurança** (Helmet.js)
- [ ] **Validação e sanitização** em todas as entradas
- [ ] **Proteção CSRF** em formulários
- [ ] **Log de segurança** ativo
- [ ] **Variáveis de ambiente** nunca em Git
- [ ] **Dependências atualizadas** (`npm audit`)
- [ ] **Certificado SSL válido** e HTTPS
- [ ] **Backup automático** de dados
- [ ] **Plano de resposta a incidentes**

### Após Deploy

- [ ] Verificar logs de segurança diariamente
- [ ] Monitorar taxa de 4xx/5xx
- [ ] Validar certificado SSL (não expirou)
- [ ] Testar 2FA funcionando
- [ ] Confirmar rate limiting ativo
- [ ] Verificar backup realizando corretamente
- [ ] Treinar equipe sobre segurança
- [ ] Documentar procedimentos de resposta a ataque

---

## Comandos Úteis para Auditoria

```bash
# Verificar dependências vulneráveis
npm audit

# Atualizar dependências
npm audit fix

# Scan de portas abertas
netstat -tlnp

# Verificar permissões de arquivos
ls -la /var/www/planterr-inscricoes/server/

# Logs de segurança
tail -f /var/log/planterr-security.log

# Detectar padrões suspeitos
grep -i "erro\|falhou\|negado" /var/log/nginx/planterr-error.log

# Testar HTTPS
curl -I https://inscricoes.planterr.uefs.br/

# Verificar headers de segurança
curl -I https://inscricoes.planterr.uefs.br/ | grep -i security
```

---

## Referências e Recursos

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Express.js Security](https://expressjs.com/en/advanced/best-practice-security.html)
- [Helmet.js Documentation](https://helmetjs.github.io/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)

---

**Última atualização:** dezembro de 2025  
**Versão:** 1.0  
**Responsável:** Tim de Segurança
