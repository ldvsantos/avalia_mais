const fs = require('fs');
const path = require('path');
const Submission = require('../../domain/Submission');
const { getRequestContext } = require('../../../request-context');
const { logSubmissionCreated, logSubmissionModified } = require('../../../security-logger');

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
    const ctx = getRequestContext();
    
    if (idx >= 0) {
      ensureAuditBase(submission, ctx, { isCreate: false });

      const beforeStatus = submissions[idx]?.status;
      const afterStatus = submission?.status;
      const statusChanged = beforeStatus !== afterStatus;
      submission.audit.history.push({
        at: new Date().toISOString(),
        actor: pickActor(ctx),
        ip: ctx?.ip,
        requestId: ctx?.requestId,
        action: 'update',
        changes: {
          status: statusChanged ? { from: beforeStatus, to: afterStatus } : undefined,
        },
      });
      if (submission.audit.history.length > 50) {
        submission.audit.history = submission.audit.history.slice(-50);
      }

      logSubmissionModified({
        requestId: ctx?.requestId,
        protocol: submission.protocol,
        actor: pickActor(ctx),
        ip: ctx?.ip,
        userAgent: ctx?.userAgent,
        changedKeys: statusChanged ? ['status'] : [],
      });

      submissions[idx] = submission;
    } else {
      ensureAuditBase(submission, ctx, { isCreate: true });
      submission.audit.history.push({
        at: new Date().toISOString(),
        actor: pickActor(ctx),
        ip: ctx?.ip,
        requestId: ctx?.requestId,
        action: 'create',
      });

      logSubmissionCreated({
        requestId: ctx?.requestId,
        protocol: submission.protocol,
        cpfLast4: submission.cpfLast4,
        actor: pickActor(ctx),
        ip: ctx?.ip,
        userAgent: ctx?.userAgent,
      });

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
