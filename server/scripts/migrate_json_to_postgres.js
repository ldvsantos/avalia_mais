/*
  Migração simples: JSON -> Postgres (upsert)

  Uso:
    node server/scripts/migrate_json_to_postgres.js

  Requer:
    - STORAGE_BACKEND pode ser qualquer valor (script independe)
    - DATABASE_URL (ou POSTGRES_URL)

  Observação:
    - Este script NÃO apaga dados do Postgres; ele faz upsert por chaves.
*/

const fs = require('fs');
const path = require('path');

const { getPgPool } = require('../src/infrastructure/db/postgres');

function readJsonSafe(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function upsertSubmissions(pool, dataDir) {
  const filePath = path.join(dataDir, 'submissions.json');
  const parsed = readJsonSafe(filePath, { submissions: [] });
  const list = Array.isArray(parsed?.submissions) ? parsed.submissions : [];

  let count = 0;
  for (const s of list) {
    const identifiedJson = JSON.stringify(s?.identified || {});
    const projectJson = JSON.stringify(s?.project || {});
    const blindJson = JSON.stringify(s?.blind || {});
    const auditJson = s?.audit ? JSON.stringify(s.audit) : null;
    const adminNotes = s?.adminNotes != null ? String(s.adminNotes) : null;

    await pool.query(
      `INSERT INTO submissions (
         protocol, hash, created_at, status, admin_notes,
         cpf_hash, cpf_last4, form_version,
         identified, project, blind,
         admin_updated_at, audit
       ) VALUES (
         $1, $2, $3, $4, $5,
         $6, $7, $8,
         $9::jsonb, $10::jsonb, $11::jsonb,
         $12, $13::jsonb
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
         admin_updated_at = EXCLUDED.admin_updated_at,
         audit = EXCLUDED.audit`,
      [
        String(s?.protocol || '').trim(),
        String(s?.hash || ''),
        s?.createdAt ? new Date(s.createdAt) : new Date(),
        s?.status != null ? String(s.status) : null,
        adminNotes,
        s?.cpfHash != null ? String(s.cpfHash) : null,
        s?.cpfLast4 != null ? String(s.cpfLast4) : null,
        s?.formVersion != null ? String(s.formVersion) : null,
        identifiedJson,
        projectJson,
        blindJson,
        s?.adminUpdatedAt ? new Date(s.adminUpdatedAt) : null,
        auditJson,
      ]
    );
    count++;
  }
  return count;
}

async function upsertEvaluations(pool, dataDir) {
  const filePath = path.join(dataDir, 'evaluations.json');
  const parsed = readJsonSafe(filePath, { evaluations: [] });

  const list = Array.isArray(parsed)
    ? parsed
    : (Array.isArray(parsed?.evaluations) ? parsed.evaluations : []);

  let count = 0;
  for (const e of list) {
    const projectScoresJson = JSON.stringify(e?.projectScores || {});
    const interviewScoresJson = JSON.stringify(e?.interviewScores || {});
    const languageScoresJson = JSON.stringify(e?.languageScores || {});
    const auditJson = e?.audit ? JSON.stringify(e.audit) : null;

    await pool.query(
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
        String(e?.protocol || '').trim(),
        projectScoresJson,
        interviewScoresJson,
        languageScoresJson,
        e?.proj_total != null ? Number(e.proj_total) : null,
        e?.int_total != null ? Number(e.int_total) : null,
        e?.lang_total != null ? Number(e.lang_total) : null,
        Boolean(e?.eliminado),
        e?.observacoes != null ? String(e.observacoes) : null,
        e?.updatedAt ? new Date(e.updatedAt) : new Date(),
        auditJson,
      ]
    );
    count++;
  }
  return count;
}

async function upsertAppeals(pool, dataDir) {
  const filePath = path.join(dataDir, 'appeals.json');
  const parsed = readJsonSafe(filePath, []);
  const list = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.appeals) ? parsed.appeals : []);

  let count = 0;
  for (const a of list) {
    await pool.query(
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
        String(a?.protocol || '').trim(),
        String(a?.submissionProtocol || '').trim(),
        a?.createdAt ? new Date(a.createdAt) : new Date(),
        a?.cpf != null ? String(a.cpf) : null,
        a?.nome != null ? String(a.nome) : null,
        a?.email != null ? String(a.email) : null,
        a?.tituloProjeto != null ? String(a.tituloProjeto) : null,
        a?.linhaPesquisa != null ? String(a.linhaPesquisa) : null,
        String(a?.etapa || '').trim(),
        a?.decisaoContestacao != null ? String(a.decisaoContestacao) : null,
        a?.argumentacao != null ? String(a.argumentacao) : null,
        a?.status != null ? String(a.status) : 'Recebido',
        a?.updatedAt ? new Date(a.updatedAt) : null,
      ]
    );
    count++;
  }
  return count;
}

async function upsertCandidatePhaseStatus(pool, dataDir) {
  const filePath = path.join(dataDir, 'candidate_phase_status.json');
  const parsed = readJsonSafe(filePath, { statuses: [] });
  const list = Array.isArray(parsed?.statuses) ? parsed.statuses : (Array.isArray(parsed) ? parsed : []);

  let count = 0;
  for (const s of list) {
    const metaJson = s?.meta ? JSON.stringify(s.meta) : null;
    await pool.query(
      `INSERT INTO candidate_phase_status (
         year, submission_protocol, phase_key,
         status, score, updated_at, meta
       ) VALUES (
         $1, $2, $3,
         $4, $5, $6, $7::jsonb
       )
       ON CONFLICT (year, submission_protocol, phase_key) DO UPDATE SET
         status = EXCLUDED.status,
         score = EXCLUDED.score,
         updated_at = EXCLUDED.updated_at,
         meta = EXCLUDED.meta`,
      [
        Number(s?.year),
        String(s?.submissionProtocol || '').trim(),
        String(s?.phaseKey || '').trim(),
        String(s?.status || '').trim(),
        s?.score != null ? Number(s.score) : null,
        s?.updatedAt ? new Date(s.updatedAt) : new Date(),
        metaJson,
      ]
    );
    count++;
  }
  return count;
}

async function main() {
  const workspaceRoot = path.join(__dirname, '..', '..');
  const dataDir = path.join(workspaceRoot, 'server', 'data');

  const pool = getPgPool();

  console.log('[migrate] dataDir:', dataDir);

  const subCount = await upsertSubmissions(pool, dataDir);
  console.log('[migrate] submissions:', subCount);

  const evalCount = await upsertEvaluations(pool, dataDir);
  console.log('[migrate] evaluations:', evalCount);

  const appealCount = await upsertAppeals(pool, dataDir);
  console.log('[migrate] appeals:', appealCount);

  const stCount = await upsertCandidatePhaseStatus(pool, dataDir);
  console.log('[migrate] candidate_phase_status:', stCount);

  await pool.end();
  console.log('[migrate] ok');
}

main().catch((err) => {
  console.error('[migrate] falhou', err);
  process.exitCode = 1;
});
