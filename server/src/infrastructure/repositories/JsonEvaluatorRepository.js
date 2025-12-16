const fs = require('fs');
const path = require('path');
const Evaluator = require('../../domain/Evaluator');

class JsonEvaluatorRepository {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.filePath = path.join(dataDir, 'evaluators.json');
    
    // Default evaluators if file doesn't exist
    this.defaultEvaluators = {
      'av1-l1': { pass: 'planter2025', line: '1', num: '1' },
      'av2-l1': { pass: 'planter2025', line: '1', num: '2' },
      'av3-l1': { pass: 'planter2025', line: '1', num: '3' },
      'av1-l2': { pass: 'planter2025', line: '2', num: '1' },
      'av2-l2': { pass: 'planter2025', line: '2', num: '2' },
      'av3-l2': { pass: 'planter2025', line: '2', num: '3' },
    };
    
    this.ensureFile();
  }

  ensureFile() {
    if (!fs.existsSync(this.dataDir)) fs.mkdirSync(this.dataDir, { recursive: true });
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, JSON.stringify(this.defaultEvaluators, null, 2), 'utf8');
    }
  }

  getAll() {
    this.ensureFile();
    try {
      const raw = fs.readFileSync(this.filePath, 'utf8');
      const data = JSON.parse(raw);
      const evaluators = [];
      for (const [username, info] of Object.entries(data)) {
        evaluators.push(new Evaluator(username, info.pass, info.line, info.num));
      }
      return evaluators;
    } catch {
      return [];
    }
  }

  findByUsername(username) {
    const evaluators = this.getAll();
    return evaluators.find(e => e.username === username) || null;
  }

  save(evaluator) {
    this.ensureFile();
    const raw = fs.readFileSync(this.filePath, 'utf8');
    const data = JSON.parse(raw);
    
    data[evaluator.username] = {
      pass: evaluator.password,
      line: evaluator.line,
      num: evaluator.num
    };

    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf8');
  }
  
  // Method to handle username changes (delete old, add new)
  updateUsername(oldUsername, newEvaluator) {
    this.ensureFile();
    const raw = fs.readFileSync(this.filePath, 'utf8');
    const data = JSON.parse(raw);

    if (data[oldUsername]) {
      delete data[oldUsername];
    }

    data[newEvaluator.username] = {
      pass: newEvaluator.password,
      line: newEvaluator.line,
      num: newEvaluator.num
    };

    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf8');
  }
}

module.exports = JsonEvaluatorRepository;
