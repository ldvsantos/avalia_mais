/*
E2E smoke test (local) no sistem AVALIA+.
- Inicia o servidor em uma porta temporária
- Testa páginas públicas + login de administrador + ciclo de vida de eventos + regras de certificado
- Restaura o arquivo server/data/events.json para evitar problemas na árvore de diretórios

Teste Run: node scripts/e2e-smoke.js
*/



const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const serverDir = path.join(repoRoot, 'server');

const STEPS_TOTAL = 12;
let stepIndex = 0;
const startedAt = Date.now();
let currentStage = 'inicializando';

const REQUEST_TIMEOUT_MS = 20_000;
const PDF_TIMEOUT_MS = 120_000;
const WATCHDOG_EVERY_MS = 15_000;

function fmtElapsed() {
  const s = Math.floor((Date.now() - startedAt) / 1000);
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function step(label) {
  stepIndex += 1;
  currentStage = label;
  console.log(`[e2e-smoke] ${stepIndex}/${STEPS_TOTAL} (${fmtElapsed()}) ${label}`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readAdminSecret() {
  const p = path.join(serverDir, '.admin-secret');
  const raw = fs.readFileSync(p, 'utf8').trim();
  assert(raw && raw.length > 10, 'Falha ao ler server/.admin-secret');
  return raw;
}

function readEventsJsonRaw() {
  const p = path.join(serverDir, 'data', 'events.json');
  const raw = fs.readFileSync(p, 'utf8');
  return { path: p, raw };
}

function writeFileRaw(filePath, raw) {
  fs.writeFileSync(filePath, raw);
}

function parseSetCookie(setCookie) {
  if (!setCookie) return [];
  const arr = Array.isArray(setCookie) ? setCookie : [setCookie];
  return arr
    .map((c) => String(c).split(';')[0])
    .filter(Boolean);
}

function makeClient(baseUrl) {
  const jar = new Map();

  function maskSecretPath(p) {
    const s = String(p || '');
    // Evita imprimir o ADMIN_SECRET completo nos logs.
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
      const startedAt = Date.now();
      const safePath = maskSecretPath(pathname);
      const bodyInfo = body ? ` body=${Buffer.isBuffer(body) ? body.length : String(body).length}` : '';
      console.log(`[e2e-smoke] HTTP -> ${method} ${safePath} timeout=${timeoutMs}ms${bodyInfo}`);

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
            const buf = Buffer.concat(chunks);
            const ms = Date.now() - startedAt;
            console.log(`[e2e-smoke] HTTP <- ${method} ${safePath} status=${res.statusCode} bytes=${buf.length} (${ms}ms)`);
            resolve({
              status: res.statusCode,
              headers: res.headers,
              body: buf,
            });
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
      console.log(`[e2e-smoke] HTTP ~~ redirect ${res.status} ${maskSecretPath(pathname)} -> ${maskSecretPath(nextPath)}`);
      // Compat com navegadores: após POST, 301/302 normalmente viram GET.
      // Sem isso, ocorre loop (POST -> 302 -> POST -> 302 ...).
      const isPostLike = String(method || '').toUpperCase() !== 'GET' && String(method || '').toUpperCase() !== 'HEAD';
      const nextMethod = (res.status === 303 || (isPostLike && (res.status === 301 || res.status === 302))) ? 'GET' : method;
      return requestFollow(nextMethod, nextPath, undefined);
    }
    return res;
  }

  return { request, requestFollow };
}

function formEncode(obj) {
  return Object.entries(obj)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v ?? ''))}`)
    .join('&');
}

async function waitForServer(client, child, timeoutMs = 15000) {
  const start = Date.now();
  let tries = 0;
  let lastMsg = '';
  let lastLogAt = 0;
  // poll GET /
  while (Date.now() - start < timeoutMs) {
    if (child && child.exitCode != null) {
      throw new Error(`Servidor encerrou antes de responder (exitCode=${child.exitCode})`);
    }

    tries += 1;
    try {
      const r = await client.request('GET', '/');
      if (r.status === 200) return;
      lastMsg = `status=${r.status}`;
    } catch (err) {
      lastMsg = err && err.message ? err.message : String(err ?? 'erro');
    }

    const now = Date.now();
    if (now - lastLogAt >= 1000) {
      console.log(`[e2e-smoke] aguardando servidor... tentativa ${tries} (${fmtElapsed()}) ${lastMsg}`);
      lastLogAt = now;
    }

    await sleep(300);
  }
  throw new Error('Servidor não respondeu no tempo esperado');
}

async function main() {
  const adminSecret = readAdminSecret();
  const port = 3123;
  const baseUrl = `http://localhost:${port}`;

  const backup = readEventsJsonRaw();

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

  // keep logs in memory for debugging but avoid printing secrets
  const logs = [];
  child.stdout.on('data', (d) => logs.push(String(d)));
  child.stderr.on('data', (d) => logs.push(String(d)));

  const client = makeClient(baseUrl);

  const watchdog = setInterval(() => {
    console.log(`[e2e-smoke] ainda rodando... (${fmtElapsed()}) etapa atual: ${currentStage}`);
  }, WATCHDOG_EVERY_MS);
  watchdog.unref?.();

  try {
    step('Subindo servidor e aguardando resposta');
    await waitForServer(client, child);

    // Static/public pages
    {
      step('GET / (home)');
      const r = await client.request('GET', '/');
      assert(r.status === 200, `GET / esperado 200, veio ${r.status}`);
    }
    {
      step('GET /cursos.html');
      const r = await client.request('GET', '/cursos.html');
      assert(r.status === 200, `GET /cursos.html esperado 200, veio ${r.status}`);
    }
    {
      step('GET /admin-events-confirm.js');
      const r = await client.request('GET', '/admin-events-confirm.js');
      assert(r.status === 200, `GET /admin-events-confirm.js esperado 200, veio ${r.status}`);
      assert(r.body.toString('utf8').includes('data-confirm'), 'JS de confirmação não parece correto');
    }

    // Public events API
    {
      step('GET /api/public-events');
      const r = await client.request('GET', '/api/public-events');
      assert(r.status === 200, `GET /api/public-events esperado 200, veio ${r.status}`);
      const parsed = JSON.parse(r.body.toString('utf8'));
      assert(Array.isArray(parsed), 'public-events deve retornar array');
    }

    // Admin login
    const loginPath = `/secret/${adminSecret}/login`;
    {
      step('POST /secret/{UUID}/login (admin)');
      const r = await client.request('POST', loginPath, {
        headers: { 'Content-Type': 'application/json' },
        body: Buffer.from(JSON.stringify({ username: 'admin', password: 'admin' }), 'utf8'),
      });
      assert(r.status === 200, `POST ${loginPath} esperado 200, veio ${r.status}`);
      const parsed = JSON.parse(r.body.toString('utf8'));
      assert(parsed && parsed.success === true, 'Login admin falhou');
    }

    // Create event (yesterday) without image
    const title = `SMOKE ${Date.now()}`;
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const yyyy = yesterday.getFullYear();
    const mm = String(yesterday.getMonth() + 1).padStart(2, '0');
    const dd = String(yesterday.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    {
      step('Criar evento (admin)');
      const body = formEncode({
        title,
        description: 'evento de teste automatizado',
        date: dateStr,
        location: 'Local Teste',
        workload: '1 hora(s)',
        status: 'open',
        coordinator: 'Coord',
        department: 'Dept',
        speakers: 'Speaker',
        participantRole: 'PARTICIPANTE',
        syllabus: 'Ementa',
        activities: JSON.stringify([{ name: 'Atividade', role: 'PARTICIPANTE', workload: 1 }]),
      });

      const r = await client.requestFollow('POST', `/secret/${adminSecret}/admin/events`, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: Buffer.from(body, 'utf8'),
      });
      assert(r.status === 200, `Criar evento esperado 200 após redirect, veio ${r.status}`);
      const html = r.body.toString('utf8');
      assert(html.includes('Gestão de Eventos'), 'Lista de eventos não carregou');
      assert(html.includes('/admin-events-confirm.js'), 'Página admin/events não inclui script de confirmação');
      assert(html.includes('data-confirm="delete-event"'), 'Form de excluir não tem data-confirm');
    }

    // Find created event in public-events
    let eventId;
    {
      step('Confirmar evento aparece em /api/public-events');
      const r = await client.request('GET', '/api/public-events');
      const parsed = JSON.parse(r.body.toString('utf8'));
      const found = parsed.find((e) => e && e.title === title);
      assert(found && found.id, 'Evento recém-criado não apareceu em /api/public-events');
      eventId = String(found.id);
    }

    // Public event page should show default image
    {
      step('GET /eventos/:id (deve usar post_padrao.png quando sem imagem)');
      const r = await client.request('GET', `/eventos/${encodeURIComponent(eventId)}`);
      assert(r.status === 200, `GET /eventos/:id esperado 200, veio ${r.status}`);
      const html = r.body.toString('utf8');
      assert(html.includes('/img/post_padrao.png'), 'Evento sem imagem deveria exibir post_padrao.png');
    }

    // Register
    const cpf = '12345678901';
    {
      step('POST /eventos/:id/inscrever');
      const body = formEncode({ nome: 'Teste Smoke', email: 'smoke@test.local', cpf });
      const r = await client.requestFollow('POST', `/eventos/${encodeURIComponent(eventId)}/inscrever`, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: Buffer.from(body, 'utf8'),
      });
      assert(r.status === 200, `POST /eventos/:id/inscrever esperado 200 após redirect, veio ${r.status}`);
    }

    // Certificate should be blocked before confirm
    {
      step('POST /eventos/:id/certificado (deve bloquear antes de confirmar presença)');
      const body = formEncode({ cpf });
      const r = await client.request('POST', `/eventos/${encodeURIComponent(eventId)}/certificado`, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: Buffer.from(body, 'utf8'),
      });
      assert(r.status === 403, `Certificado antes de confirmação deveria 403, veio ${r.status}`);
    }

    // Confirm presence (index 0)
    {
      step('Admin confirma presença (toggle)');
      const r = await client.requestFollow(
        'POST',
        `/secret/${adminSecret}/admin/events/${encodeURIComponent(eventId)}/registrations/0/toggle-confirm`
      );
      assert(r.status === 200, `Toggle confirm esperado 200 após redirect, veio ${r.status}`);
    }

    // Certificate should now return PDF
    {
      step('POST /eventos/:id/certificado (deve retornar PDF após confirmação)');
      const body = formEncode({ cpf });
      const r = await client.request('POST', `/eventos/${encodeURIComponent(eventId)}/certificado`, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: Buffer.from(body, 'utf8'),
        timeoutMs: PDF_TIMEOUT_MS,
      });
      assert(r.status === 200, `Certificado após confirmação deveria 200, veio ${r.status}`);
      const ct = String(r.headers['content-type'] || '');
      assert(ct.includes('application/pdf'), `Content-Type esperado application/pdf, veio ${ct}`);
      assert(r.body.length > 1000, 'PDF gerado parece pequeno demais');
    }

    // Delete event
    {
      step('Excluir evento (admin)');
      const r = await client.requestFollow('POST', `/secret/${adminSecret}/admin/events/${encodeURIComponent(eventId)}/delete`);
      assert(r.status === 200, `Delete evento esperado 200 após redirect, veio ${r.status}`);
    }

    // Ensure event gone from public-events
    {
      step('Confirmar que evento foi removido');
      const r = await client.request('GET', '/api/public-events');
      const parsed = JSON.parse(r.body.toString('utf8'));
      const still = parsed.find((e) => e && e.title === title);
      assert(!still, 'Evento ainda aparece após delete');
    }

    console.log('[e2e-smoke] OK');
  } catch (err) {
    console.error('[e2e-smoke] FALHOU:', err && err.message ? err.message : err);
    // dump last lines (sem segredos)
    const tail = logs.join('').split(/\r?\n/).slice(-30).join('\n');
    console.error('[e2e-smoke] server log tail:\n' + tail);
    process.exitCode = 1;
  } finally {
    try {
      clearInterval(watchdog);
    } catch {}

    // restore events.json
    try {
      writeFileRaw(backup.path, backup.raw);
    } catch {}

    try {
      child.kill('SIGTERM');
    } catch {}

    await sleep(500);
    try {
      child.kill('SIGKILL');
    } catch {}
  }
}

main();
