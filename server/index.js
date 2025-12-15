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
  const qs = new URLSearchParams({ q, status, from: fromStr, to: toStr }).toString();
  const exportUrl = '/admin/export.csv' + (qs ? `?${qs}` : '');

  const rows = submissions.map(s => {
    const sStatus = normalizeStatus(s.status);
    return `
      <tr>
        <td>${escapeHtml(new Date(s.createdAt).toLocaleString('pt-BR'))}</td>
        <td><a href="/admin/submission/${encodeURIComponent(s.protocol)}">${escapeHtml(s.protocol)}</a></td>
        <td>${escapeHtml(sStatus)}</td>
        <td>${escapeHtml(s.cpfLast4)}</td>
        <td>${escapeHtml((s.identified?.nome || '').slice(0, 60))}</td>
        <td>${escapeHtml((s.identified?.email || '').slice(0, 60))}</td>
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
                  <th>Hash</th>
                </tr>
              </thead>
              <tbody>
                ${rows || '<tr><td colspan="7">Nenhuma inscrição encontrada.</td></tr>'}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </body>
    </html>
  `);
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
