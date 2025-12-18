const fs = require('fs');
const path = require('path');

class JsonAppealRepository {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.filePath = path.join(dataDir, 'appeals.json');
    this.appeals = [];
    this.ensureFile();
    this.load();
  }

  ensureFile() {
    try {
      if (!fs.existsSync(this.dataDir)) fs.mkdirSync(this.dataDir, { recursive: true });
      if (!fs.existsSync(this.filePath)) {
        fs.writeFileSync(this.filePath, JSON.stringify([], null, 2), 'utf8');
      }
    } catch (err) {
      console.error('Error ensuring appeals file:', err);
    }
  }

  load() {
    this.ensureFile();
    if (fs.existsSync(this.filePath)) {
      try {
        const data = fs.readFileSync(this.filePath, 'utf8');
        const parsed = JSON.parse(data);
        this.appeals = Array.isArray(parsed) ? parsed : (parsed?.appeals || []);
      } catch (err) {
        console.error('Error loading appeals:', err);
        this.appeals = [];
      }
    }
  }

  save(appeal) {
    this.appeals.push(appeal);
    this.persist();
  }

  persist() {
    try {
      this.ensureFile();
      fs.writeFileSync(this.filePath, JSON.stringify(this.appeals, null, 2), 'utf8');
    } catch (err) {
      console.error('Error saving appeals:', err);
    }
  }
  
  findAll() {
      return this.appeals;
  }

  findByProtocol(protocol) {
    const needle = String(protocol || '').trim();
    if (!needle) return null;
    return this.appeals.find((a) => String(a?.protocol || '').trim() === needle) || null;
  }

  findBySubmissionProtocol(submissionProtocol) {
    const needle = String(submissionProtocol || '').trim();
    if (!needle) return [];
    return this.appeals
      .filter((a) => String(a?.submissionProtocol || '').trim() === needle)
      .sort((a, b) => String(b?.createdAt || '').localeCompare(String(a?.createdAt || '')));
  }

  updateStatus(protocol, status) {
    const needle = String(protocol || '').trim();
    if (!needle) return null;

    const idx = this.appeals.findIndex((a) => String(a?.protocol || '').trim() === needle);
    if (idx === -1) return null;

    const next = { ...this.appeals[idx], status: String(status || '').trim(), updatedAt: new Date().toISOString() };
    this.appeals[idx] = next;
    this.persist();
    return next;
  }
}

module.exports = JsonAppealRepository;
