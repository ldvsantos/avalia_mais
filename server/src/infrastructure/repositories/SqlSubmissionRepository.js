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

function mapRowToSubmission(row) {
  if (!row) return null;

  return new Submission({
    protocol: row.protocol,
    hash: row.hash,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
    status: row.status,
    adminNotes: row.admin_notes,
    cpfHash: row.cpf_hash,
    cpfLast4: row.cpf_last4,
    formVersion: row.form_version,
    identified: row.identified || {},
    project: row.project || {},
    blind: row.blind || {},
    integrity: row.integrity || {},
    adminUpdatedAt: row.admin_updated_at ? new Date(row.admin_updated_at).toISOString() : undefined,
    audit: row.audit || null,
  });
}

class SqlSubmissionRepository {
  constructor({ pool }) {
    if (!pool) throw new Error('SqlSubmissionRepository requer pool do Postgres.');
    this.pool = pool;
    this._integrityColumnChecked = false;
  }

  async ensureIntegrityColumn() {
    if (this._integrityColumnChecked) return;
    try {
      // Tenta adicionar a coluna se não existir.
      // IF NOT EXISTS é suportado no Postgres 9.6+.
      await this.pool.query(`
        ALTER TABLE submissions ADD COLUMN IF NOT EXISTS integrity JSONB DEFAULT '{}'::jsonb;
      `);
      this._integrityColumnChecked = true;
    } catch (err) {
      console.error('Erro ao verificar/criar coluna integrity:', err);
      // Se falhar, pode ser que a versão do PG não suporte IF NOT EXISTS ou erro de permissão.
      // Segue o fluxo, se a coluna não existir o INSERT/SELECT vai falhar naturalmente.
    }
  }

  async findAll() {
    await this.ensureIntegrityColumn();
    const { rows } = await this.pool.query(
      `SELECT protocol, hash, created_at, status, admin_notes, cpf_hash, cpf_last4, form_version,
              identified, project, blind, integrity, admin_updated_at, audit
         FROM submissions
        ORDER BY created_at DESC`
    );

    return rows.map(mapRowToSubmission);
  }

  // Compat: alguns casos de uso esperam getAll()
  async getAll() {
    return this.findAll();
  }

  async findByProtocol(protocol) {
    const p = String(protocol || '').trim();
    if (!p) return null;

    await this.ensureIntegrityColumn();
    const { rows } = await this.pool.query(
      `SELECT protocol, hash, created_at, status, admin_notes, cpf_hash, cpf_last4, form_version,
              identified, project, blind, integrity, admin_updated_at, audit
         FROM submissions
        WHERE protocol = $1
        LIMIT 1`,
      [p]
    );

    return mapRowToSubmission(rows[0] || null);
  }

  async existsCpfHash(cpfHash) {
    const h = String(cpfHash || '').trim();
    if (!h) return false;

    const { rows } = await this.pool.query(
      'SELECT 1 FROM submissions WHERE cpf_hash = $1 LIMIT 1',
      [h]
    );
    return rows.length > 0;
  }

  async save(submission) {
    if (!submission) throw new Error('submission é obrigatório');
    const protocol = String(submission.protocol || '').trim();
    if (!protocol) throw new Error('submission.protocol é obrigatório');

    await this.ensureIntegrityColumn();
    const ctx = getRequestContext();

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const existingRes = await client.query(
        'SELECT status, audit FROM submissions WHERE protocol = $1 FOR UPDATE',
        [protocol]
      );

      const isUpdate = existingRes.rowCount > 0;
      const beforeStatus = isUpdate ? existingRes.rows[0]?.status : undefined;

      if (isUpdate) {
        // Mantém audit existente como base (caso o objeto venha sem audit)
        if (!submission.audit && existingRes.rows[0]?.audit) {
          submission.audit = existingRes.rows[0].audit;
        }
        ensureAuditBase(submission, ctx, { isCreate: false });

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
          protocol,
          actor: pickActor(ctx),
          ip: ctx?.ip,
          userAgent: ctx?.userAgent,
          changedKeys: statusChanged ? ['status'] : [],
        });
      } else {
        ensureAuditBase(submission, ctx, { isCreate: true });
        submission.audit.history.push({
          at: new Date().toISOString(),
          actor: pickActor(ctx),
          ip: ctx?.ip,
          requestId: ctx?.requestId,
          action: 'create',
        });
        if (submission.audit.history.length > 50) {
          submission.audit.history = submission.audit.history.slice(-50);
        }

        logSubmissionCreated({
          requestId: ctx?.requestId,
          protocol,
          cpfLast4: submission.cpfLast4,
          actor: pickActor(ctx),
          ip: ctx?.ip,
          userAgent: ctx?.userAgent,
        });
      }

      const createdAt = submission.createdAt ? new Date(submission.createdAt) : new Date();
      const adminUpdatedAt = submission.adminUpdatedAt ? new Date(submission.adminUpdatedAt) : null;

      const identifiedJson = submission.identified ? JSON.stringify(submission.identified) : null;
      const projectJson = submission.project ? JSON.stringify(submission.project) : null;
      const blindJson = submission.blind ? JSON.stringify(submission.blind) : null;
      const integrityJson = submission.integrity ? JSON.stringify(submission.integrity) : '{}';
      const auditJson = submission.audit ? JSON.stringify(submission.audit) : null;
      const adminNotes = submission.adminNotes != null ? String(submission.adminNotes) : null;

      await client.query(
        `INSERT INTO submissions (
           protocol, hash, created_at, status, admin_notes,
           cpf_hash, cpf_last4, form_version,
           identified, project, blind, integrity,
           admin_updated_at, audit
         ) VALUES (
           $1, $2, $3, $4, $5,
           $6, $7, $8,
           $9::jsonb, $10::jsonb, $11::jsonb, $12::jsonb,
           $13, $14::jsonb
         )
         ON CONFLICT (protocol) DO UPDATE SET
           hash = EXCLUDED.hash,
           created_at = EXCLUDED.created_at,
           status = EXCLUDED.status,
           admin_notes = EXCLUDED.admin_notes,
           cpf_hash = EXCLUDED.cpf_hash,
           cpf_last4 = EXCLUDED.cpf_last4,
           form_version = EXCLUDED.form_version,
           identified = EXCLUDED.identified,
           project = EXCLUDED.project,
           blind = EXCLUDED.blind,
           integrity = EXCLUDED.integrity,
           admin_updated_at = EXCLUDED.admin_updated_at,
           audit = EXCLUDED.audit`,
        [
          protocol,
          String(submission.hash || ''),
          createdAt,
          submission.status != null ? String(submission.status) : null,
          adminNotes,
          submission.cpfHash != null ? String(submission.cpfHash) : null,
          submission.cpfLast4 != null ? String(submission.cpfLast4) : null,
          submission.formVersion != null ? String(submission.formVersion) : null,
          identifiedJson,
          projectJson,
          blindJson,
          integrityJson,
          adminUpdatedAt,
          auditJson,
        ]
      );

      await client.query('COMMIT');
      return submission;
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

  async clearAll() {
    await this.pool.query('DELETE FROM submissions');
  }
}

module.exports = SqlSubmissionRepository;
