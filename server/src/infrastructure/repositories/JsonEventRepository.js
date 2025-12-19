const fs = require('fs');
const path = require('path');
const { getRequestContext } = require('../../../request-context');

function pickActor(ctx) {
  const a = ctx?.actor;
  if (!a) return { type: 'unknown' };
  if (a.type === 'public') return { type: 'public' };
  return {
    type: a.type,
    user: a.user,
    role: a.role,
    line: a.line,
    num: a.num,
  };
}

function ensureAuditBase(entity, ctx, { isCreate }) {
  const now = new Date().toISOString();
  const actor = pickActor(ctx);
  const ip = ctx?.ip;
  const userAgent = ctx?.userAgent;
  const requestId = ctx?.requestId;

  if (!entity.audit || typeof entity.audit !== 'object') {
    entity.audit = { history: [] };
  }
  if (!Array.isArray(entity.audit.history)) entity.audit.history = [];

  if (isCreate) {
    entity.audit.createdAt = entity.audit.createdAt || now;
    entity.audit.createdBy = entity.audit.createdBy || actor;
    entity.audit.createdIp = entity.audit.createdIp || ip;
    entity.audit.createdUserAgent = entity.audit.createdUserAgent || userAgent;
  }

  entity.audit.updatedAt = now;
  entity.audit.updatedBy = actor;
  entity.audit.updatedIp = ip;
  entity.audit.updatedUserAgent = userAgent;
  entity.audit.updatedRequestId = requestId;
}

class JsonEventRepository {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.filePath = path.join(dataDir, 'events.json');
    this.ensureFile();
  }

  ensureFile() {
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, '[]', 'utf8');
    }
  }

  async findAll() {
    const data = fs.readFileSync(this.filePath, 'utf8');
    return JSON.parse(data);
  }

  async findById(id) {
    const all = await this.findAll();
    return all.find(e => e.id === id) || null;
  }

  async save(event) {
    const all = await this.findAll();
    const index = all.findIndex(e => e.id === event.id);
    
    const ctx = getRequestContext();
    
    if (index >= 0) {
      // Update
      ensureAuditBase(event, ctx, { isCreate: false });
      event.audit.history.push({
        action: 'UPDATE',
        at: new Date().toISOString(),
        by: pickActor(ctx)
      });
      all[index] = event;
    } else {
      // Create
      ensureAuditBase(event, ctx, { isCreate: true });
      event.audit.history.push({
        action: 'CREATE',
        at: new Date().toISOString(),
        by: pickActor(ctx)
      });
      all.push(event);
    }

    fs.writeFileSync(this.filePath, JSON.stringify(all, null, 2), 'utf8');
    return event;
  }

  async delete(id) {
    let all = await this.findAll();
    const initialLength = all.length;
    all = all.filter(e => e.id !== id);
    
    if (all.length !== initialLength) {
      fs.writeFileSync(this.filePath, JSON.stringify(all, null, 2), 'utf8');
      return true;
    }
    return false;
  }
}

module.exports = JsonEventRepository;
