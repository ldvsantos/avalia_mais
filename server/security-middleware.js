const jwt = require('jsonwebtoken');
const { logAttackDetected, logUnauthorizedAccess } = require('./security-logger');

/**
 * Padrões de ataque comuns a detectar
 */
const ATTACK_PATTERNS = [
  // SQL injection
  /union(\s+|\/\*.*?\*\/)+select/i,
  /insert(\s+|\/\*.*?\*\/)+into/i,
  /delete(\s+|\/\*.*?\*\/)+from/i,
  /drop(\s+|\/\*.*?\*\/)+table/i,
  /update(\s+|\/\*.*?\*\/)+set/i,
  /exec(\s+|\/\*.*?\*\/)+\(/i,
  
  // NoSQL injection
  /(\$where|\$ne|\$gt|\$regex)/,
  
  // XSS
  /<script[^>]*>/i,
  /javascript:/i,
  /on\w+\s*=/i,
  /%3cscript/i,
  /eval\(/i,
  
  // Path traversal
  /\.\.\/\.\.\/|\.\.\\\.\.\\|%2e%2e\//i,
  /\/etc\/passwd|\/var\/log/i,
  
  // Command injection
  /;\s*(cat|ls|rm|curl|wget|nc)\s+/i,
  /`[^`]*`/,
  /\$\([^)]*\)/,
];

/**
 * Middleware para detectar padrões de ataque
 */
function detectAttackPatterns(req, res, next) {
  // Serializar request body e query para busca
  const searchContent = [
    JSON.stringify(req.query),
    JSON.stringify(req.body),
    req.path,
    req.headers['user-agent'] || '',
  ].join(' ');

  for (const pattern of ATTACK_PATTERNS) {
    if (pattern.test(searchContent)) {
      logAttackDetected(pattern.source, req.path, getClientIP(req), req.body);
      
      // Opção 1: Bloquear imediatamente
      return res.status(403).json({ 
        error: 'Requisição bloqueada por conter padrão suspeito' 
      });
      
      // Opção 2: Log e continuar (comentado)
      // res.set('X-Blocked-Pattern', pattern.source);
      // break;
    }
  }

  next();
}

/**
 * Middleware para adicionar headers de segurança personalizados
 */
function securityHeaders(req, res, next) {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  });
  
  // Remover headers que revelam tecnologia
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');
  
  next();
}

/**
 * Middleware para forçar HTTPS em produção
 */
function enforceHTTPS(req, res, next) {
  if (process.env.NODE_ENV === 'production') {
    if (req.headers['x-forwarded-proto'] !== 'https' && req.protocol !== 'https') {
      return res.status(403).json({ error: 'HTTPS obrigatório' });
    }
  }
  next();
}

/**
 * Middleware para verificar e validar JWT
 */
function verifyJWT(jwtSecret) {
  return (req, res, next) => {
    // Token pode vir de:
    // 1. Header Authorization: Bearer <token>
    // 2. Cookie (sessão)
    // 3. Query parameter (menos seguro)
    
    const authHeader = req.headers.authorization || '';
    const token = 
      authHeader.startsWith('Bearer ') 
        ? authHeader.slice(7)
        : req.cookies?.token || req.query?.token;
    
    if (!token) {
      return res.status(401).json({ error: 'Token ausente' });
    }
    
    try {
      const decoded = jwt.verify(token, jwtSecret);
      req.user = decoded;
      next();
    } catch (err) {
      const reason = err.name === 'TokenExpiredError' 
        ? 'Token expirado' 
        : 'Token inválido';
      
      logUnauthorizedAccess(req.path, getClientIP(req), req.method, { reason });
      return res.status(401).json({ error: reason });
    }
  };
}

/**
 * Middleware para validar IP (whitelist)
 */
function validateIPWhitelist(allowedIPs = []) {
  return (req, res, next) => {
    if (allowedIPs.length === 0) {
      return next(); // Sem whitelist, permitir todos
    }
    
    const clientIP = getClientIP(req);
    
    if (!allowedIPs.includes(clientIP)) {
      logUnauthorizedAccess(req.path, clientIP, req.method, { reason: 'IP não permitido' });
      return res.status(403).json({ error: 'Acesso negado para seu IP' });
    }
    
    next();
  };
}

/**
 * Middleware para adicionar timeout em requisições
 */
function requestTimeout(timeout = 30000) {
  return (req, res, next) => {
    req.setTimeout(timeout, () => {
      res.status(408).json({ error: 'Requisição expirou' });
    });
    next();
  };
}

/**
 * Obter IP real do cliente (considerando proxies)
 */
function getClientIP(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.headers['x-real-ip'] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    req.ip ||
    '127.0.0.1'
  );
}

/**
 * Sanitizar entrada para prevenir XSS
 */
function sanitizeInput(input) {
  if (typeof input !== 'string') {
    return input;
  }
  
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  
  return input.replace(/[&<>"']/g, char => map[char]);
}

/**
 * Validar formato de entrada comum
 */
function validateInput(input, type) {
  switch (type) {
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
    
    case 'cpf':
      return /^\d{11}$/.test(input.replace(/\D/g, ''));
    
    case 'phone':
      return /^\d{10,11}$/.test(input.replace(/\D/g, ''));
    
    case 'uuid':
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input);
    
    case 'url':
      try {
        new URL(input);
        return true;
      } catch {
        return false;
      }
    
    default:
      return true;
  }
}

module.exports = {
  detectAttackPatterns,
  securityHeaders,
  enforceHTTPS,
  verifyJWT,
  validateIPWhitelist,
  requestTimeout,
  getClientIP,
  sanitizeInput,
  validateInput,
};
