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

## Governança (auditoria)

- Logs estruturados em `server/logs/security.log` (inclui `SUBMISSION_CREATED`, `SUBMISSION_MODIFIED`, `EVALUATION_CREATED`, `EVALUATION_MODIFIED`, `DATA_EXPORT`, `CONFIG_MODIFIED`).
- Respostas incluem `X-Request-Id` para correlação entre requisições e logs.
- Registros persistidos em `server/data/*.json` passam a carregar `audit` (created/updated + `history[]`) quando alterados por rotas/admin.
