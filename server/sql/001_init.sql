-- Inicialização do schema do AVALIA+ / PlanTerr (Postgres)
-- Foco: inscrições, avaliações, recursos e status por fase.

BEGIN;

CREATE TABLE IF NOT EXISTS submissions (
  protocol TEXT PRIMARY KEY,
  hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT,
  admin_notes TEXT,
  cpf_hash TEXT UNIQUE,
  cpf_last4 TEXT,
  form_version TEXT,
  identified JSONB NOT NULL DEFAULT '{}'::jsonb,
  project JSONB NOT NULL DEFAULT '{}'::jsonb,
  blind JSONB NOT NULL DEFAULT '{}'::jsonb,
  admin_updated_at TIMESTAMPTZ,
  audit JSONB
);

CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON submissions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions (status);

CREATE TABLE IF NOT EXISTS evaluations (
  protocol TEXT PRIMARY KEY REFERENCES submissions(protocol) ON DELETE CASCADE,
  project_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  interview_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  language_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  proj_total NUMERIC,
  int_total NUMERIC,
  lang_total NUMERIC,
  eliminado BOOLEAN NOT NULL DEFAULT false,
  observacoes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  audit JSONB
);

CREATE INDEX IF NOT EXISTS idx_evaluations_updated_at ON evaluations (updated_at DESC);

CREATE TABLE IF NOT EXISTS appeals (
  protocol TEXT PRIMARY KEY,
  submission_protocol TEXT NOT NULL REFERENCES submissions(protocol) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cpf TEXT,
  nome TEXT,
  email TEXT,
  titulo_projeto TEXT,
  linha_pesquisa TEXT,
  etapa TEXT NOT NULL,
  decisao_contestacao TEXT,
  argumentacao TEXT,
  status TEXT NOT NULL DEFAULT 'Recebido',
  updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_appeals_submission_protocol ON appeals (submission_protocol);
CREATE INDEX IF NOT EXISTS idx_appeals_created_at ON appeals (created_at DESC);

CREATE TABLE IF NOT EXISTS candidate_phase_status (
  year INTEGER NOT NULL,
  submission_protocol TEXT NOT NULL REFERENCES submissions(protocol) ON DELETE CASCADE,
  phase_key TEXT NOT NULL,
  status TEXT NOT NULL,
  score NUMERIC,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  meta JSONB,
  PRIMARY KEY (year, submission_protocol, phase_key)
);

CREATE INDEX IF NOT EXISTS idx_candidate_phase_status_year ON candidate_phase_status (year);
CREATE INDEX IF NOT EXISTS idx_candidate_phase_status_phase ON candidate_phase_status (phase_key);
CREATE INDEX IF NOT EXISTS idx_candidate_phase_status_status ON candidate_phase_status (status);

COMMIT;
