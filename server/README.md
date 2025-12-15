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
- http://localhost:3000/admin

## Observações
- Troque `ADMIN_USER/ADMIN_PASS` e principalmente `HMAC_SECRET` em produção.
- As inscrições ficam em `server/data/submissions.json`.
