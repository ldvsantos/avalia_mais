#!/usr/bin/env bash
set -euo pipefail

echo "[pg] instalando Postgres (se necessário)..."
if ! command -v psql >/dev/null 2>&1; then
  sudo apt-get update
  sudo apt-get install -y postgresql postgresql-contrib
fi
sudo systemctl enable --now postgresql

echo "[pg] criando usuário/db (idempotente)..."
PASS_FILE="/opt/avalia/server/.pg-local-password"
if [ ! -f "$PASS_FILE" ]; then
  umask 077
  PASS="$(openssl rand -base64 48 | tr -d '\n' | tr -d '/+=' | head -c 32)"
  echo "$PASS" > "$PASS_FILE"
else
  PASS="$(cat "$PASS_FILE")"
fi

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='avalia'" | grep -q 1; then
  sudo -u postgres psql -c "CREATE USER avalia WITH PASSWORD '${PASS}';"
else
  sudo -u postgres psql -c "ALTER USER avalia WITH PASSWORD '${PASS}';"
fi

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='avalia'" | grep -q 1; then
  sudo -u postgres createdb -O avalia avalia
fi

echo "[pg] aplicando schema..."
if [ -f /opt/avalia/server/sql/001_init.sql ]; then
  sudo -u postgres psql -d avalia -f /opt/avalia/server/sql/001_init.sql >/dev/null
else
  echo "ERRO: /opt/avalia/server/sql/001_init.sql não encontrado"
  exit 1
fi

echo "[pg] concedendo permissões ao usuário avalia..."
sudo -u postgres psql -d avalia -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
GRANT ALL PRIVILEGES ON DATABASE avalia TO avalia;
GRANT USAGE ON SCHEMA public TO avalia;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO avalia;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO avalia;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO avalia;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO avalia;
SQL

echo "[pg] atualizando /opt/avalia/.env (sem imprimir segredos)..."
ENVFILE="/opt/avalia/.env"
mkdir -p /opt/avalia
[ -f "$ENVFILE" ] || touch "$ENVFILE"

TMP="$(mktemp)"
grep -vE '^(ENABLE_POSTGRES|STORAGE_BACKEND|DATABASE_URL|POSTGRES_URL|PG_SSL)=' "$ENVFILE" > "$TMP" || true
{
  echo "ENABLE_POSTGRES=true"
  echo "STORAGE_BACKEND=postgres"
  echo "DATABASE_URL=postgresql://avalia:${PASS}@127.0.0.1:5432/avalia"
  echo "PG_SSL=false"
} >> "$TMP"

sudo mv "$TMP" "$ENVFILE"
sudo chown ubuntu:ubuntu "$ENVFILE" || true
sudo chmod 600 "$ENVFILE" || true

echo "[pg] rodando migração JSON -> Postgres (upsert)..."
cd /opt/avalia
DATABASE_URL="postgresql://avalia:${PASS}@127.0.0.1:5432/avalia" \
  node server/scripts/migrate_json_to_postgres.js

echo "[app] reiniciando PM2 para pegar o backend postgres..."
sudo -u ubuntu pm2 restart avalia --update-env || sudo -u ubuntu pm2 restart 0 --update-env
sudo -u ubuntu pm2 save

echo "[app] healthcheck local..."
for i in $(seq 1 20); do
  if curl -fsS http://127.0.0.1:3000/api/registration-window >/dev/null 2>&1; then
    echo "HEALTHCHECK_OK"
    exit 0
  fi
  sleep 0.5
done

echo "HEALTHCHECK_FAILED"
exit 1
