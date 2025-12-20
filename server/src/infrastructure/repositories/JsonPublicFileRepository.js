const fs = require('fs');
const path = require('path');
const { safeWriteFileUtf8Atomic } = require('./fileUtils');

class JsonPublicFileRepository {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.filePath = path.join(dataDir, 'public_files.json');
    this.ensureFile();
  }

  ensureFile() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    if (!fs.existsSync(this.filePath)) {
      safeWriteFileUtf8Atomic(this.filePath, JSON.stringify([], null, 2));
    }
  }

  getAll() {
    try {
      if (!fs.existsSync(this.filePath)) return [];
      const data = fs.readFileSync(this.filePath, 'utf8');
      return JSON.parse(data);
    } catch (err) {
      console.error('Error reading public files:', err);
      return [];
    }
  }

  findById(id) {
    const files = this.getAll();
    return files.find(f => f.id === id) || null;
  }

  add(fileData) {
    const files = this.getAll();
    files.push(fileData);
    this.save(files);
    return fileData;
  }

  update(id, updates) {
    const files = this.getAll();
    const index = files.findIndex(f => f.id === id);
    if (index !== -1) {
      files[index] = { ...files[index], ...updates };
      this.save(files);
      return files[index];
    }
    return null;
  }

  remove(id) {
    let files = this.getAll();
    const fileToRemove = files.find(f => f.id === id);
    if (fileToRemove) {
      files = files.filter(f => f.id !== id);
      this.save(files);
    }
    return fileToRemove;
  }

  save(files) {
    safeWriteFileUtf8Atomic(this.filePath, JSON.stringify(files, null, 2));
  }
}

module.exports = JsonPublicFileRepository;
