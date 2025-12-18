# Migração para Postgres (Plano + Esquema)

Data: 18/12/2025

## Objetivo
Substituir persistência em arquivos JSON por Postgres para melhorar:
- Robustez (concorrência e integridade)
- Segurança operacional (backups, controle de acesso)
- Auditabilidade (histórico preservado em DB)

## Estado atual (referência)
- Inscrições: `server/data/submissions.json`
- Avaliações: `server/data/evaluations.json`
- Recursos: `server/data/appeals.json`
- Status por fase: `server/data/candidate_phase_status.json`

## Estratégia de migração (incremental e reversível)
1. **Criar Postgres e schema**
   - Aplicar DDL inicial em `server/sql/001_init.sql`.
2. **Implementar repositórios SQL por entidade**
   - Começar por `SqlSubmissionRepository`.
   - Em seguida: `SqlEvaluationRepository`, `SqlAppealRepository`, `SqlCandidatePhaseStatusRepository`.
3. **Chaveamento por configuração (feature flag)**
   - Produção continua em JSON por padrão.
   - Habilitar Postgres apenas quando `STORAGE_BACKEND=postgres`.
4. **Migração de dados**
   - Importar JSON → Postgres (upsert por `protocol`).
   - Rodar smoke test (listagem, consulta, criação, atualização).
5. **Cutover**
   - Virar para Postgres.
   - Manter export/backup do JSON por janela de rollback.

## Mapeamento de tabelas

### 1) `submissions`
Fonte: objetos dentro de `submissions.json`.

Campos principais:
- `protocol` (PK)
- `hash`
- `created_at`
- `status` (texto livre hoje; usado no admin)
- `cpf_hash` (UNIQUE)
- `cpf_last4`
- `form_version`
- `identified` (JSONB)
- `project` (JSONB)
- `blind` (JSONB)
- `admin_updated_at`
- `audit` (JSONB)

Índices:
- `created_at DESC` (home/admin)
- `status` (filtros)
- `cpf_hash UNIQUE` (garantia de unicidade)

### 2) `evaluations`
Fonte: `evaluations.json`.

- `protocol` (PK + FK → submissions.protocol)
- `project_scores` (JSONB)
- `interview_scores` (JSONB)
- `language_scores` (JSONB)
- `proj_total`, `int_total`, `lang_total`
- `eliminado` (bool)
- `observacoes`
- `updated_at`
- `audit` (JSONB)

### 3) `appeals`
Fonte: `appeals.json`.

- `protocol` (PK)
- `submission_protocol` (FK)
- `created_at`
- `cpf`, `nome`, `email`
- `titulo_projeto`, `linha_pesquisa`
- `etapa` (texto hoje)
- `decisao_contestacao`, `argumentacao`
- `status` (Recebido/Deferido/Indeferido)
- `updated_at`

### 4) `candidate_phase_status`
Fonte: `candidate_phase_status.json`.

- PK composta: (`year`, `submission_protocol`, `phase_key`)
- `status` (APROVADO / REPROVADO_PRELIMINAR / REPROVADO_DEFINITIVO)
- `score` (num)
- `updated_at`
- `meta` (JSONB) — ex.: `{ reason: 'recurso_indeferido', appealProtocol: 'REC-...' }`

## Configuração (app)
- `STORAGE_BACKEND=postgres`
- `ENABLE_POSTGRES=true` (flag de segurança para evitar ativação acidental)
- `DATABASE_URL=postgres://USER:PASS@HOST:5432/DBNAME`
- Opcional: `PG_SSL=true` (ativa TLS no client `pg` com `rejectUnauthorized=false`)

> Nota: o cutover completo precisa também migrar os pontos do código que ainda usam `server/storage.js` (legado).
> Por enquanto, o Postgres deve ser habilitado apenas após executar o plano de migração incremental e smoke tests.

## Observações de segurança (próximos passos)
- Avaliadores: hoje a senha é texto em JSON; em Postgres ideal é armazenar **hash (bcrypt/argon2)**.
- Restringir acesso de rede ao banco (security group / firewall), e habilitar backup automático.
