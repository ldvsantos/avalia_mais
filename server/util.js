const crypto = require('crypto');

function stableStringify(value) {
  if (value === null || value === undefined) return 'null';
  const t = typeof value;
  if (t === 'number' || t === 'boolean') return JSON.stringify(value);
  if (t === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  if (t === 'object') {
    const keys = Object.keys(value).sort();
    return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(value[k])).join(',') + '}';
  }
  return JSON.stringify(String(value));
}

function sha256Hex(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function hmacSha256Hex(secret, input) {
  return crypto.createHmac('sha256', secret).update(input).digest('hex');
}

function generateProtocol(prefix = 'PLANTERR', year = '2025') {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = crypto.randomBytes(6).toString('hex').toUpperCase();
  return `${prefix}-${year}-${y}${m}${d}-${rand}`;
}

function isValidCPF(raw) {
  const cpf = String(raw || '').replace(/\D/g, '');
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  if (cpf === '01234567890' || cpf === '12345678909') return false;

  const digits = cpf.split('').map(Number);
  const calcDV = (baseLen) => {
    let sum = 0;
    for (let i = 0; i < baseLen; i++) {
      sum += digits[i] * ((baseLen + 1) - i);
    }
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };

  const dv1 = calcDV(9);
  const dv2 = calcDV(10);
  return dv1 === digits[9] && dv2 === digits[10];
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function csvEscape(value) {
  const s = String(value ?? '');
  if (/[";\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function formatPtBrDateTime(iso) {
  try {
    return new Date(iso).toLocaleString('pt-BR');
  } catch {
    return String(iso ?? '');
  }
}

function parseDateRange(fromStr, toStr) {
  const fromRaw = String(fromStr ?? '').trim();
  const toRaw = String(toStr ?? '').trim();

  const from = fromRaw ? new Date(fromRaw + 'T00:00:00') : null;
  const to = toRaw ? new Date(toRaw + 'T23:59:59.999') : null;
  const fromOk = from && !Number.isNaN(from.getTime()) ? from : null;
  const toOk = to && !Number.isNaN(to.getTime()) ? to : null;
  return { from: fromOk, to: toOk };
}

module.exports = {
  stableStringify,
  sha256Hex,
  hmacSha256Hex,
  generateProtocol,
  isValidCPF,
  escapeHtml,
  csvEscape,
  formatPtBrDateTime,
  parseDateRange,
};
