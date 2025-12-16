const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Criar diretório de logs se não existir
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Logger de segurança estruturado para eventos críticos
 */
const securityLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'planterr-security' },
  transports: [
    // Arquivo de segurança
    new winston.transports.File({
      filename: path.join(logsDir, 'security.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 10,
    }),
    // Arquivo de erros
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880,
      maxFiles: 10,
    }),
  ],
});

// Adicionar console em desenvolvimento
if (process.env.NODE_ENV !== 'production') {
  securityLogger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }));
}

/**
 * Tipos de eventos de segurança
 */
const SecurityEventTypes = {
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILED: 'LOGIN_FAILED',
  LOGIN_ATTEMPT_BLOCKED: 'LOGIN_ATTEMPT_BLOCKED',
  UNAUTHORIZED_ACCESS_ATTEMPT: 'UNAUTHORIZED_ACCESS_ATTEMPT',
  ATTACK_PATTERN_DETECTED: 'ATTACK_PATTERN_DETECTED',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  DATA_EXPORT: 'DATA_EXPORT',
  EVALUATION_CREATED: 'EVALUATION_CREATED',
  EVALUATION_MODIFIED: 'EVALUATION_MODIFIED',
  ADMIN_ACTION: 'ADMIN_ACTION',
  SUSPICIOUS_REQUEST: 'SUSPICIOUS_REQUEST',
  IP_BLOCKED: 'IP_BLOCKED',
};

/**
 * Registra um evento de segurança
 */
function logSecurityEvent(eventType, details = {}) {
  const logEntry = {
    eventType,
    timestamp: new Date().toISOString(),
    ...details,
  };

  securityLogger.warn(logEntry);

  // Log críticos também vão para console
  if ([
    SecurityEventTypes.ATTACK_PATTERN_DETECTED,
    SecurityEventTypes.UNAUTHORIZED_ACCESS_ATTEMPT,
    SecurityEventTypes.LOGIN_ATTEMPT_BLOCKED,
  ].includes(eventType)) {
    console.error(`\n🚨 EVENTO DE SEGURANÇA: ${eventType}`, logEntry);
  }
}

/**
 * Registra login bem-sucedido
 */
function logLoginSuccess(username, ip, userAgent) {
  logSecurityEvent(SecurityEventTypes.LOGIN_SUCCESS, {
    username,
    ip,
    userAgent,
  });
}

/**
 * Registra tentativa de login falhada
 */
function logLoginFailed(username, ip, reason) {
  logSecurityEvent(SecurityEventTypes.LOGIN_FAILED, {
    username,
    ip,
    reason,
  });
}

/**
 * Registra tentativa de acesso não autorizado
 */
function logUnauthorizedAccess(path, ip, method, payload) {
  logSecurityEvent(SecurityEventTypes.UNAUTHORIZED_ACCESS_ATTEMPT, {
    path,
    ip,
    method,
    payloadSize: typeof payload === 'string' ? payload.length : JSON.stringify(payload).length,
  });
}

/**
 * Registra padrão de ataque detectado
 */
function logAttackDetected(pattern, path, ip, payload) {
  logSecurityEvent(SecurityEventTypes.ATTACK_PATTERN_DETECTED, {
    pattern,
    path,
    ip,
    payloadSample: typeof payload === 'string' ? payload.substring(0, 100) : JSON.stringify(payload).substring(0, 100),
  });
}

/**
 * Registra limite de taxa excedido
 */
function logRateLimitExceeded(ip, endpoint, attempts) {
  logSecurityEvent(SecurityEventTypes.RATE_LIMIT_EXCEEDED, {
    ip,
    endpoint,
    attempts,
  });
}

/**
 * Registra ação administrativo
 */
function logAdminAction(action, username, details) {
  logSecurityEvent(SecurityEventTypes.ADMIN_ACTION, {
    action,
    username,
    ...details,
  });
}

/**
 * Registra exportação de dados
 */
function logDataExport(username, format, recordCount, ip) {
  logSecurityEvent(SecurityEventTypes.DATA_EXPORT, {
    username,
    format,
    recordCount,
    ip,
  });
}

module.exports = {
  securityLogger,
  SecurityEventTypes,
  logSecurityEvent,
  logLoginSuccess,
  logLoginFailed,
  logUnauthorizedAccess,
  logAttackDetected,
  logRateLimitExceeded,
  logAdminAction,
  logDataExport,
};
