const crypto = require('crypto');
const { AsyncLocalStorage } = require('async_hooks');

const als = new AsyncLocalStorage();

function newRequestId() {
  try {
    return crypto.randomUUID();
  } catch {
    return crypto.randomBytes(16).toString('hex');
  }
}

function getClientIP(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.headers['x-real-ip'] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.ip ||
    '127.0.0.1'
  );
}

function computeActor(req) {
  // Normaliza a identidade do ator (governança/auditoria)
  // - public: inscrição pública
  // - evaluator/admin: via JWT
  const user = req.user || req.admin || null;
  if (user && typeof user === 'object') {
    return {
      type: 'user',
      user: user.user || user.username || 'unknown',
      role: user.role || 'unknown',
      line: user.line,
      num: user.num,
    };
  }

  return { type: 'public' };
}

function requestContextMiddleware(req, res, next) {
  const requestId =
    String(req.headers['x-request-id'] || '').trim() ||
    String(req.headers['x-correlation-id'] || '').trim() ||
    newRequestId();

  const base = {
    requestId,
    ip: getClientIP(req),
    userAgent: req.headers['user-agent'] || 'unknown',
    actor: computeActor(req),
  };

  // expõe no response para correlação
  res.setHeader('X-Request-Id', requestId);

  als.run(base, () => next());
}

function getRequestContext() {
  return als.getStore() || null;
}

function setRequestContext(patch = {}) {
  const current = als.getStore();
  if (!current) return;
  Object.assign(current, patch);
}

function refreshActorFromReq(req) {
  const current = als.getStore();
  if (!current) return;
  current.actor = computeActor(req);
}

module.exports = {
  requestContextMiddleware,
  getRequestContext,
  setRequestContext,
  refreshActorFromReq,
  getClientIP,
};
