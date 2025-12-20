const fs = require('fs');
const path = require('path');
const { safeWriteFileUtf8Atomic } = require('./fileUtils');

class JsonCandidatePhaseStatusRepository {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.filePath = path.join(dataDir, 'candidate_phase_status.json');
    this.ensureFile();
  }

  ensureFile() {
    if (!fs.existsSync(this.dataDir)) fs.mkdirSync(this.dataDir, { recursive: true });
    if (!fs.existsSync(this.filePath)) {
      safeWriteFileUtf8Atomic(this.filePath, JSON.stringify({ statuses: [] }, null, 2));
    }
  }

  readAll() {
    this.ensureFile();
    try {
      const raw = fs.readFileSync(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return { statuses: parsed };
      if (!parsed || !Array.isArray(parsed.statuses)) return { statuses: [] };
      return parsed;
    } catch {
      return { statuses: [] };
    }
  }

  writeAll(data) {
    this.ensureFile();
    safeWriteFileUtf8Atomic(this.filePath, JSON.stringify(data, null, 2));
  }

  find(year, submissionProtocol, phaseKey) {
    const y = Number(year);
    const protocol = String(submissionProtocol || '').trim();
    const phase = String(phaseKey || '').trim();
    if (!protocol || !phase || !Number.isFinite(y)) return null;

    const { statuses } = this.readAll();
    return (
      statuses.find(
        (s) =>
          Number(s?.year) === y &&
          String(s?.submissionProtocol || '').trim() === protocol &&
          String(s?.phaseKey || '').trim() === phase
      ) || null
    );
  }

  listBySubmission(year, submissionProtocol) {
    const y = Number(year);
    const protocol = String(submissionProtocol || '').trim();
    if (!protocol || !Number.isFinite(y)) return [];

    const { statuses } = this.readAll();
    return statuses
      .filter((s) => Number(s?.year) === y && String(s?.submissionProtocol || '').trim() === protocol)
      .slice();
  }

  upsert(record) {
    const y = Number(record?.year);
    const protocol = String(record?.submissionProtocol || '').trim();
    const phase = String(record?.phaseKey || '').trim();
    if (!Number.isFinite(y) || !protocol || !phase) {
      throw new Error('Registro de status inválido');
    }

    const next = {
      year: y,
      submissionProtocol: protocol,
      phaseKey: phase,
      status: String(record?.status || '').trim(),
      score: record?.score != null ? Number(record.score) : null,
      updatedAt: new Date().toISOString(),
      meta: record?.meta && typeof record.meta === 'object' ? record.meta : undefined,
    };

    const data = this.readAll();
    const idx = data.statuses.findIndex(
      (s) =>
        Number(s?.year) === y &&
        String(s?.submissionProtocol || '').trim() === protocol &&
        String(s?.phaseKey || '').trim() === phase
    );

    if (idx >= 0) {
      data.statuses[idx] = { ...data.statuses[idx], ...next };
    } else {
      data.statuses.push(next);
    }

    this.writeAll(data);
    return next;
  }

  findAll() {
    const { statuses } = this.readAll();
    return statuses.slice();
  }
}

module.exports = JsonCandidatePhaseStatusRepository;
