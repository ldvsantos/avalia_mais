const Appeal = require('../../domain/Appeal');

function mapRowToAppeal(row) {
  if (!row) return null;
  return new Appeal({
    protocol: row.protocol,
    submissionProtocol: row.submission_protocol,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
    cpf: row.cpf,
    nome: row.nome,
    email: row.email,
    tituloProjeto: row.titulo_projeto,
    linhaPesquisa: row.linha_pesquisa,
    etapa: row.etapa,
    decisaoContestacao: row.decisao_contestacao,
    argumentacao: row.argumentacao,
    status: row.status,
  });
}

class SqlAppealRepository {
  constructor({ pool }) {
    if (!pool) throw new Error('SqlAppealRepository requer pool do Postgres.');
    this.pool = pool;
  }

  async save(appeal) {
    if (!appeal) throw new Error('appeal é obrigatório');
    const protocol = String(appeal.protocol || '').trim();
    if (!protocol) throw new Error('appeal.protocol é obrigatório');

    await this.pool.query(
      `INSERT INTO appeals (
         protocol, submission_protocol, created_at,
         cpf, nome, email,
         titulo_projeto, linha_pesquisa,
         etapa, decisao_contestacao, argumentacao,
         status, updated_at
       ) VALUES (
         $1, $2, $3,
         $4, $5, $6,
         $7, $8,
         $9, $10, $11,
         $12, $13
       )
       ON CONFLICT (protocol) DO UPDATE SET
         submission_protocol = EXCLUDED.submission_protocol,
         created_at = EXCLUDED.created_at,
         cpf = EXCLUDED.cpf,
         nome = EXCLUDED.nome,
         email = EXCLUDED.email,
         titulo_projeto = EXCLUDED.titulo_projeto,
         linha_pesquisa = EXCLUDED.linha_pesquisa,
         etapa = EXCLUDED.etapa,
         decisao_contestacao = EXCLUDED.decisao_contestacao,
         argumentacao = EXCLUDED.argumentacao,
         status = EXCLUDED.status,
         updated_at = EXCLUDED.updated_at`,
      [
        protocol,
        String(appeal.submissionProtocol || '').trim(),
        appeal.createdAt ? new Date(appeal.createdAt) : new Date(),
        appeal.cpf != null ? String(appeal.cpf) : null,
        appeal.nome != null ? String(appeal.nome) : null,
        appeal.email != null ? String(appeal.email) : null,
        appeal.tituloProjeto != null ? String(appeal.tituloProjeto) : null,
        appeal.linhaPesquisa != null ? String(appeal.linhaPesquisa) : null,
        String(appeal.etapa || '').trim(),
        appeal.decisaoContestacao != null ? String(appeal.decisaoContestacao) : null,
        appeal.argumentacao != null ? String(appeal.argumentacao) : null,
        appeal.status != null ? String(appeal.status) : 'Recebido',
        new Date(),
      ]
    );

    return appeal;
  }

  async findAll() {
    const { rows } = await this.pool.query(
      `SELECT protocol, submission_protocol, created_at,
              cpf, nome, email,
              titulo_projeto, linha_pesquisa,
              etapa, decisao_contestacao, argumentacao,
              status
         FROM appeals`
    );
    return rows.map(mapRowToAppeal);
  }

  async findByProtocol(protocol) {
    const p = String(protocol || '').trim();
    if (!p) return null;

    const { rows } = await this.pool.query(
      `SELECT protocol, submission_protocol, created_at,
              cpf, nome, email,
              titulo_projeto, linha_pesquisa,
              etapa, decisao_contestacao, argumentacao,
              status
         FROM appeals
        WHERE protocol = $1
        LIMIT 1`,
      [p]
    );

    return mapRowToAppeal(rows[0] || null);
  }

  async findBySubmissionProtocol(submissionProtocol) {
    const sp = String(submissionProtocol || '').trim();
    if (!sp) return [];

    const { rows } = await this.pool.query(
      `SELECT protocol, submission_protocol, created_at,
              cpf, nome, email,
              titulo_projeto, linha_pesquisa,
              etapa, decisao_contestacao, argumentacao,
              status
         FROM appeals
        WHERE submission_protocol = $1
        ORDER BY created_at DESC`,
      [sp]
    );

    return rows.map(mapRowToAppeal);
  }

  async updateStatus(protocol, status) {
    const p = String(protocol || '').trim();
    if (!p) return null;

    const st = String(status || '').trim();

    const { rows } = await this.pool.query(
      `UPDATE appeals
          SET status = $2,
              updated_at = now()
        WHERE protocol = $1
      RETURNING protocol, submission_protocol, created_at,
                cpf, nome, email,
                titulo_projeto, linha_pesquisa,
                etapa, decisao_contestacao, argumentacao,
                status`,
      [p, st]
    );

    return mapRowToAppeal(rows[0] || null);
  }
}

module.exports = SqlAppealRepository;
