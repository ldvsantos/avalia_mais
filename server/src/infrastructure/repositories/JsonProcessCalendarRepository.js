const fs = require('fs');
const path = require('path');
const { safeWriteFileUtf8Atomic } = require('./fileUtils');

function toIsoOrNull(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function defaultYearCalendar(year) {
  const start = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0)).toISOString();
  const end = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)).toISOString();

  const phaseKeys = [
    'INSCRICAO',
    'RECURSO_INSCRICAO',
    'PROJETO',
    'RECURSO_PROJETO',
    'ENTREVISTA',
    'RECURSO_ENTREVISTA',
    'LINGUA',
    'RECURSO_LINGUA',
  ];

  const phases = {};
  for (const k of phaseKeys) {
    phases[k] = { startISO: start, endISO: end };
  }

  return {
    year,
    global: { startISO: start, endISO: end },
    phases,
    updatedAt: new Date().toISOString(),
  };
}

function validateWindow(label, window) {
  if (!window || typeof window !== 'object') {
    throw new Error(`Janela inválida: ${label}`);
  }
  const startISO = toIsoOrNull(window.startISO);
  const endISO = toIsoOrNull(window.endISO);
  if (!startISO || !endISO) {
    throw new Error(`Janela ${label} precisa de startISO e endISO válidos`);
  }
  if (new Date(startISO) >= new Date(endISO)) {
    throw new Error(`Janela ${label} inválida (início >= fim)`);
  }
  return { startISO, endISO };
}

class JsonProcessCalendarRepository {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.filePath = path.join(dataDir, 'process_calendar.json');
    this.ensureFile();
  }

  ensureFile() {
    if (!fs.existsSync(this.dataDir)) fs.mkdirSync(this.dataDir, { recursive: true });
    if (!fs.existsSync(this.filePath)) {
      const initial = { editais: {}, updatedAt: new Date().toISOString() };
      safeWriteFileUtf8Atomic(this.filePath, JSON.stringify(initial, null, 2));
    }
  }

  readAll() {
    this.ensureFile();
    try {
      const raw = fs.readFileSync(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') {
        return { editais: {}, updatedAt: new Date().toISOString() };
      }
      if (!parsed.editais || typeof parsed.editais !== 'object') parsed.editais = {};
      return parsed;
    } catch {
      return { editais: {}, updatedAt: new Date().toISOString() };
    }
  }

  writeAll(data) {
    this.ensureFile();
    safeWriteFileUtf8Atomic(this.filePath, JSON.stringify(data, null, 2));
  }

  getOrCreateYear(year, { seedRegistrationWindow } = {}) {
    const y = Number(year);
    if (!Number.isFinite(y) || y < 2000 || y > 2100) {
      throw new Error('Ano do edital inválido');
    }

    const data = this.readAll();
    const key = String(y);
    if (!data.editais[key]) {
      data.editais[key] = defaultYearCalendar(y);

      if (seedRegistrationWindow && seedRegistrationWindow.startISO && seedRegistrationWindow.endISO) {
        try {
          const seeded = validateWindow('INSCRICAO', seedRegistrationWindow);
          data.editais[key].phases.INSCRICAO = seeded;
        } catch {
          // ignore seed errors
        }
      }

      data.updatedAt = new Date().toISOString();
      this.writeAll(data);
    }
    return data.editais[key];
  }

  setYearCalendar(year, calendar) {
    const y = Number(year);
    const key = String(y);

    const next = {
      year: y,
      global: validateWindow('GLOBAL', calendar?.global),
      phases: {},
      updatedAt: new Date().toISOString(),
    };

    const requiredPhaseKeys = [
      'INSCRICAO',
      'RECURSO_INSCRICAO',
      'PROJETO',
      'RECURSO_PROJETO',
      'ENTREVISTA',
      'RECURSO_ENTREVISTA',
      'LINGUA',
      'RECURSO_LINGUA',
    ];

    for (const phaseKey of requiredPhaseKeys) {
      next.phases[phaseKey] = validateWindow(phaseKey, calendar?.phases?.[phaseKey]);
    }

    const data = this.readAll();
    data.editais[key] = next;
    data.updatedAt = new Date().toISOString();
    this.writeAll(data);

    return next;
  }

  updatePhaseWindow(year, phaseKey, window) {
    const y = Number(year);
    const key = String(y);
    const phase = String(phaseKey || '').trim();
    if (!phase) throw new Error('Fase inválida');

    const data = this.readAll();
    if (!data.editais[key]) {
      data.editais[key] = defaultYearCalendar(y);
    }

    data.editais[key].phases = data.editais[key].phases && typeof data.editais[key].phases === 'object'
      ? data.editais[key].phases
      : {};

    data.editais[key].phases[phase] = validateWindow(phase, window);
    data.editais[key].updatedAt = new Date().toISOString();
    data.updatedAt = data.editais[key].updatedAt;
    this.writeAll(data);
    return data.editais[key];
  }
}

module.exports = JsonProcessCalendarRepository;
