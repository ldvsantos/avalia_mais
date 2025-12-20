/*
Cria um evento DEMO no módulo de Eventos + 2 inscrições e gera 1 certificado PDF.

Uso:
  node scripts/demo-events.js

Saída:
  - prints/demo/certificado-evento-<eventId>.pdf

Obs:
- Sobe o server local em porta temporária e encerra ao final.
- NÃO apaga o evento (fica como exemplo em server/data/events.json).
*/

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const serverDir = path.join(repoRoot, 'server');
const outDir = path.join(repoRoot, 'prints', 'demo');

const REQUEST_TIMEOUT_MS = 20_000;
const PDF_TIMEOUT_MS = 120_000;

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseSetCookie(setCookie) {
  if (!setCookie) return [];
  const arr = Array.isArray(setCookie) ? setCookie : [setCookie];
  return arr
    .map((c) => String(c).split(';')[0])
    .filter(Boolean);
}

function formEncode(obj) {
  return Object.entries(obj)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v ?? ''))}`)
    .join('&');
}

function readAdminSecret() {
  const p = path.join(serverDir, '.admin-secret');
  const raw = fs.readFileSync(p, 'utf8').trim();
  assert(raw && raw.length > 10, 'Falha ao ler server/.admin-secret');
  return raw;
}

function makeClient(baseUrl) {
  const jar = new Map();

  function maskSecretPath(p) {
    const s = String(p || '');
    return s.replace(/\/secret\/[0-9a-f-]{10,}/gi, '/secret/{SECRET}');
  }

  function cookieHeader() {
    const parts = [];
    for (const [k, v] of jar.entries()) parts.push(`${k}=${v}`);
    return parts.join('; ');
  }

  function storeCookies(setCookieHeaders) {
    for (const kv of parseSetCookie(setCookieHeaders)) {
      const idx = kv.indexOf('=');
      if (idx > 0) {
        const k = kv.slice(0, idx);
        const v = kv.slice(idx + 1);
        jar.set(k, v);
      }
    }
  }

  function request(method, pathname, { headers = {}, body, timeoutMs = REQUEST_TIMEOUT_MS } = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(pathname, baseUrl);
      const reqHeaders = { ...headers };
      const ck = cookieHeader();
      if (ck) reqHeaders['Cookie'] = ck;

      const req = http.request(
        {
          method,
          hostname: url.hostname,
          port: url.port,
          path: url.pathname + url.search,
          headers: reqHeaders,
        },
        (res) => {
          const chunks = [];
          res.on('data', (d) => chunks.push(d));
          res.on('end', () => {
            storeCookies(res.headers['set-cookie']);
            resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) });
          });
        }
      );

      req.setTimeout(timeoutMs, () => {
        req.destroy(new Error(`Timeout HTTP após ${timeoutMs}ms em ${method} ${pathname}`));
      });
      req.on('error', reject);
      if (body) req.write(body);
      req.end();
    });
  }

  async function requestFollow(method, pathname, opts) {
    const res = await request(method, pathname, opts);
    if (res.status && [301, 302, 303, 307, 308].includes(res.status)) {
      const loc = res.headers.location;
      if (!loc) return res;
      const nextPath = loc.startsWith('http') ? loc : loc;
      const isPostLike = String(method || '').toUpperCase() !== 'GET' && String(method || '').toUpperCase() !== 'HEAD';
      const nextMethod = (res.status === 303 || (isPostLike && (res.status === 301 || res.status === 302))) ? 'GET' : method;
      console.log(`[demo-events] redirect ${res.status} ${maskSecretPath(pathname)} -> ${maskSecretPath(nextPath)} (${method}=>${nextMethod})`);
      return requestFollow(nextMethod, nextPath, undefined);
    }
    return res;
  }

  return { request, requestFollow };
}

async function waitForServer(client, child, timeoutMs = 15_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (child && child.exitCode != null) throw new Error(`Servidor encerrou antes de responder (exitCode=${child.exitCode})`);
    try {
      const r = await client.request('GET', '/');
      if (r.status === 200) return;
    } catch {}
    await sleep(250);
  }
  throw new Error('Servidor não respondeu no tempo esperado');
}

async function main() {
  ensureDir(outDir);

  const adminSecret = readAdminSecret();
  const port = 3124;
  const baseUrl = `http://localhost:${port}`;

  const child = spawn('node', ['index.js'], {
    cwd: serverDir,
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: 'development',
      ADMIN_USER: 'admin',
      ADMIN_PASS: 'admin',
      HMAC_SECRET: 'dev-secret-change-me',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const logs = [];
  child.stdout.on('data', (d) => logs.push(String(d)));
  child.stderr.on('data', (d) => logs.push(String(d)));

  const client = makeClient(baseUrl);

  try {
    console.log('[demo-events] Subindo servidor...');
    await waitForServer(client, child);

    console.log('[demo-events] Login admin...');
    const loginPath = `/secret/${adminSecret}/login`;
    const loginRes = await client.request('POST', loginPath, {
      headers: { 'Content-Type': 'application/json' },
      body: Buffer.from(JSON.stringify({ username: 'admin', password: 'admin' }), 'utf8'),
    });
    assert(loginRes.status === 200, `Login esperado 200, veio ${loginRes.status}`);
    const loginJson = JSON.parse(loginRes.body.toString('utf8'));
    assert(loginJson && loginJson.success === true, 'Login admin falhou');

    const title = `DEMO EVENTO ${Date.now()}`;
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const yyyy = yesterday.getFullYear();
    const mm = String(yesterday.getMonth() + 1).padStart(2, '0');
    const dd = String(yesterday.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    console.log('[demo-events] Criando evento...');
    const createBody = formEncode({
      title,
      description: 'Evento criado pelo demo-events.js (exemplo)',
      date: dateStr,
      location: 'Local (demo)',
      workload: '2 hora(s)',
      status: 'open',
      coordinator: 'Coordenação (demo)',
      department: 'Departamento (demo)',
      speakers: 'Palestrante (demo)',
      participantRole: 'PARTICIPANTE',
      syllabus: 'Ementa demo',
      activities: JSON.stringify([{ name: 'Atividade Demo', role: 'PARTICIPANTE', workload: 2 }]),
    });

    const createRes = await client.requestFollow('POST', `/secret/${adminSecret}/admin/events`, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: Buffer.from(createBody, 'utf8'),
    });
    assert(createRes.status === 200, `Criar evento esperado 200, veio ${createRes.status}`);

    console.log('[demo-events] Buscando eventId em /api/public-events...');
    const listRes = await client.request('GET', '/api/public-events');
    assert(listRes.status === 200, `public-events esperado 200, veio ${listRes.status}`);
    const listJson = JSON.parse(listRes.body.toString('utf8'));
    const found = (listJson || []).find((e) => e && e.title === title);
    assert(found && found.id, 'Evento recém-criado não apareceu em /api/public-events');
    const eventId = String(found.id);

    console.log(`[demo-events] Evento criado: ${eventId} (${title})`);

    // 2 inscrições
    const cpf1 = '12345678901';
    const cpf2 = '23456789012';

    console.log('[demo-events] Criando inscrições...');
    for (const [nome, email, cpf] of [
      ['Participante Demo 1', 'demo1@event.local', cpf1],
      ['Participante Demo 2', 'demo2@event.local', cpf2],
    ]) {
      const body = formEncode({ nome, email, cpf });
      const r = await client.requestFollow('POST', `/eventos/${encodeURIComponent(eventId)}/inscrever`, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: Buffer.from(body, 'utf8'),
      });
      assert(r.status === 200, `Inscrição esperada 200, veio ${r.status}`);
    }

    console.log('[demo-events] Confirmando presença do 1º inscrito...');
    const confirmRes = await client.requestFollow('POST', `/secret/${adminSecret}/admin/events/${encodeURIComponent(eventId)}/registrations/0/toggle-confirm`);
    assert(confirmRes.status === 200, `Toggle confirm esperado 200, veio ${confirmRes.status}`);

    console.log('[demo-events] Gerando certificado PDF...');
    const certBody = formEncode({ cpf: cpf1 });
    const certRes = await client.request('POST', `/eventos/${encodeURIComponent(eventId)}/certificado`, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: Buffer.from(certBody, 'utf8'),
      timeoutMs: PDF_TIMEOUT_MS,
    });
    assert(certRes.status === 200, `Certificado esperado 200, veio ${certRes.status}`);
    const ct = String(certRes.headers['content-type'] || '');
    assert(ct.includes('application/pdf'), `Content-Type esperado application/pdf, veio ${ct}`);

    const outPath = path.join(outDir, `certificado-evento-${eventId}.pdf`);
    fs.writeFileSync(outPath, certRes.body);

    console.log('✅ Demo de eventos concluído.');
    console.log(`- Evento: ${baseUrl}/eventos/${eventId}`);
    console.log(`- Admin (eventos): ${baseUrl}/secret/{SECRET}/admin/events`);
    console.log(`- Certificado salvo em: ${path.relative(repoRoot, outPath)}`);
  } catch (err) {
    console.error('❌ Falha no demo-events:', err && err.message ? err.message : err);
    const tail = logs.join('').split(/\r?\n/).slice(-30).join('\n');
    console.error('[demo-events] server log tail:\n' + tail);
    process.exitCode = 1;
  } finally {
    try { child.kill('SIGTERM'); } catch {}
    await sleep(400);
  }
}

main();
