# Servidor (Admin + Registro)

Este servidor recebe inscrições, gera `protocolo + hash` verificável, bloqueia duplicidade por CPF (via HMAC) e expõe uma tela simples de admin.

## Rodar

1) Instalar dependências:

```bash
cd server
npm install
```

2) Subir servidor:

```bash
# Windows PowerShell
$env:ADMIN_USER="admin"; $env:ADMIN_PASS="admin"; $env:HMAC_SECRET="troque-isto"; npm start
```

3) Abrir o formulário:
- http://localhost:3000/

4) Admin:
- A URL é camuflada por UUID (mostrada no console ao iniciar):
	- http://localhost:3000/secret/{UUID}/admin

O UUID é persistido em `server/.admin-secret`.

## Observações
- Troque `ADMIN_USER/ADMIN_PASS` e principalmente `HMAC_SECRET` em produção.
- As inscrições ficam em `server/data/submissions.json`.

## E-mails (SMTP)

O servidor envia e-mails de:
- confirmação de inscrição (candidato + notificação admin)
- confirmação de recurso (candidato + notificação admin)
- notificação de **resultado preliminar** por etapa (quando a comissão salva avaliação)
- notificação de **decisão do recurso** (quando o admin marca Deferido/Indeferido)

Variáveis de ambiente (ver `.env.example` na raiz do projeto):
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- `ADMIN_NOTIFY_TO` (lista separada por vírgulas; se vazio, usa `SMTP_USER` como fallback)
- `SITE_URL` (usado para montar link do Portal do Candidato)

### Testar envio

Com o servidor parado (ou em outro terminal), rode:

```bash
cd server
node test-email.js
```

## Calendário por Edital (Workflow)

O sistema agora suporta um **calendário por edital (ano)** e **controle de fluxo por fase**, com bloqueios por prazo/status e nota de corte.

- Calendário do processo (por ano): `server/data/process_calendar.json`
- Status do candidato por fase (por ano + protocolo): `server/data/candidate_phase_status.json`

### Endpoints (admin)

- Ver calendário do edital:
	- `GET /secret/{UUID}/admin/edital/{year}/calendar`
- Salvar calendário do edital (body JSON com `global` e `phases`):
	- `POST /secret/{UUID}/admin/edital/{year}/calendar`
- Atualizar decisão/status de um recurso (para consolidar reprovação definitiva quando indeferido):
	- `POST /secret/{UUID}/admin/appeals/{protocol}/status` com `status=Recebido|Deferido|Indeferido`

### Compatibilidade

O formulário antigo de janela de inscrições no painel admin continua existindo e sincroniza a fase `INSCRICAO` do calendário do ano corrente.

## Governança (auditoria)

- Logs estruturados em `server/logs/security.log` (inclui `SUBMISSION_CREATED`, `SUBMISSION_MODIFIED`, `EVALUATION_CREATED`, `EVALUATION_MODIFIED`, `DATA_EXPORT`, `CONFIG_MODIFIED`).
- Respostas incluem `X-Request-Id` para correlação entre requisições e logs.
- Registros persistidos em `server/data/*.json` passam a carregar `audit` (created/updated + `history[]`) quando alterados por rotas/admin.
