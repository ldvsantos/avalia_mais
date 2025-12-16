const fs = require('fs');
const path = require('path');
const Evaluation = require('../../domain/Evaluation');
const { getRequestContext } = require('../../../request-context');
const { logEvaluationCreated, logEvaluationModified } = require('../../../security-logger');

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

function diffObjectKeys(before = {}, after = {}, { maxKeys = 40 } = {}) {
  const a = before && typeof before === 'object' ? before : {};
  const b = after && typeof after === 'object' ? after : {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const changed = [];
  for (const k of keys) {
    const av = a[k];
    const bv = b[k];
    // Comparação simples e estável (valores são primitivos na prática)
    if (String(av ?? '') !== String(bv ?? '')) {
      changed.push(k);
      if (changed.length >= maxKeys) break;
    }
  }
  return changed;
}

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
      const list = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.evaluations) ? parsed.evaluations : []);
      return list.map(data => new Evaluation(data));
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

  // Compat: alguns casos de uso esperam getAll()
  getAll() {
    return this.findAll();
  }

  findByProtocol(protocol) {
    const evaluations = this.readAll();
    return evaluations.find(e => e.protocol === protocol) || null;
  }

  save(evaluation) {
    const evaluations = this.readAll();
    const idx = evaluations.findIndex(e => e.protocol === evaluation.protocol);
    const ctx = getRequestContext();
    
    if (idx >= 0) {
      const before = evaluations[idx];
      ensureAuditBase(evaluation, ctx, { isCreate: false });

      const changedProjectKeys = diffObjectKeys(before?.projectScores, evaluation?.projectScores);
      const changedInterviewKeys = diffObjectKeys(before?.interviewScores, evaluation?.interviewScores);
      const changedLanguageKeys = diffObjectKeys(before?.languageScores, evaluation?.languageScores);
      const changedScoreKeys = [...changedProjectKeys, ...changedInterviewKeys, ...changedLanguageKeys];

      const changes = {
        eliminado: before?.eliminado !== evaluation?.eliminado ? { from: before?.eliminado, to: evaluation?.eliminado } : undefined,
        proj_total: before?.proj_total !== evaluation?.proj_total ? { from: before?.proj_total, to: evaluation?.proj_total } : undefined,
        int_total: before?.int_total !== evaluation?.int_total ? { from: before?.int_total, to: evaluation?.int_total } : undefined,
        lang_total: before?.lang_total !== evaluation?.lang_total ? { from: before?.lang_total, to: evaluation?.lang_total } : undefined,
      };
      evaluation.audit.history.push({
        at: new Date().toISOString(),
        actor: pickActor(ctx),
        ip: ctx?.ip,
        requestId: ctx?.requestId,
        action: 'update',
        changes,
        scoreChangedKeys: changedScoreKeys,
        scoreChangedCounts: {
          project: changedProjectKeys.length,
          interview: changedInterviewKeys.length,
          language: changedLanguageKeys.length,
        },
      });
      if (evaluation.audit.history.length > 50) {
        evaluation.audit.history = evaluation.audit.history.slice(-50);
      }

      logEvaluationModified({
        requestId: ctx?.requestId,
        protocol: evaluation.protocol,
        actor: pickActor(ctx),
        ip: ctx?.ip,
        userAgent: ctx?.userAgent,
        eliminated: evaluation.eliminado,
        changedTotals: {
          proj_total: before?.proj_total !== evaluation?.proj_total,
          int_total: before?.int_total !== evaluation?.int_total,
          lang_total: before?.lang_total !== evaluation?.lang_total,
        },
        scoreChangedCounts: {
          project: changedProjectKeys.length,
          interview: changedInterviewKeys.length,
          language: changedLanguageKeys.length,
        },
        scoreChangedKeys: changedScoreKeys,
      });

      evaluations[idx] = evaluation;
    } else {
      ensureAuditBase(evaluation, ctx, { isCreate: true });
      evaluation.audit.history.push({
        at: new Date().toISOString(),
        actor: pickActor(ctx),
        ip: ctx?.ip,
        requestId: ctx?.requestId,
        action: 'create',
      });

      logEvaluationCreated({
        requestId: ctx?.requestId,
        protocol: evaluation.protocol,
        actor: pickActor(ctx),
        ip: ctx?.ip,
        userAgent: ctx?.userAgent,
      });

      evaluations.push(evaluation);
    }
    
    this.saveAll(evaluations);
    return evaluation;
  }
}

module.exports = JsonEvaluationRepository;
