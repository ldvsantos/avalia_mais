const path = require('path');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const storage = require('./storage');
const {
  stableStringify,
  sha256Hex,
  hmacSha256Hex,
  generateProtocol,
  isValidCPF,
  escapeHtml,
} = require('./util');

const app = express();

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin';
const HMAC_SECRET = process.env.HMAC_SECRET || 'dev-secret-change-me';

app.use(helmet({
  contentSecurityPolicy: false,
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
}));

// Serve the existing static site from /src
app.use('/', express.static(path.join(__dirname, '..', 'src')));

function basicAuth(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin"');
    return res.status(401).send('Auth required');
  }
  const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
  const [user, pass] = decoded.split(':');
  if (user === ADMIN_USER && pass === ADMIN_PASS) return next();
  res.setHeader('WWW-Authenticate', 'Basic realm="Admin"');
  return res.status(401).send('Invalid credentials');
}

function pickSubmissionPayload(body) {
  const limitText = (value, maxLen) => {
    const s = String(value ?? '');
    return s.length > maxLen ? s.slice(0, maxLen) : s;
  };

  const identified = {
    nome: body?.nome || '',
    nome_social: body?.nome_social || '',
    data_nascimento: body?.data_nascimento || '',
    cpf: body?.cpf || '',
    rg: body?.rg || '',
    orgao_expedidor: body?.orgao_expedidor || '',
    data_expedicao: body?.data_expedicao || '',
    endereco: body?.endereco || '',
    cidade_estado: body?.cidade_estado || '',
    cep: body?.cep || '',
    celular: body?.celular || '',
    telefone_residencial: body?.telefone_residencial || '',
    email: body?.email || '',
    curso_graduacao: body?.curso_graduacao || '',
    instituicao: body?.instituicao || '',
    ano_conclusao: body?.ano_conclusao || '',
    vaga_institucional: body?.vaga_institucional || '',
    vaga_cooperacao: body?.vaga_cooperacao || '',
    vaga_reservada: body?.vaga_reservada || '',
    cotas: body?.cotas || '',
    raca_cor: body?.raca_cor || '',
    lingua_estrangeira: body?.lingua_estrangeira || '',
    vinculo_empregaticio: body?.vinculo_empregaticio || '',
    carga_horaria: body?.carga_horaria || '',
    empresa_vinculo: body?.empresa_vinculo || '',
    termo_compromisso: body?.termo_compromisso || '',
  };

  const project = {
    titulo_pt: body?.titulo_pt || '',
    titulo_en: body?.titulo_en || '',
    area: body?.area || '',
    palavras_pt: body?.palavras_pt || '',
    palavras_en: body?.palavras_en || '',
    resumo: limitText(body?.resumo || '', 1800),
    // Campos ANEXO IV (sem identificação)
    justificativa_enquadramento: body?.justificativa_enquadramento || '',
    introducao: body?.introducao || '',
    problema_pesquisa: body?.problema_pesquisa || '',
    justificativa_relevancia: body?.justificativa_relevancia || '',
    objetivo_geral: limitText(body?.objetivo_geral || '', 200),
    objetivos_especificos: body?.objetivos_especificos || '',
    objetivos_geral_especificos: body?.objetivos_geral_especificos || '',
    revisao_literatura: body?.revisao_literatura || '',
    procedimentos_metodologicos: body?.procedimentos_metodologicos || '',
    cronograma: body?.cronograma || '',
    referencias: body?.referencias || '',

    // Campos antigos (mantidos para compatibilidade com registros anteriores)
    objetivos: body?.objetivos || '',
    metas: body?.metas || '',
    metodologia: body?.metodologia || '',
    relevancia: body?.relevancia || '',
    colaboradoras: body?.colaboradoras || '',
    resultados: body?.resultados || '',
    potencial: body?.potencial || '',
  };

  return { identified, project };
}

const ADMIN_STATUS_OPTIONS = ['Recebida', 'Em análise', 'Aprovada', 'Indeferida'];

function normalizeStatus(input) {
  const raw = String(input ?? '').trim();
  if (ADMIN_STATUS_OPTIONS.includes(raw)) return raw;
  return 'Recebida';
}

function toLower(s) {
  return String(s ?? '').toLowerCase();
}

function parseDateRange(fromStr, toStr) {
  const fromRaw = String(fromStr ?? '').trim();
  const toRaw = String(toStr ?? '').trim();

  const from = fromRaw ? new Date(fromRaw + 'T00:00:00') : null;
  const to = toRaw ? new Date(toRaw + 'T23:59:59.999') : null;
  const fromOk = from && !Number.isNaN(from.getTime()) ? from : null;
  const toOk = to && !Number.isNaN(to.getTime()) ? to : null;
  return { from: fromOk, to: toOk };
}

function filterSubmissions(submissions, { q, status, from, to }) {
  const qNorm = String(q ?? '').trim().toLowerCase();
  const statusNorm = String(status ?? '').trim();

  return submissions.filter(s => {
    const sStatus = normalizeStatus(s.status);

    if (statusNorm && statusNorm !== 'Todos' && sStatus !== statusNorm) return false;

    const createdAt = new Date(s.createdAt);
    if (from && createdAt < from) return false;
    if (to && createdAt > to) return false;

    if (!qNorm) return true;

    const hay = [
      s.protocol,
      s.identified?.nome,
      s.identified?.email,
      s.project?.titulo_pt,
    ].map(toLower).join(' | ');

    return hay.includes(qNorm);
  });
}

function csvEscape(value) {
  const s = String(value ?? '');
  if (/[";\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function formatPtBrDateTime(iso) {
  try {
    return new Date(iso).toLocaleString('pt-BR');
  } catch {
    return String(iso ?? '');
  }
}

app.post('/api/submissions', (req, res) => {
  const honeypot = String(req.body?.website || '').trim();
  if (honeypot) {
    return res.status(400).json({ error: 'Invalid submission' });
  }

  const formVersion = String(req.body?.form_version || '');
  const cpfDigits = String(req.body?.cpf || '').replace(/\D/g, '');

  if (!isValidCPF(cpfDigits)) {
    return res.status(400).json({ error: 'CPF inválido' });
  }

  if (String(req.body?.termo_compromisso || '') !== 'Concordo') {
    return res.status(400).json({ error: 'Declaração obrigatória' });
  }

  const { identified, project } = pickSubmissionPayload(req.body);

  if (!identified.nome || identified.nome.trim().length < 5) {
    return res.status(400).json({ error: 'Nome obrigatório' });
  }
  if (!project.titulo_pt || project.titulo_pt.trim().length < 3) {
    return res.status(400).json({ error: 'Título do projeto obrigatório' });
  }

  const cpfHash = hmacSha256Hex(HMAC_SECRET, cpfDigits);
  if (storage.hasCpfHash(cpfHash)) {
    return res.status(409).json({ error: 'CPF já possui inscrição registrada' });
  }

  const protocol = generateProtocol('PLANTERR', '2025');
  const createdAt = new Date().toISOString();

  const payloadForHash = {
    protocol,
    createdAt,
    form_version: formVersion,
    identified,
    project,
  };

  const canonical = stableStringify(payloadForHash);
  const hash = sha256Hex(canonical);

  const record = {
    protocol,
    createdAt,
    ip: req.ip,
    userAgent: req.headers['user-agent'] || '',
    formVersion,
    cpfHash,
    cpfLast4: cpfDigits.slice(-4),
    hash,
    status: 'Recebida',
    adminNotes: '',
    identified,
    project,
  };

  storage.addSubmission(record);

  return res.status(201).json({
    protocol,
    hash,
    createdAt,
  });
});

app.get('/admin/export.csv', basicAuth, (req, res) => {
  const q = String(req.query.q ?? '');
  const status = String(req.query.status ?? '');
  const fromStr = String(req.query.from ?? '');
  const toStr = String(req.query.to ?? '');
  const { from, to } = parseDateRange(fromStr, toStr);

  const submissions = filterSubmissions(storage.listSubmissions(), { q, status, from, to });

  const header = [
    'protocolo',
    'data_hora',
    'status',
    'cpf_ultimos_4',
    'nome',
    'email',
    'titulo',
    'area',
    'hash_curto',
  ].join(';');

  const lines = submissions.map(s => {
    const row = [
      s.protocol,
      formatPtBrDateTime(s.createdAt),
      normalizeStatus(s.status),
      s.cpfLast4,
      s.identified?.nome || '',
      s.identified?.email || '',
      s.project?.titulo_pt || '',
      s.project?.area || '',
      (s.hash || '').slice(0, 16) + '…',
    ].map(csvEscape);
    return row.join(';');
  });

  const csv = [header, ...lines].join('\r\n') + '\r\n';
  const filename = `inscricoes_${new Date().toISOString().slice(0, 10)}.csv`;

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(csv);
});

app.post('/admin/reset', basicAuth, (req, res) => {
  const confirm = String(req.body?.confirm ?? '').trim().toLowerCase();
  if (confirm !== 'sim') {
    return res.status(400).send('Confirmação obrigatória');
  }

  storage.clearAllSubmissions();
  return res.redirect('/admin');
});

app.get('/api/verify/:protocol', (req, res) => {
  const protocol = req.params.protocol;
  const record = storage.getByProtocol(protocol);
  if (!record) return res.status(404).json({ error: 'Não encontrado' });

  const payloadForHash = {
    protocol: record.protocol,
    createdAt: record.createdAt,
    form_version: record.formVersion,
    identified: record.identified,
    project: record.project,
  };

  const canonical = stableStringify(payloadForHash);
  const computed = sha256Hex(canonical);

  return res.json({
    protocol: record.protocol,
    storedHash: record.hash,
    computedHash: computed,
    valid: computed === record.hash,
  });
});

app.get('/admin', basicAuth, (req, res) => {
  const q = String(req.query.q ?? '');
  const status = String(req.query.status ?? '');
  const fromStr = String(req.query.from ?? '');
  const toStr = String(req.query.to ?? '');
  const { from, to } = parseDateRange(fromStr, toStr);

  const submissions = filterSubmissions(storage.listSubmissions(), { q, status, from, to });
  const evals = storage.listEvaluations();
  const evalMap = new Map(evals.map(e => [e.protocol, e]));

  // Pesos: Projeto=4, Entrevista=5, Língua=1
  // Agora todas as notas (proj, int, lang) são salvas na escala 0-10.
  const WEIGHTS = { project: 4, interview: 5, language: 1 };
  const MAX = { project: 10, interview: 10, language: 10 };

  function getScore(protocol) {
    const e = evalMap.get(protocol);
    if (!e) return null;
    const proj = Number(e.proj_total || 0);
    const intr = Number(e.int_total || 0);
    const lang = Number(e.lang_total || 0);
    const projNorm = Math.max(0, Math.min(1, proj / MAX.project));
    const intrNorm = Math.max(0, Math.min(1, intr / MAX.interview));
    const langNorm = Math.max(0, Math.min(1, lang / MAX.language));
    const weighted = (projNorm * WEIGHTS.project) + (intrNorm * WEIGHTS.interview) + (langNorm * WEIGHTS.language);
    return weighted.toFixed(2);
  }

  const qs = new URLSearchParams({ q, status, from: fromStr, to: toStr }).toString();
  const exportUrl = '/admin/export.csv' + (qs ? `?${qs}` : '');

  const rows = submissions.map(s => {
    const sStatus = normalizeStatus(s.status);
    const score = getScore(s.protocol);
    return `
      <tr>
        <td>${escapeHtml(new Date(s.createdAt).toLocaleString('pt-BR'))}</td>
        <td><a href="/admin/submission/${encodeURIComponent(s.protocol)}">${escapeHtml(s.protocol)}</a></td>
        <td>${escapeHtml(sStatus)}</td>
        <td>${escapeHtml(s.cpfLast4)}</td>
        <td>${escapeHtml((s.identified?.nome || '').slice(0, 60))}</td>
        <td>${escapeHtml((s.identified?.email || '').slice(0, 60))}</td>
        <td>${score ? escapeHtml(score) : '<span style="color:#ccc;">—</span>'}</td>
        <td style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px;">${escapeHtml((s.hash || '').slice(0, 16))}…</td>
      </tr>
    `;
  }).join('');

  res.type('html').send(`
    <!doctype html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Admin - Inscrições PLANTERR</title>
      <link rel="stylesheet" href="/theme.css" />
      <style>
        .hint { color: #003366; font-size: 11px; }
        .filters-grid { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 8px; align-items: end; }
        .filters-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; justify-content: center; margin-top: 8px; }
        .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
        @media (max-width: 900px) { .filters-grid { grid-template-columns: 1fr; } }
      </style>
    </head>
    <body>
      <div class="container">
        <header class="main-header">
          <div style="display:flex; align-items:center; justify-content:center; gap:15px;">
            <img src="/img/logo_planter.png" alt="Logo Planterr" style="max-height:80px; width:auto;">
            <h1>Administração de Inscrições - PLANTERR</h1>
          </div>
        </header>

        <section class="panel">
          <div class="panel-header"><h2>Busca e filtros</h2></div>
          <div class="panel-body">
            <div class="hint">Dica: clique no protocolo para ver detalhes, status e verificação.</div>
            <div class="admin-actions" style="justify-content:center; margin-top: 8px;">
              <a class="btn-secondary" href="/committee">Área da Comissão</a>
              <a class="btn-secondary" href="/committee/results">Ranking / Resultados</a>
              <form method="POST" action="/admin/reset" onsubmit="return confirm('Isso vai apagar TODAS as inscrições registradas.\n\nUse apenas para TESTE.\n\nDeseja continuar?');" style="margin:0;">
                <input type="hidden" name="confirm" value="sim" />
                <button class="btn-secondary" type="submit">Limpar inscrições (teste)</button>
              </form>
            </div>
            <form method="GET" action="/admin">
              <div class="filters-grid" style="margin-top: 8px;">
                <div class="form-group" style="margin-bottom: 0;">
                  <label for="q">Busca (protocolo, nome, email, título)</label>
                  <input id="q" name="q" type="text" value="${escapeHtml(q)}" placeholder="Ex.: PLANTERR-2025..." />
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                  <label for="status">Status</label>
                  <select id="status" name="status">
                    ${['Todos', ...ADMIN_STATUS_OPTIONS].map(opt => {
                      const sel = String(status || 'Todos') === opt ? 'selected' : '';
                      return `<option value="${escapeHtml(opt)}" ${sel}>${escapeHtml(opt)}</option>`;
                    }).join('')}
                  </select>
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                  <label for="from">De</label>
                  <input id="from" name="from" type="date" value="${escapeHtml(fromStr)}" />
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                  <label for="to">Até</label>
                  <input id="to" name="to" type="date" value="${escapeHtml(toStr)}" />
                </div>
              </div>
              <div class="filters-actions">
                <button class="btn-primary" type="submit">Filtrar</button>
                <a class="btn-secondary" href="/admin">Limpar</a>
                <a class="btn-secondary" href="${exportUrl}">Baixar CSV</a>
              </div>
            </form>
          </div>
        </section>

        <section class="panel">
          <div class="panel-header"><h2>Inscrições</h2></div>
          <div class="panel-body" style="background-color:#fff;">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Protocolo</th>
                  <th>Status</th>
                  <th>CPF (últ. 4)</th>
                  <th>Nome</th>
                  <th>Email</th>
                  <th>Nota Final</th>
                  <th>Hash</th>
                </tr>
              </thead>
              <tbody>
                ${rows || '<tr><td colspan="8">Nenhuma inscrição encontrada.</td></tr>'}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </body>
    </html>
  `);
});

// Committee evaluation pages and API
app.get('/committee', basicAuth, (req, res) => {
  const subs = storage.listSubmissions();
  const evals = storage.listEvaluations();
  const evalMap = new Map(evals.map(e => [e.protocol, e]));

  // Pesos provisórios do edital: Projeto=4, Entrevista=5, Língua=1
  const WEIGHTS = { project: 4, interview: 5, language: 1 };
  const MAX = { project: 10, interview: 10, language: 10 }; // normalização por máximos

  function score(protocol) {
    const e = evalMap.get(protocol);
    if (!e) return { total: '', status: '—', components: {} };
    // Usar totais detalhados, se existirem
    const proj = Number(e.proj_total || 0);
    const intr = Number(e.int_total || 0);
    const lang = Number(e.lang_total || 0);
    const projNorm = Math.max(0, Math.min(1, proj / MAX.project));
    const intrNorm = Math.max(0, Math.min(1, intr / MAX.interview));
    const langNorm = Math.max(0, Math.min(1, lang / MAX.language));
    const weighted = (projNorm * WEIGHTS.project) + (intrNorm * WEIGHTS.interview) + (langNorm * WEIGHTS.language);
    const status = e.eliminado ? 'Eliminado' : 'Classificável';
    return { total: weighted.toFixed(2), status, components: { proj, intr, lang } };
  }

  const subsLine1 = subs.filter(s => (s.project?.area || '').includes('Linha de Pesquisa 1'));
  const subsLine2 = subs.filter(s => (s.project?.area || '').includes('Linha de Pesquisa 2'));
  const subsOther = subs.filter(s => !(s.project?.area || '').includes('Linha de Pesquisa 1') && !(s.project?.area || '').includes('Linha de Pesquisa 2'));

  function renderRows(list) {
    if (!list.length) return '<tr><td colspan="8">Nenhum projeto nesta linha.</td></tr>';
    return list.map(s => {
      const e = evalMap.get(s.protocol);
      const sc = score(s.protocol);
      return `
        <tr>
          <td>${escapeHtml(s.protocol)}</td>
          <td>${escapeHtml((s.project?.titulo_pt || '').slice(0, 80))}</td>
          <td>${e ? escapeHtml(String(e.proj_total ?? '')) : ''}</td>
          <td>${e ? escapeHtml(String(e.int_total ?? '')) : ''}</td>
          <td>${e ? escapeHtml(String(e.lang_total ?? '')) : ''}</td>
          <td>${escapeHtml(sc.total)}</td>
          <td>${escapeHtml(sc.status)}</td>
          <td><a class="btn-secondary" href="/committee/evaluate/${encodeURIComponent(s.protocol)}">Avaliar</a></td>
        </tr>
      `;
    }).join('');
  }

  res.type('html').send(`
    <!doctype html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Comissão - Avaliações</title>
      <link rel="stylesheet" href="/theme.css" />
    </head>
    <body>
      <div class="container">
        <header class="main-header"><h1>Comissão - Avaliações</h1></header>
        <div class="admin-actions" style="justify-content:center; margin-bottom:10px;">
          <a class="btn-secondary" href="/admin">Admin</a>
        </div>
        
        <section class="panel">
          <div class="panel-header"><h2>Linha 1 – Planejamento Urbano-regional, Ambiental e de Comunidades Tradicionais</h2></div>
          <div class="panel-body" style="background-color:#fff;">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Protocolo</th><th>Título</th><th>Projeto (0–10)</th><th>Entrevista (0–10)</th><th>Língua (0–10)</th><th>Total (P=4/E=5/L=1)</th><th>Status</th><th>Ações</th>
                </tr>
              </thead>
              <tbody>
                ${renderRows(subsLine1)}
              </tbody>
            </table>
          </div>
        </section>

        <section class="panel">
          <div class="panel-header"><h2>Linha 2 – Políticas públicas, Planejamento Territorial e Participação Social</h2></div>
          <div class="panel-body" style="background-color:#fff;">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Protocolo</th><th>Título</th><th>Projeto (0–10)</th><th>Entrevista (0–10)</th><th>Língua (0–10)</th><th>Total (P=4/E=5/L=1)</th><th>Status</th><th>Ações</th>
                </tr>
              </thead>
              <tbody>
                ${renderRows(subsLine2)}
              </tbody>
            </table>
          </div>
        </section>

        ${subsOther.length ? `
        <section class="panel">
          <div class="panel-header"><h2>Outros / Não classificados</h2></div>
          <div class="panel-body" style="background-color:#fff;">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Protocolo</th><th>Título</th><th>Projeto (0–10)</th><th>Entrevista (0–10)</th><th>Língua (0–10)</th><th>Total (P=4/E=5/L=1)</th><th>Status</th><th>Ações</th>
                </tr>
              </thead>
              <tbody>
                ${renderRows(subsOther)}
              </tbody>
            </table>
          </div>
        </section>` : ''}
      </div>
    </body>
    </html>
  `);
});

// Página de resultados com ranking
app.get('/committee/results', basicAuth, (req, res) => {
  const subs = storage.listSubmissions();
  const evals = storage.listEvaluations();
  const evalMap = new Map(evals.map(e => [e.protocol, e]));
  const WEIGHTS = { project: 4, interview: 5, language: 1 };
  const MAX = { project: 10, interview: 10, language: 10 };

  function totalScore(e) {
    if (!e) return 0;
    const projNorm = Math.max(0, Math.min(1, Number(e.proj_total || 0) / MAX.project));
    const intrNorm = Math.max(0, Math.min(1, Number(e.int_total || 0) / MAX.interview));
    const langNorm = Math.max(0, Math.min(1, Number(e.lang_total || 0) / MAX.language));
    return (projNorm * WEIGHTS.project) + (intrNorm * WEIGHTS.interview) + (langNorm * WEIGHTS.language);
  }

  const rowsData = subs.map(s => {
    const e = evalMap.get(s.protocol);
    return {
      protocol: s.protocol,
      nome: s.identified?.nome || '',
      titulo: s.project?.titulo_pt || '',
      area: s.project?.area || '',
      proj: e?.proj_total ?? '',
      intr: e?.int_total ?? '',
      lang: e?.lang_total ?? '',
      total: totalScore(e),
      eliminado: e?.eliminado ? 'Sim' : 'Não',
      reserva: s.identified?.cotas || '',
    };
  }).sort((a, b) => b.total - a.total);

  const rowsLine1 = rowsData.filter(r => r.area.includes('Linha de Pesquisa 1'));
  const rowsLine2 = rowsData.filter(r => r.area.includes('Linha de Pesquisa 2'));
  const rowsOther = rowsData.filter(r => !r.area.includes('Linha de Pesquisa 1') && !r.area.includes('Linha de Pesquisa 2'));

  function renderRankingRows(list) {
    if (!list.length) return '<tr><td colspan="8">Nenhum resultado.</td></tr>';
    return list.map(r => `
      <tr>
        <td>${escapeHtml(r.protocol)}</td>
        <td>${escapeHtml(r.titulo.slice(0, 80))}</td>
        <td>${escapeHtml(String(r.proj))}</td>
        <td>${escapeHtml(String(r.intr))}</td>
        <td>${escapeHtml(String(r.lang))}</td>
        <td>${escapeHtml(r.total.toFixed(2))}</td>
        <td>${escapeHtml(r.eliminado)}</td>
        <td>${escapeHtml(r.reserva)}</td>
      </tr>
    `).join('');
  }

  res.type('html').send(`
    <!doctype html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Comissão - Resultados</title>
      <link rel="stylesheet" href="/theme.css" />
    </head>
    <body>
      <div class="container">
        <header class="main-header"><h1>Resultados (Ranking)</h1></header>
        <div class="admin-actions" style="justify-content:center; gap:8px; margin-bottom:10px;">
          <a class="btn-secondary" href="/admin">← Voltar</a>
          <span class="admin-badge">Pesos: Projeto=4, Entrevista=5, Língua=1 (normalizados)</span>
        </div>

        <section class="panel">
          <div class="panel-header"><h2>Linha 1 – Planejamento Urbano-regional, Ambiental e de Comunidades Tradicionais</h2></div>
          <div class="panel-body" style="background-color:#fff;">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Protocolo</th><th>Título</th><th>Proj (0–10)</th><th>Ent (0–10)</th><th>Língua (0–10)</th><th>Total</th><th>Eliminado</th><th>Vagas Reservadas</th>
                </tr>
              </thead>
              <tbody>
                ${renderRankingRows(rowsLine1)}
              </tbody>
            </table>
          </div>
        </section>

        <section class="panel">
          <div class="panel-header"><h2>Linha 2 – Políticas públicas, Planejamento Territorial e Participação Social</h2></div>
          <div class="panel-body" style="background-color:#fff;">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Protocolo</th><th>Título</th><th>Proj (0–10)</th><th>Ent (0–10)</th><th>Língua (0–10)</th><th>Total</th><th>Eliminado</th><th>Vagas Reservadas</th>
                </tr>
              </thead>
              <tbody>
                ${renderRankingRows(rowsLine2)}
              </tbody>
            </table>
          </div>
        </section>

        ${rowsOther.length ? `
        <section class="panel">
          <div class="panel-header"><h2>Outros</h2></div>
          <div class="panel-body" style="background-color:#fff;">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Protocolo</th><th>Título</th><th>Proj (0–10)</th><th>Ent (0–10)</th><th>Língua (0–10)</th><th>Total</th><th>Eliminado</th><th>Vagas Reservadas</th>
                </tr>
              </thead>
              <tbody>
                ${renderRankingRows(rowsOther)}
              </tbody>
            </table>
          </div>
        </section>` : ''}
      </div>
    </body>
    </html>
  `);
});

app.get('/committee/evaluate/:protocol', basicAuth, (req, res) => {
  const protocol = req.params.protocol;
  const s = storage.getByProtocol(protocol);
  if (!s) return res.status(404).send('Não encontrado');
  const e = storage.getEvaluation(protocol) || {};

  // Projeto rubric max values
  const projectRubric = [
    { key: 'proj_intro', label: '1 – Introdução / Contextualização', max: 1 },
    { key: 'proj_problem', label: '2 – Problema ou questão de pesquisa', max: 1.5 },
    { key: 'proj_just', label: '3 – Justificativa (relevância e viabilidade)', max: 1 },
    { key: 'proj_objectives', label: '4 – Objetivos (geral e específicos)', max: 2 },
    { key: 'proj_review', label: '5 – Revisão da literatura', max: 1 },
    { key: 'proj_methods', label: '6 – Procedimentos metodológicos', max: 2.5 },
    { key: 'proj_schedule', label: '7 – Cronograma (2 anos)', max: 0.5 },
    { key: 'proj_refs', label: '8 – Referências (ABNT)', max: 0.5 },
  ];

  res.type('html').send(`
    <!doctype html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Avaliação - ${escapeHtml(protocol)}</title>
      <link rel="stylesheet" href="/theme.css" />
    </head>
    <body>
      <div class="container">
        <header class="main-header"><h1>Avaliação de Projeto</h1></header>
        <div class="admin-actions" style="justify-content:center; gap:8px;">
          <a class="btn-secondary" href="/committee">← Voltar</a>
          <span class="admin-badge">Protocolo: ${escapeHtml(protocol)}</span>
        </div>
        <section class="panel">
          <div class="panel-header"><h2>Ficha</h2></div>
          <div class="panel-body" style="background-color:#fff;">
            <div><strong>Título:</strong> ${escapeHtml(s.project?.titulo_pt || '')}</div>
            <div><strong>Linha:</strong> ${escapeHtml(s.project?.area || '')}</div>
          </div>
        </section>
        <section class="panel">
          <div class="panel-header"><h2>Avaliação</h2></div>
          <div class="panel-body">
            <form method="POST" action="/committee/evaluate/${encodeURIComponent(protocol)}">
              <h3 style="color:#003366;">Projeto (3 Avaliadores)</h3>
              <div class="grid" style="grid-template-columns: 1fr 1fr 1fr; gap: 8px;">
                ${['Avaliador1','Avaliador2','Avaliador3'].map(who => {
                  const prefix = `proj_${who.toLowerCase()}`;
                  return `
                    <div class="box">
                      <div style="font-weight:bold; color:#003366; margin-bottom:6px;">${who}</div>
                      ${projectRubric.map(item => {
                        const key = `${prefix}_${item.key}`;
                        const val = e[key] ?? '';
                        return `
                          <div class="form-group" style="margin-bottom:4px;">
                            <label for="${key}">${escapeHtml(item.label)} (máx. ${item.max})</label>
                            <input type="number" id="${key}" name="${key}" min="0" max="${item.max}" step="0.1" value="${escapeHtml(String(val))}" class="proj-input" />
                          </div>
                        `;
                      }).join('')}
                    </div>
                  `;
                }).join('')}
              </div>


              <div class="form-group" style="margin-top:8px;">
                <label for="proj_potential_interview">O(a) candidato(a) tem potencial e deve passar para a fase da entrevista?</label>
                <select id="proj_potential_interview" name="proj_potential_interview">
                  ${['','Sim','Não'].map(opt => {
                    const sel = String(e.proj_potential_interview || '') === opt ? 'selected' : '';
                    return `<option value="${escapeHtml(opt)}" ${sel}>${escapeHtml(opt||'Selecione…')}</option>`;
                  }).join('')}
                </select>
              </div>
              <div class="form-group">
                <label for="proj_justification">Justifique (pontos fortes e fracos do projeto)</label>
                <textarea id="proj_justification" name="proj_justification" rows="4">${escapeHtml(String(e.proj_justification || ''))}</textarea>
              </div>
              <div class="form-group">
                <label for="proj_interview_points">Aspectos a questionar na entrevista</label>
                <textarea id="proj_interview_points" name="proj_interview_points" rows="3">${escapeHtml(String(e.proj_interview_points || ''))}</textarea>
              </div>

              <h3 style="color:#003366; margin-top:12px;">Entrevista (3 Avaliadores)</h3>
              <div class="grid" style="grid-template-columns: 1fr 1fr 1fr; gap: 8px;">
                ${['Avaliador1','Avaliador2','Avaliador3'].map((who, idx) => {
                  const prefix = `int_${who.toLowerCase()}`;
                  const ap = e[`${prefix}_apresentacao`] ?? '';
                  const hp = e[`${prefix}_historico`] ?? '';
                  const df = e[`${prefix}_defesa`] ?? '';
                  const ji = e[`${prefix}_justificativa`] ?? '';
                  return `
                    <div class="box">
                      <div style="font-weight:bold; color:#003366;">${who}</div>
                      <div class="form-group" style="margin-bottom:4px;">
                        <label for="${prefix}_apresentacao">Apresentação (máx. 3)</label>
                        <input type="number" id="${prefix}_apresentacao" name="${prefix}_apresentacao" min="0" max="3" step="0.1" value="${escapeHtml(String(ap))}" class="int-input" />
                      </div>
                      <div class="form-group" style="margin-bottom:4px;">
                        <label for="${prefix}_historico">Histórico Profissional (máx. 2)</label>
                        <input type="number" id="${prefix}_historico" name="${prefix}_historico" min="0" max="2" step="0.1" value="${escapeHtml(String(hp))}" class="int-input" />
                      </div>
                      <div class="form-group" style="margin-bottom:4px;">
                        <label for="${prefix}_defesa">Defesa da proposta (máx. 3)</label>
                        <input type="number" id="${prefix}_defesa" name="${prefix}_defesa" min="0" max="3" step="0.1" value="${escapeHtml(String(df))}" class="int-input" />
                      </div>
                      <div class="form-group" style="margin-bottom:4px;">
                        <label for="${prefix}_justificativa">Justificativa/interesse + disponibilidade (máx. 2)</label>
                        <input type="number" id="${prefix}_justificativa" name="${prefix}_justificativa" min="0" max="2" step="0.1" value="${escapeHtml(String(ji))}" class="int-input" />
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>

              <h3 style="color:#003366; margin-top:12px;">Prova de Língua (3 Avaliadores)</h3>
              <div class="grid" style="grid-template-columns: 1fr 1fr 1fr; gap: 8px;">
                ${['Avaliador1','Avaliador2','Avaliador3'].map(who => {
                  const prefix = `lang_${who.toLowerCase()}`;
                  const c = e[`${prefix}_clareza`] ?? '';
                  const d = e[`${prefix}_domino`] ?? '';
                  const a = e[`${prefix}_analise`] ?? '';
                  return `
                    <div class="box">
                      <div style="font-weight:bold; color:#003366;">${who}</div>
                      <div class="form-group" style="margin-bottom:4px;">
                        <label for="${prefix}_clareza">Clareza e Coesão (0-10)</label>
                        <input type="number" id="${prefix}_clareza" name="${prefix}_clareza" min="0" max="10" step="0.1" value="${escapeHtml(String(c))}" class="lang-input" />
                      </div>
                      <div class="form-group" style="margin-bottom:4px;">
                        <label for="${prefix}_domino">Domínio do Conteúdo (0-10)</label>
                        <input type="number" id="${prefix}_domino" name="${prefix}_domino" min="0" max="10" step="0.1" value="${escapeHtml(String(d))}" class="lang-input" />
                      </div>
                      <div class="form-group" style="margin-bottom:4px;">
                        <label for="${prefix}_analise">Análise Crítica (0-10)</label>
                        <input type="number" id="${prefix}_analise" name="${prefix}_analise" min="0" max="10" step="0.1" value="${escapeHtml(String(a))}" class="lang-input" />
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
              <div class="hint" style="margin-top:6px;">Total da prova (por avaliador) = (Clareza*0,3) + (Domínio*0,4) + (Análise*0,3)</div>
              <div class="form-group" style="margin-top:8px;">
                <label for="lang_total_calc">Nota da Prova de Língua (0-10) - Média dos 3</label>
                <input type="text" id="lang_total_calc" readonly style="background-color:#eee; font-weight:bold;" value="${escapeHtml(String(e.lang_total ? e.lang_total.toFixed(2) : ''))}" />
              </div>
              <div class="form-group">
                <label for="nota_projeto">Nota do Projeto (0-10) - Média dos 3</label>
                <input type="number" id="nota_projeto" name="nota_projeto" min="0" max="10" step="0.1" readonly style="background-color:#eee;" value="${escapeHtml(String(e.nota_projeto || ''))}" />
              </div>
              <div class="form-group">
                <label for="nota_entrevista">Nota da Entrevista (0-10) - Média dos 3</label>
                <input type="number" id="nota_entrevista" name="nota_entrevista" min="0" max="10" step="0.1" readonly style="background-color:#eee;" value="${escapeHtml(String(e.nota_entrevista || ''))}" />
              </div>
              <div class="form-group">
                <label for="eliminado">Eliminação</label>
                <select id="eliminado" name="eliminado">
                  ${['Não','Sim'].map(opt => {
                    const sel = String(e.eliminado ? 'Sim' : 'Não') === opt ? 'selected' : '';
                    return `<option value="${escapeHtml(opt)}" ${sel}>${escapeHtml(opt)}</option>`;
                  }).join('')}
                </select>
              </div>
              <div class="form-group">
                <label for="observacoes">Observações</label>
                <textarea id="observacoes" name="observacoes" rows="4">${escapeHtml(String(e.observacoes || ''))}</textarea>
              </div>
              <div class="admin-actions" style="justify-content:center;">
                <button class="btn-primary" type="submit">Salvar avaliação</button>
              </div>
            </form>
          </div>
        </section>
      </div>
      <script>
        (function() {
          // Project fields
          const projKeys = ['proj_intro','proj_problem','proj_just','proj_objectives','proj_review','proj_methods','proj_schedule','proj_refs'];
          const projInputs = projKeys.map(k => document.getElementById(k));
          const notaProjeto = document.getElementById('nota_projeto');

          // Interview fields
          const intPrefixes = ['int_avaliador1','int_avaliador2','int_avaliador3'];
          const intSuffixes = ['_apresentacao','_historico','_defesa','_justificativa'];
          const intInputs = [];
          intPrefixes.forEach(p => {
            intSuffixes.forEach(s => {
              const el = document.getElementById(p + s);
              if (el) intInputs.push(el);
            });
          });
          const notaEntrevista = document.getElementById('nota_entrevista');

          // Language fields
          const langClareza = document.getElementById('lang_clareza');
          const langDomino = document.getElementById('lang_domino');
          const langAnalise = document.getElementById('lang_analise');
          const langTotalCalc = document.getElementById('lang_total_calc');

          function calcProject() {
            let sum = 0;
            projInputs.forEach(el => {
              if (el) sum += parseFloat(el.value) || 0;
            });
            // Project rubric sums to 10.
            if (notaProjeto) notaProjeto.value = sum.toFixed(2);
          }

          function calcInterview() {
            let sum = 0;
            intInputs.forEach(el => {
              if (el) sum += parseFloat(el.value) || 0;
            });
            // Interview rubric: 3 evaluators * 10 points = 30 max.
            // Convert to 0-10: (sum / 30) * 10
            if (notaEntrevista) notaEntrevista.value = ((sum / 30) * 10).toFixed(2);
          }

          function calcLanguage() {
            const c = parseFloat(langClareza.value) || 0;
            const d = parseFloat(langDomino.value) || 0;
            const a = parseFloat(langAnalise.value) || 0;
            const total = (c * 0.3) + (d * 0.4) + (a * 0.3);
            if (langTotalCalc) langTotalCalc.value = total.toFixed(2);
          }

          // Attach listeners
          projInputs.forEach(el => { if(el) el.addEventListener('input', calcProject); });
          intInputs.forEach(el => { if(el) el.addEventListener('input', calcInterview); });
          
          if (langClareza) langClareza.addEventListener('input', calcLanguage);
          if (langDomino) langDomino.addEventListener('input', calcLanguage);
          if (langAnalise) langAnalise.addEventListener('input', calcLanguage);
        })();
      </script>
    </body>
    </html>
  `);
});

app.post('/committee/evaluate/:protocol', basicAuth, (req, res) => {
  const protocol = req.params.protocol;
  const s = storage.getByProtocol(protocol);
  if (!s) return res.status(404).send('Não encontrado');

  const evaluators = ['avaliador1','avaliador2','avaliador3'];

  // Projeto: 3 avaliadores, cada um com 8 itens
  const projectKeys = ['proj_intro','proj_problem','proj_just','proj_objectives','proj_review','proj_methods','proj_schedule','proj_refs'];
  const projectScores = {};
  let projSum = 0;
  
  evaluators.forEach(who => {
    projectKeys.forEach(k => {
      const key = `proj_${who}_${k}`;
      const v = Number(req.body?.[key] ?? '0');
      projectScores[key] = v;
      projSum += v;
    });
  });
  // Average (0-10) = Sum / 3
  const projTotal = (projSum / 3);

  // Entrevista: 3 avaliadores, cada com 4 itens
  const interviewScores = {};
  let intSum = 0;
  evaluators.forEach(who => {
    const prefix = `int_${who}`;
    const ap = Number(req.body?.[`${prefix}_apresentacao`] ?? '0');
    const hp = Number(req.body?.[`${prefix}_historico`] ?? '0');
    const df = Number(req.body?.[`${prefix}_defesa`] ?? '0');
    const ji = Number(req.body?.[`${prefix}_justificativa`] ?? '0');
    interviewScores[`${prefix}_apresentacao`] = ap;
    interviewScores[`${prefix}_historico`] = hp;
    interviewScores[`${prefix}_defesa`] = df;
    interviewScores[`${prefix}_justificativa`] = ji;
    intSum += ap + hp + df + ji;
  });
  // Average (0-10) = Sum / 3
  const intTotal = (intSum / 3);

  const proj_possible_supervisor = String(req.body?.proj_possible_supervisor || '');
  const proj_potential_interview = String(req.body?.proj_potential_interview || '');
  const proj_justification = String(req.body?.proj_justification || '').slice(0, 4000);
  const proj_interview_points = String(req.body?.proj_interview_points || '').slice(0, 4000);

  const eliminado = String(req.body?.eliminado || 'Não') === 'Sim';
  const observacoes = String(req.body?.observacoes || '').slice(0, 2000);

  // Prova de língua: 3 avaliadores
  const langScores = {};
  let langSum = 0;
  evaluators.forEach(who => {
    const prefix = `lang_${who}`;
    const c = Number(req.body?.[`${prefix}_clareza`] ?? '0');
    const d = Number(req.body?.[`${prefix}_domino`] ?? '0');
    const a = Number(req.body?.[`${prefix}_analise`] ?? '0');
    langScores[`${prefix}_clareza`] = c;
    langScores[`${prefix}_domino`] = d;
    langScores[`${prefix}_analise`] = a;
    // Weighted sum per evaluator
    langSum += (c * 0.3) + (d * 0.4) + (a * 0.3);
  });
  // Average (0-10) = Sum / 3
  const lang_total = (langSum / 3);

  storage.upsertEvaluation({
    protocol,
    // Projeto detalhado
    ...projectScores,
    proj_total: projTotal,
    proj_possible_supervisor,
    proj_potential_interview,
    proj_justification,
    proj_interview_points,
    // Entrevista detalhada
    ...interviewScores,
    int_total: intTotal,
    // Língua
    ...langScores,
    lang_total,
    eliminado,
    observacoes,
  });
  return res.redirect(`/committee/evaluate/${encodeURIComponent(protocol)}`);
});

app.post('/admin/submission/:protocol', basicAuth, (req, res) => {
  const protocol = req.params.protocol;
  const record = storage.getByProtocol(protocol);
  if (!record) return res.status(404).send('Não encontrado');

  const status = normalizeStatus(req.body?.status);
  const notesRaw = String(req.body?.observacoes_internas ?? '');
  const notes = notesRaw.length > 5000 ? notesRaw.slice(0, 5000) : notesRaw;

  storage.updateByProtocol(protocol, {
    status,
    adminNotes: notes,
  });

  return res.redirect(`/admin/submission/${encodeURIComponent(protocol)}`);
});

app.get('/admin/submission/:protocol', basicAuth, (req, res) => {
  const protocol = req.params.protocol;
  const record = storage.getByProtocol(protocol);
  if (!record) return res.status(404).send('Não encontrado');

  const verifyUrl = `/api/verify/${encodeURIComponent(protocol)}`;

  const payloadForHash = {
    protocol: record.protocol,
    createdAt: record.createdAt,
    form_version: record.formVersion,
    identified: record.identified,
    project: record.project,
  };
  const computedHash = sha256Hex(stableStringify(payloadForHash));
  const hashValid = computedHash === record.hash;
  const recordStatus = normalizeStatus(record.status);
  const adminNotes = String(record.adminNotes ?? '');

  function safeValue(value) {
    const text = String(value ?? '').trim();
    return text ? escapeHtml(text) : '<span class="muted">—</span>';
  }

  function safeMultiline(value) {
    const text = String(value ?? '').trim();
    if (!text) return '<span class="muted">—</span>';
    return escapeHtml(text).replace(/\n/g, '<br>');
  }

  function coalesceProjectField(...values) {
    for (const v of values) {
      const text = String(v ?? '').trim();
      if (text) return text;
    }
    return '';
  }

  res.type('html').send(`
    <!doctype html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Admin - ${escapeHtml(protocol)}</title>
      <link rel="stylesheet" href="/theme.css" />
      <style>
        .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
        .muted { color: #003366; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .summary { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 10px; }
        .sectionTitle { margin: 10px 0 6px; }
        .box { border: 1px solid #86A3C2; background-color: #fff; padding: 8px; }
        .kv { width: 100%; border-collapse: collapse; background-color: #fff; }
        .kv th, .kv td { border: 1px solid #86A3C2; padding: 6px; vertical-align: top; }
        .kv th { background-color: #D0E5F5; color: #003366; text-align: left; width: 34%; }
        .badge { display: inline-block; padding: 2px 8px; border: 1px solid #86A3C2; background-color: #F4F9FD; color: #003366; font-weight: bold; }
        @media (max-width: 900px) { .grid, .summary { grid-template-columns: 1fr; } }

        @media print {
          body { background: #fff; padding: 0; }
          .container { border: none; max-width: none; margin: 0; }
          .main-header { border-bottom: 2px solid #003366; }
          a, button { display: none !important; }
          .admin-actions { display: none !important; }
          .panel { break-inside: avoid; page-break-inside: avoid; }
        }

        @page { margin: 12mm; }
      </style>
    </head>
    <body>
      <div class="container">
        <header class="main-header">
          <div style="display:flex; align-items:center; justify-content:center; gap:15px;">
            <img src="/img/logo_planter.png" alt="Logo Planterr" style="max-height:80px; width:auto;">
            <h1>Administração de Inscrições - PLANTERR</h1>
          </div>
        </header>

        <div class="admin-actions" style="justify-content: center; margin-bottom: 10px;">
          <a class="btn-secondary" href="/admin">← Voltar</a>
          <button class="btn-secondary" type="button" id="print-btn">Imprimir / Salvar em PDF</button>
          <span class="admin-badge">Protocolo: <span class="mono" id="protocol">${escapeHtml(protocol)}</span></span>
          <span class="admin-badge">Status integridade: ${hashValid ? 'Íntegra (hash confere)' : 'Atenção: hash não confere'}</span>
        </div>

        <section class="panel">
          <div class="panel-header"><h2>Resumo</h2></div>
          <div class="panel-body">
            <div class="summary">
              <div><strong>Data/Hora:</strong> ${escapeHtml(new Date(record.createdAt).toLocaleString('pt-BR'))}</div>
              <div><strong>CPF (últimos 4):</strong> ${safeValue(record.cpfLast4)}</div>
              <div><strong>Nome:</strong> ${safeValue(record.identified?.nome)}</div>
              <div><strong>Email:</strong> ${safeValue(record.identified?.email)}</div>
              <div><strong>Versão do formulário:</strong> ${safeValue(record.formVersion)}</div>
              <div><strong>Verificação (JSON):</strong> <a href="${verifyUrl}">${verifyUrl}</a></div>
            </div>

            <div class="sectionTitle"><strong>Status e observações internas</strong></div>
            <form method="POST" action="/admin/submission/${encodeURIComponent(protocol)}">
              <div class="grid" style="grid-template-columns: 1fr; gap: 8px;">
                <div class="form-group" style="margin-bottom: 0;">
                  <label for="status">Status</label>
                  <select id="status" name="status">
                    ${ADMIN_STATUS_OPTIONS.map(opt => {
                      const sel = recordStatus === opt ? 'selected' : '';
                      return `<option value="${escapeHtml(opt)}" ${sel}>${escapeHtml(opt)}</option>`;
                    }).join('')}
                  </select>
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                  <label for="observacoes_internas">Observações internas (não vai para o PDF)</label>
                  <textarea id="observacoes_internas" name="observacoes_internas" rows="5">${escapeHtml(adminNotes)}</textarea>
                </div>
                <div class="admin-actions" style="justify-content:center;">
                  <button class="btn-primary" type="submit">Salvar</button>
                </div>
              </div>
            </form>

            <div class="sectionTitle"><strong>Código de verificação (hash)</strong></div>
            <div class="admin-box">
              <div class="mono" style="word-break: break-word;" id="hash">${escapeHtml(record.hash)}</div>
              <div class="muted" style="margin-top: 6px;">Use este código para conferir se o registro/PDF não foi alterado.</div>
              <div class="admin-actions" style="justify-content:center; margin-top: 8px;">
                <button class="btn-secondary" type="button" data-copy="#protocol">Copiar protocolo</button>
                <button class="btn-secondary" type="button" data-copy="#hash">Copiar hash</button>
              </div>
            </div>
          </div>
        </section>

        <div class="grid" style="margin-top: 10px;">
          <section class="panel" style="margin-bottom: 0;">
            <div class="panel-header"><h2>Identificação (ficha)</h2></div>
            <div class="panel-body" style="background-color:#fff;">
              <table class="kv" role="table">
            <tbody>
              <tr><th>Nome</th><td>${safeValue(record.identified?.nome)}</td></tr>
              <tr><th>Nome social</th><td>${safeValue(record.identified?.nome_social)}</td></tr>
              <tr><th>Data de nascimento</th><td>${safeValue(record.identified?.data_nascimento)}</td></tr>
              <tr><th>RG</th><td>${safeValue(record.identified?.rg)}</td></tr>
              <tr><th>Órgão expedidor</th><td>${safeValue(record.identified?.orgao_expedidor)}</td></tr>
              <tr><th>Data de expedição</th><td>${safeValue(record.identified?.data_expedicao)}</td></tr>
              <tr><th>Endereço</th><td>${safeValue(record.identified?.endereco)}</td></tr>
              <tr><th>Cidade/Estado</th><td>${safeValue(record.identified?.cidade_estado)}</td></tr>
              <tr><th>CEP</th><td>${safeValue(record.identified?.cep)}</td></tr>
              <tr><th>Celular</th><td>${safeValue(record.identified?.celular)}</td></tr>
              <tr><th>Telefone residencial</th><td>${safeValue(record.identified?.telefone_residencial)}</td></tr>
              <tr><th>Email</th><td>${safeValue(record.identified?.email)}</td></tr>
              <tr><th>Curso de graduação</th><td>${safeValue(record.identified?.curso_graduacao)}</td></tr>
              <tr><th>Instituição</th><td>${safeValue(record.identified?.instituicao)}</td></tr>
              <tr><th>Ano de conclusão</th><td>${safeValue(record.identified?.ano_conclusao)}</td></tr>
              <tr><th>Vagas / cotas</th><td>${safeValue(record.identified?.vaga_institucional || record.identified?.vaga_cooperacao || record.identified?.vaga_reservada || record.identified?.cotas)}</td></tr>
              <tr><th>Raça/Cor</th><td>${safeValue(record.identified?.raca_cor)}</td></tr>
              <tr><th>Língua estrangeira</th><td>${safeValue(record.identified?.lingua_estrangeira)}</td></tr>
              <tr><th>Vínculo empregatício</th><td>${safeValue(record.identified?.vinculo_empregaticio)}</td></tr>
              <tr><th>Carga horária</th><td>${safeValue(record.identified?.carga_horaria)}</td></tr>
              <tr><th>Empresa (se houver)</th><td>${safeValue(record.identified?.empresa_vinculo)}</td></tr>
              <tr><th>Declaração</th><td>${safeValue(record.identified?.termo_compromisso)}</td></tr>
            </tbody>
          </table>
              <div class="muted" style="margin-top: 8px;">Obs.: o CPF completo não é exibido no admin (somente os últimos 4 dígitos).</div>
            </div>
          </section>

          <section class="panel" style="margin-bottom: 0;">
            <div class="panel-header"><h2>Projeto (blind review)</h2></div>
            <div class="panel-body" style="background-color:#fff;">
              <table class="kv" role="table">
            <tbody>
              <tr><th>Título (PT)</th><td>${safeValue(record.project?.titulo_pt)}</td></tr>
              <tr><th>Título (EN)</th><td>${safeValue(record.project?.titulo_en)}</td></tr>
              <tr><th>Área</th><td>${safeValue(record.project?.area)}</td></tr>
              <tr><th>Palavras-chave (PT)</th><td>${safeValue(record.project?.palavras_pt)}</td></tr>
              <tr><th>Keywords (EN)</th><td>${safeValue(record.project?.palavras_en)}</td></tr>
            </tbody>
          </table>

          <div class="sectionTitle"><strong>Justificativa para enquadramento na linha de pesquisa</strong></div>
          <div class="box">${safeMultiline(record.project?.justificativa_enquadramento)}</div>

          <div class="sectionTitle"><strong>Resumo</strong></div>
          <div class="box">${safeMultiline(record.project?.resumo)}</div>

          <div class="sectionTitle"><strong>1 – Introdução / Contextualização</strong></div>
          <div class="box">${safeMultiline(record.project?.introducao)}</div>

          <div class="sectionTitle"><strong>2 – Problema ou questão de pesquisa</strong></div>
          <div class="box">${safeMultiline(record.project?.problema_pesquisa)}</div>

          <div class="sectionTitle"><strong>3 – Justificativa (relevância do tema)</strong></div>
          <div class="box">${safeMultiline(record.project?.justificativa_relevancia)}</div>

          <div class="sectionTitle"><strong>4 – Objetivos</strong></div>
          <div class="sectionTitle"><strong>Objetivo geral</strong></div>
          <div class="box">${safeMultiline(coalesceProjectField(record.project?.objetivo_geral, record.project?.objetivos_geral_especificos, record.project?.objetivos))}</div>

          <div class="sectionTitle"><strong>Objetivos específicos</strong></div>
          <div class="box">${safeMultiline(coalesceProjectField(record.project?.objetivos_especificos))}</div>
            </div>
          </section>
        </div>

      </div>

      <script>
        async function copyText(text) {
          try {
            if (navigator.clipboard && window.isSecureContext) {
              await navigator.clipboard.writeText(text);
              return true;
            }
          } catch (e) {}

          try {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            document.body.appendChild(ta);
            ta.focus();
            ta.select();
            const ok = document.execCommand('copy');
            document.body.removeChild(ta);
            return ok;
          } catch (e) {
            return false;
          }
        }

        document.addEventListener('click', async (ev) => {
          const btn = ev.target.closest('button[data-copy]');
          if (!btn) return;
          const sel = btn.getAttribute('data-copy');
          const el = document.querySelector(sel);
          if (!el) return;

          const text = (el.textContent || '').trim();
          const ok = await copyText(text);
          const old = btn.textContent;
          btn.textContent = ok ? 'Copiado' : 'Falhou';
          setTimeout(() => { btn.textContent = old; }, 900);
        });

        const printBtn = document.getElementById('print-btn');
        if (printBtn) {
          printBtn.addEventListener('click', () => {
            window.print();
          });
        }
      </script>
    </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
  console.log(`Admin em http://localhost:${PORT}/admin (Basic Auth)`);
});
