const fs = require('fs');
const path = require('path');

class JsonAppealRepository {
  constructor(dataDir) {
    this.filePath = path.join(dataDir, 'appeals.json');
    this.appeals = [];
    this.load();
  }

  load() {
    if (fs.existsSync(this.filePath)) {
      try {
        const data = fs.readFileSync(this.filePath, 'utf8');
        this.appeals = JSON.parse(data);
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
      fs.writeFileSync(this.filePath, JSON.stringify(this.appeals, null, 2));
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
}

module.exports = JsonAppealRepository;
