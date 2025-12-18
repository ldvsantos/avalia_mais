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

function mapRowToEvaluation(row) {
  if (!row) return null;
  return new Evaluation({
    protocol: row.protocol,
    projectScores: row.project_scores || {},
    interviewScores: row.interview_scores || {},
    languageScores: row.language_scores || {},
    proj_total: row.proj_total != null ? Number(row.proj_total) : 0,
    int_total: row.int_total != null ? Number(row.int_total) : 0,
    lang_total: row.lang_total != null ? Number(row.lang_total) : 0,
    eliminado: Boolean(row.eliminado),
    observacoes: row.observacoes || '',
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
    audit: row.audit || null,
  });
}

class SqlEvaluationRepository {
  constructor({ pool }) {
    if (!pool) throw new Error('SqlEvaluationRepository requer pool do Postgres.');
    this.pool = pool;
  }

  async findAll() {
    const { rows } = await this.pool.query(
      `SELECT protocol, project_scores, interview_scores, language_scores,
              proj_total, int_total, lang_total,
              eliminado, observacoes, updated_at, audit
         FROM evaluations`
    );
    return rows.map(mapRowToEvaluation);
  }

  async getAll() {
    return this.findAll();
  }

  async findByProtocol(protocol) {
    const p = String(protocol || '').trim();
    if (!p) return null;

    const { rows } = await this.pool.query(
      `SELECT protocol, project_scores, interview_scores, language_scores,
              proj_total, int_total, lang_total,
              eliminado, observacoes, updated_at, audit
         FROM evaluations
        WHERE protocol = $1
        LIMIT 1`,
      [p]
    );

    return mapRowToEvaluation(rows[0] || null);
  }

  async save(evaluation) {
    if (!evaluation) throw new Error('evaluation é obrigatório');
    const protocol = String(evaluation.protocol || '').trim();
    if (!protocol) throw new Error('evaluation.protocol é obrigatório');

    const ctx = getRequestContext();

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const existingRes = await client.query(
        'SELECT audit FROM evaluations WHERE protocol = $1 FOR UPDATE',
        [protocol]
      );

      const isUpdate = existingRes.rowCount > 0;
      if (isUpdate) {
        if (!evaluation.audit && existingRes.rows[0]?.audit) evaluation.audit = existingRes.rows[0].audit;
        ensureAuditBase(evaluation, ctx, { isCreate: false });

        logEvaluationModified({
          requestId: ctx?.requestId,
          protocol,
          actor: pickActor(ctx),
          ip: ctx?.ip,
          userAgent: ctx?.userAgent,
          eliminated: evaluation.eliminado,
        });
      } else {
        ensureAuditBase(evaluation, ctx, { isCreate: true });
        logEvaluationCreated({
          requestId: ctx?.requestId,
          protocol,
          actor: pickActor(ctx),
          ip: ctx?.ip,
          userAgent: ctx?.userAgent,
        });
      }

      const projectScoresJson = JSON.stringify(evaluation.projectScores || {});
      const interviewScoresJson = JSON.stringify(evaluation.interviewScores || {});
      const languageScoresJson = JSON.stringify(evaluation.languageScores || {});
      const auditJson = evaluation.audit ? JSON.stringify(evaluation.audit) : null;

      await client.query(
        `INSERT INTO evaluations (
           protocol,
           project_scores, interview_scores, language_scores,
           proj_total, int_total, lang_total,
           eliminado, observacoes,
           updated_at, audit
         ) VALUES (
           $1,
           $2::jsonb, $3::jsonb, $4::jsonb,
           $5, $6, $7,
           $8, $9,
           $10, $11::jsonb
         )
         ON CONFLICT (protocol) DO UPDATE SET
           project_scores = EXCLUDED.project_scores,
           interview_scores = EXCLUDED.interview_scores,
           language_scores = EXCLUDED.language_scores,
           proj_total = EXCLUDED.proj_total,
           int_total = EXCLUDED.int_total,
           lang_total = EXCLUDED.lang_total,
           eliminado = EXCLUDED.eliminado,
           observacoes = EXCLUDED.observacoes,
           updated_at = EXCLUDED.updated_at,
           audit = EXCLUDED.audit`,
        [
          protocol,
          projectScoresJson,
          interviewScoresJson,
          languageScoresJson,
          evaluation.proj_total != null ? Number(evaluation.proj_total) : null,
          evaluation.int_total != null ? Number(evaluation.int_total) : null,
          evaluation.lang_total != null ? Number(evaluation.lang_total) : null,
          Boolean(evaluation.eliminado),
          evaluation.observacoes != null ? String(evaluation.observacoes) : null,
          evaluation.updatedAt ? new Date(evaluation.updatedAt) : new Date(),
          auditJson,
        ]
      );

      await client.query('COMMIT');
      return evaluation;
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // noop
      }
      throw err;
    } finally {
      client.release();
    }
  }
}

module.exports = SqlEvaluationRepository;
