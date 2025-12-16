const fs = require('fs');
const path = require('path');
const Evaluation = require('../../domain/Evaluation');

class JsonEvaluationRepository {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.filePath = path.join(dataDir, 'evaluations.json');
    this.ensureFile();
  }

  ensureFile() {
    if (!fs.existsSync(this.dataDir)) fs.mkdirSync(this.dataDir, { recursive: true });
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, JSON.stringify({ evaluations: [] }, null, 2), 'utf8');
    }
  }

  readAll() {
    this.ensureFile();
    try {
      const raw = fs.readFileSync(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      return (parsed.evaluations || []).map(data => new Evaluation(data));
    } catch {
      return [];
    }
  }

  saveAll(evaluations) {
    this.ensureFile();
    fs.writeFileSync(this.filePath, JSON.stringify({ evaluations }, null, 2), 'utf8');
  }

  findAll() {
    return this.readAll();
  }

  findByProtocol(protocol) {
    const evaluations = this.readAll();
    return evaluations.find(e => e.protocol === protocol) || null;
  }

  save(evaluation) {
    const evaluations = this.readAll();
    const idx = evaluations.findIndex(e => e.protocol === evaluation.protocol);
    
    if (idx >= 0) {
      evaluations[idx] = evaluation;
    } else {
      evaluations.push(evaluation);
    }
    
    this.saveAll(evaluations);
    return evaluation;
  }
}

module.exports = JsonEvaluationRepository;
