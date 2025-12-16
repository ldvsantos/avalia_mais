const fs = require('fs');
const path = require('path');

const { getRequestContext } = require('./request-context');
const {
  logSubmissionCreated,
  logSubmissionModified,
  logEvaluationCreated,
  logEvaluationModified,
  logConfigModified,
  logUserModified,
} = require('./security-logger');

const DATA_DIR = path.join(__dirname, 'data');
const SUBMISSIONS_FILE = path.join(DATA_DIR, 'submissions.json');
const EVALUATIONS_FILE = path.join(DATA_DIR, 'evaluations.json');
const EVALUATORS_FILE = path.join(DATA_DIR, 'evaluators.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

const DEFAULT_EVALUATORS = {
  'av1-l1': { pass: 'planterr2025', line: '1', num: '1' },
  'av2-l1': { pass: 'planterr2025', line: '1', num: '2' },
  'av3-l1': { pass: 'planterr2025', line: '1', num: '3' },
  'av1-l2': { pass: 'planterr2025', line: '2', num: '1' },
  'av2-l2': { pass: 'planterr2025', line: '2', num: '2' },
  'av3-l2': { pass: 'planterr2025', line: '2', num: '3' },
};

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(SUBMISSIONS_FILE)) {
    fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify({ submissions: [] }, null, 2), 'utf8');
  }
  if (!fs.existsSync(EVALUATIONS_FILE)) {
    fs.writeFileSync(EVALUATIONS_FILE, JSON.stringify({ evaluations: [] }, null, 2), 'utf8');
  }
  if (!fs.existsSync(EVALUATORS_FILE)) {
    fs.writeFileSync(EVALUATORS_FILE, JSON.stringify(DEFAULT_EVALUATORS, null, 2), 'utf8');
  }
  if (!fs.existsSync(CONFIG_FILE)) {
    const defaultConfig = {
      registrationWindow: { startISO: null, endISO: null },
      updatedAt: new Date().toISOString()
    };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2), 'utf8');
  }
}

function readAll() {
  ensureFile();
  const raw = fs.readFileSync(SUBMISSIONS_FILE, 'utf8');
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.submissions)) return { submissions: [] };
    return parsed;
  } catch {
    return { submissions: [] };
  }
}

function writeAll(data) {
  ensureFile();
  fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function readAllEvaluations() {
  ensureFile();
  const raw = fs.readFileSync(EVALUATIONS_FILE, 'utf8');
  try {
    const parsed = JSON.parse(raw);
    // Compat: se o arquivo estiver no formato antigo/errado como array puro
    // ex.: []
    if (Array.isArray(parsed)) return { evaluations: parsed };
    if (!parsed || !Array.isArray(parsed.evaluations)) return { evaluations: [] };
    return parsed;
  } catch {
    return { evaluations: [] };
  }
}

function writeAllEvaluations(data) {
  ensureFile();
  fs.writeFileSync(EVALUATIONS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function listSubmissions() {
  const { submissions } = readAll();
  return submissions.slice().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

function getByProtocol(protocol) {
  const { submissions } = readAll();
  return submissions.find(s => s.protocol === protocol) || null;
}

function hasCpfHash(cpfHash) {
  const { submissions } = readAll();
  return submissions.some(s => s.cpfHash === cpfHash);
}

function addSubmission(record) {
  const ctx = getRequestContext();
  const actor = ctx?.actor || { type: 'public' };

  const data = readAll();
  const next = { ...record };

  next.audit = next.audit && typeof next.audit === 'object' ? next.audit : { history: [] };
  if (!Array.isArray(next.audit.history)) next.audit.history = [];

  const now = new Date().toISOString();
  next.audit.createdAt = next.audit.createdAt || next.createdAt || now;
  next.audit.createdBy = next.audit.createdBy || actor;
  next.audit.createdIp = next.audit.createdIp || ctx?.ip;
  next.audit.createdUserAgent = next.audit.createdUserAgent || ctx?.userAgent;
  next.audit.updatedAt = now;
  next.audit.updatedBy = actor;
  next.audit.updatedIp = ctx?.ip;
  next.audit.updatedUserAgent = ctx?.userAgent;
  next.audit.updatedRequestId = ctx?.requestId;
  next.audit.history.push({ at: now, action: 'create', actor, ip: ctx?.ip, requestId: ctx?.requestId });
  if (next.audit.history.length > 50) next.audit.history = next.audit.history.slice(-50);

  data.submissions.push(next);
  writeAll(data);

  logSubmissionCreated({
    requestId: ctx?.requestId,
    protocol: next.protocol,
    cpfLast4: next.cpfLast4,
    actor,
    ip: ctx?.ip,
    userAgent: ctx?.userAgent,
  });

  return next;
}

function updateByProtocol(protocol, patch) {
  const ctx = getRequestContext();
  const actor = ctx?.actor || { type: 'unknown' };

  const data = readAll();
  const idx = data.submissions.findIndex(s => s.protocol === protocol);
  if (idx === -1) return null;

  const current = data.submissions[idx];
  const next = {
    ...current,
    ...patch,
    adminUpdatedAt: new Date().toISOString(),
  };

  next.audit = next.audit && typeof next.audit === 'object' ? next.audit : { history: [] };
  if (!Array.isArray(next.audit.history)) next.audit.history = [];
  const now = new Date().toISOString();
  next.audit.updatedAt = now;
  next.audit.updatedBy = actor;
  next.audit.updatedIp = ctx?.ip;
  next.audit.updatedUserAgent = ctx?.userAgent;
  next.audit.updatedRequestId = ctx?.requestId;
  next.audit.history.push({
    at: now,
    action: 'update',
    actor,
    ip: ctx?.ip,
    requestId: ctx?.requestId,
    patchKeys: Object.keys(patch || {}),
  });
  if (next.audit.history.length > 50) next.audit.history = next.audit.history.slice(-50);

  data.submissions[idx] = next;
  writeAll(data);

  logSubmissionModified({
    requestId: ctx?.requestId,
    protocol,
    actor,
    ip: ctx?.ip,
    userAgent: ctx?.userAgent,
    patchKeys: Object.keys(patch || {}),
  });

  return next;
}

function clearAllSubmissions() {
  writeAll({ submissions: [] });
}

function upsertEvaluation(evaluation) {
  const ctx = getRequestContext();
  const actor = ctx?.actor || { type: 'unknown' };

  // evaluation: { protocol, nota_projeto, nota_entrevista, eliminado, observacoes }
  const data = readAllEvaluations();
  const idx = data.evaluations.findIndex(e => e.protocol === evaluation.protocol);
  const next = {
    ...data.evaluations[idx] || {},
    ...evaluation,
    updatedAt: new Date().toISOString(),
  };

  next.audit = next.audit && typeof next.audit === 'object' ? next.audit : { history: [] };
  if (!Array.isArray(next.audit.history)) next.audit.history = [];
  const now = new Date().toISOString();
  if (idx === -1) {
    next.audit.createdAt = next.audit.createdAt || now;
    next.audit.createdBy = next.audit.createdBy || actor;
    next.audit.createdIp = next.audit.createdIp || ctx?.ip;
    next.audit.createdUserAgent = next.audit.createdUserAgent || ctx?.userAgent;
  }
  next.audit.updatedAt = now;
  next.audit.updatedBy = actor;
  next.audit.updatedIp = ctx?.ip;
  next.audit.updatedUserAgent = ctx?.userAgent;
  next.audit.updatedRequestId = ctx?.requestId;
  next.audit.history.push({
    at: now,
    action: idx === -1 ? 'create' : 'update',
    actor,
    ip: ctx?.ip,
    requestId: ctx?.requestId,
    patchKeys: Object.keys(evaluation || {}),
  });
  if (next.audit.history.length > 50) next.audit.history = next.audit.history.slice(-50);
  if (idx === -1) data.evaluations.push(next); else data.evaluations[idx] = next;
  writeAllEvaluations(data);

  const logFn = idx === -1 ? logEvaluationCreated : logEvaluationModified;
  logFn({
    requestId: ctx?.requestId,
    protocol: next.protocol,
    actor,
    ip: ctx?.ip,
    userAgent: ctx?.userAgent,
    eliminated: next.eliminado,
  });

  return next;
}

function listEvaluations() {
  const { evaluations } = readAllEvaluations();
  return evaluations.slice();
}

function getEvaluation(protocol) {
  const { evaluations } = readAllEvaluations();
  return evaluations.find(e => e.protocol === protocol) || null;
}

function getEvaluators() {
  ensureFile();
  try {
    const raw = fs.readFileSync(EVALUATORS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return DEFAULT_EVALUATORS;
  }
}

function saveEvaluators(evaluators) {
  const ctx = getRequestContext();
  ensureFile();
  fs.writeFileSync(EVALUATORS_FILE, JSON.stringify(evaluators, null, 2), 'utf8');

  logUserModified({
    requestId: ctx?.requestId,
    actor: ctx?.actor,
    ip: ctx?.ip,
    userAgent: ctx?.userAgent,
    action: 'saveEvaluators',
    evaluatorCount: evaluators && typeof evaluators === 'object' ? Object.keys(evaluators).length : null,
  });
}

function readConfig() {
  ensureFile();
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { registrationWindow: { startISO: null, endISO: null } };
    const rw = parsed.registrationWindow || { startISO: null, endISO: null };
    return { registrationWindow: rw };
  } catch {
    return { registrationWindow: { startISO: null, endISO: null } };
  }
}

function writeConfig(config) {
  const ctx = getRequestContext();
  ensureFile();
  const next = {
    ...(readConfig()),
    ...(config || {}),
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(next, null, 2), 'utf8');

  logConfigModified({
    requestId: ctx?.requestId,
    actor: ctx?.actor,
    ip: ctx?.ip,
    userAgent: ctx?.userAgent,
    changedKeys: Object.keys(config || {}),
  });

  return next;
}

function getRegistrationWindow() {
  const { registrationWindow } = readConfig();
  return registrationWindow || { startISO: null, endISO: null };
}

function setRegistrationWindow({ startDateStr, endDateStr }) {
  // startDateStr/endDateStr: YYYY-MM-DD (local) ou vazio
  const toStartISO = (s) => {
    const raw = String(s || '').trim();
    if (!raw) return null;
    const d = new Date(raw + 'T00:00:00');
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  };
  const toEndISO = (s) => {
    const raw = String(s || '').trim();
    if (!raw) return null;
    const d = new Date(raw + 'T23:59:59.999');
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  };

  const startISO = toStartISO(startDateStr);
  const endISO = toEndISO(endDateStr);
  const config = writeConfig({ registrationWindow: { startISO, endISO } });
  return config.registrationWindow;
}

function isRegistrationOpen(now = new Date()) {
  const { startISO, endISO } = getRegistrationWindow();
  const t = now.getTime();
  const startOk = startISO ? new Date(startISO).getTime() : null;
  const endOk = endISO ? new Date(endISO).getTime() : null;
  if (startOk != null && t < startOk) return false;
  if (endOk != null && t > endOk) return false;
  return true;
}

module.exports = {
  listSubmissions,
  getByProtocol,
  hasCpfHash,
  addSubmission,
  updateByProtocol,
  clearAllSubmissions,
  upsertEvaluation,
  listEvaluations,
  getEvaluation,
  getEvaluators,
  saveEvaluators,
  // config
  readConfig,
  writeConfig,
  getRegistrationWindow,
  setRegistrationWindow,
  isRegistrationOpen,
};
