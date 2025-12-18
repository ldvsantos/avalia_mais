const { Pool } = require('pg');

let _pool;

function getPgPool() {
  if (_pool) return _pool;

  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error('Postgres não configurado: defina DATABASE_URL (ou POSTGRES_URL).');
  }

  const sslFlag = String(process.env.PG_SSL || '').trim().toLowerCase();
  const ssl = sslFlag === '1' || sslFlag === 'true' || sslFlag === 'yes'
    ? { rejectUnauthorized: false }
    : undefined;

  const max = Number(process.env.PG_POOL_MAX || 10);
  const idleTimeoutMillis = Number(process.env.PG_IDLE_TIMEOUT_MS || 30_000);
  const connectionTimeoutMillis = Number(process.env.PG_CONN_TIMEOUT_MS || 10_000);

  _pool = new Pool({
    connectionString,
    ssl,
    max,
    idleTimeoutMillis,
    connectionTimeoutMillis,
  });

  _pool.on('error', (err) => {
    console.error('[pg] erro em cliente ocioso', err);
  });

  return _pool;
}

async function pgQuery(text, params) {
  const pool = getPgPool();
  return pool.query(text, params);
}

module.exports = {
  getPgPool,
  pgQuery,
};
