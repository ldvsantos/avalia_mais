const fs = require('fs');
const path = require('path');
const Submission = require('../../domain/Submission');

class JsonSubmissionRepository {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.filePath = path.join(dataDir, 'submissions.json');
    this.ensureFile();
  }

  ensureFile() {
    if (!fs.existsSync(this.dataDir)) fs.mkdirSync(this.dataDir, { recursive: true });
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, JSON.stringify({ submissions: [] }, null, 2), 'utf8');
    }
  }

  readAll() {
    this.ensureFile();
    try {
      const raw = fs.readFileSync(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      return (parsed.submissions || []).map(data => new Submission(data));
    } catch {
      return [];
    }
  }

  saveAll(submissions) {
    this.ensureFile();
    fs.writeFileSync(this.filePath, JSON.stringify({ submissions }, null, 2), 'utf8');
  }

  findAll() {
    return this.readAll().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }

  // Compat: alguns casos de uso esperam getAll()
  getAll() {
    return this.findAll();
  }

  findByProtocol(protocol) {
    const submissions = this.readAll();
    return submissions.find(s => s.protocol === protocol) || null;
  }

  existsCpfHash(cpfHash) {
    const submissions = this.readAll();
    return submissions.some(s => s.cpfHash === cpfHash);
  }

  save(submission) {
    const submissions = this.readAll();
    const idx = submissions.findIndex(s => s.protocol === submission.protocol);
    
    if (idx >= 0) {
      submissions[idx] = submission;
    } else {
      submissions.push(submission);
    }
    
    this.saveAll(submissions);
    return submission;
  }

  clearAll() {
    this.saveAll([]);
  }
}

module.exports = JsonSubmissionRepository;
