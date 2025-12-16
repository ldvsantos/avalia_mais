const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const SUBMISSIONS_FILE = path.join(DATA_DIR, 'submissions.json');
const EVALUATIONS_FILE = path.join(DATA_DIR, 'evaluations.json');
const EVALUATORS_FILE = path.join(DATA_DIR, 'evaluators.json');

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
  const data = readAll();
  data.submissions.push(record);
  writeAll(data);
  return record;
}

function updateByProtocol(protocol, patch) {
  const data = readAll();
  const idx = data.submissions.findIndex(s => s.protocol === protocol);
  if (idx === -1) return null;

  const current = data.submissions[idx];
  const next = {
    ...current,
    ...patch,
    adminUpdatedAt: new Date().toISOString(),
  };

  data.submissions[idx] = next;
  writeAll(data);
  return next;
}

function clearAllSubmissions() {
  writeAll({ submissions: [] });
}

function upsertEvaluation(evaluation) {
  // evaluation: { protocol, nota_projeto, nota_entrevista, eliminado, observacoes }
  const data = readAllEvaluations();
  const idx = data.evaluations.findIndex(e => e.protocol === evaluation.protocol);
  const next = {
    ...data.evaluations[idx] || {},
    ...evaluation,
    updatedAt: new Date().toISOString(),
  };
  if (idx === -1) data.evaluations.push(next); else data.evaluations[idx] = next;
  writeAllEvaluations(data);
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
  ensureFile();
  fs.writeFileSync(EVALUATORS_FILE, JSON.stringify(evaluators, null, 2), 'utf8');
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
};
