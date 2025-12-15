const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const SUBMISSIONS_FILE = path.join(DATA_DIR, 'submissions.json');

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(SUBMISSIONS_FILE)) {
    fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify({ submissions: [] }, null, 2), 'utf8');
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

module.exports = {
  listSubmissions,
  getByProtocol,
  hasCpfHash,
  addSubmission,
  updateByProtocol,
  clearAllSubmissions,
};
