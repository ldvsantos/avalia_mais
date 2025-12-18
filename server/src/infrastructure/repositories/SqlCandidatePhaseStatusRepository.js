function mapRow(row) {
  if (!row) return null;
  return {
    year: Number(row.year),
    submissionProtocol: row.submission_protocol,
    phaseKey: row.phase_key,
    status: row.status,
    score: row.score != null ? Number(row.score) : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
    meta: row.meta || undefined,
  };
}

class SqlCandidatePhaseStatusRepository {
  constructor({ pool }) {
    if (!pool) throw new Error('SqlCandidatePhaseStatusRepository requer pool do Postgres.');
    this.pool = pool;
  }

  async find(year, submissionProtocol, phaseKey) {
    const y = Number(year);
    const protocol = String(submissionProtocol || '').trim();
    const phase = String(phaseKey || '').trim();
    if (!protocol || !phase || !Number.isFinite(y)) return null;

    const { rows } = await this.pool.query(
      `SELECT year, submission_protocol, phase_key, status, score, updated_at, meta
         FROM candidate_phase_status
        WHERE year = $1 AND submission_protocol = $2 AND phase_key = $3
        LIMIT 1`,
      [y, protocol, phase]
    );

    return mapRow(rows[0] || null);
  }

  async listBySubmission(year, submissionProtocol) {
    const y = Number(year);
    const protocol = String(submissionProtocol || '').trim();
    if (!protocol || !Number.isFinite(y)) return [];

    const { rows } = await this.pool.query(
      `SELECT year, submission_protocol, phase_key, status, score, updated_at, meta
         FROM candidate_phase_status
        WHERE year = $1 AND submission_protocol = $2`,
      [y, protocol]
    );

    return rows.map(mapRow);
  }

  async upsert(record) {
    const y = Number(record?.year);
    const protocol = String(record?.submissionProtocol || '').trim();
    const phase = String(record?.phaseKey || '').trim();
    if (!Number.isFinite(y) || !protocol || !phase) {
      throw new Error('Registro de status inválido');
    }

    const status = String(record?.status || '').trim();
    const score = record?.score != null ? Number(record.score) : null;
    const metaJson = record?.meta && typeof record.meta === 'object' ? JSON.stringify(record.meta) : null;

    const { rows } = await this.pool.query(
      `INSERT INTO candidate_phase_status (
         year, submission_protocol, phase_key,
         status, score, updated_at, meta
       ) VALUES (
         $1, $2, $3,
         $4, $5, now(), $6::jsonb
       )
       ON CONFLICT (year, submission_protocol, phase_key) DO UPDATE SET
         status = EXCLUDED.status,
         score = EXCLUDED.score,
         updated_at = EXCLUDED.updated_at,
         meta = EXCLUDED.meta
       RETURNING year, submission_protocol, phase_key, status, score, updated_at, meta`,
      [y, protocol, phase, status, score, metaJson]
    );

    return mapRow(rows[0] || null);
  }

  async findAll() {
    const { rows } = await this.pool.query(
      `SELECT year, submission_protocol, phase_key, status, score, updated_at, meta
         FROM candidate_phase_status`
    );
    return rows.map(mapRow);
  }
}

module.exports = SqlCandidatePhaseStatusRepository;
