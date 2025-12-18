const escapeHtml = (unsafe) => {
  return String(unsafe || '')
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

class AdminDashboardPresenter {
  constructor(adminSecret) {
    this.adminSecret = adminSecret;
  }

  renderAppeals(appeals, filters) {
    const { q, fromStr, toStr } = filters;

    const toLower = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    const maskCpf = (cpf) => {
      const digits = String(cpf || '').replace(/\D/g, '');
      if (digits.length < 4) return String(cpf || '');
      return `***.***.***-${digits.slice(-2)} (final ${digits.slice(-4)})`;
    };

    const rows = (appeals || []).map(a => {
      const protocol = String(a.protocol || '');
      const submissionProtocol = String(a.submissionProtocol || '');
      const created = a.createdAt ? new Date(a.createdAt).toLocaleString('pt-BR') : '';
      return `
        <tr>
          <td>${escapeHtml(created)}</td>
          <td class="mono">${escapeHtml(protocol)}</td>
          <td class="mono">${escapeHtml(submissionProtocol)}</td>
          <td>${escapeHtml((a.nome || '').slice(0, 60))}</td>
          <td>${escapeHtml((a.email || '').slice(0, 60))}</td>
          <td>${escapeHtml(maskCpf(a.cpf))}</td>
          <td>${escapeHtml((a.tituloProjeto || '').slice(0, 80))}</td>
          <td>${escapeHtml((a.etapa || '').slice(0, 40))}</td>
          <td><a class="btn-secondary" href="/api/appeals/${encodeURIComponent(protocol)}/pdf">Baixar PDF</a></td>
        </tr>
      `;
    }).join('');

    return `
      <!doctype html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Admin - Recursos AVALIA+</title>
        <link rel="stylesheet" href="/theme.css" />
        <style>
          .hint { color: #003366; font-size: 11px; }
          .filters-grid { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 8px; align-items: end; }
          .filters-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; justify-content: center; margin-top: 8px; }
          .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
          @media (max-width: 900px) { .filters-grid { grid-template-columns: 1fr; } }
        </style>
      </head>
      <body>
        <div class="container">
          <header class="main-header">
            <div style="display:flex; align-items:center; justify-content:center; gap:15px;">
              <img src="/img/logo_planter.png" alt="Logo PLANTERR" style="max-height:80px; width:auto;">
              <h1>Administração de Recursos - AVALIA+</h1>
              <img src="/img/logo_avalia_horizontal.png" alt="Logo AVALIA+" style="max-height:80px; width:auto;">
            </div>
          </header>

          <section class="panel">
            <div class="panel-header"><h2>Busca e filtros</h2></div>
            <div class="panel-body">
              <div class="hint">Dica: use a busca por protocolo, nome, email, CPF ou título.</div>
              <div class="admin-actions" style="justify-content:center; margin-top: 8px;">
                <a class="btn-secondary" href="/secret/${this.adminSecret}/admin">Voltar ao Admin</a>
                <a class="btn-secondary" href="/secret/${this.adminSecret}/logout" style="background-color: #d9534f; border-color: #d43f3a;">Sair</a>
              </div>
              <form method="GET" action="/secret/${this.adminSecret}/admin/appeals">
                <div class="filters-grid" style="margin-top: 8px;">
                  <div class="form-group" style="margin-bottom: 0;">
                    <label for="q">Busca</label>
                    <input id="q" name="q" type="text" value="${escapeHtml(q)}" placeholder="Ex.: REC-2025-..." />
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
                  <a class="btn-secondary" href="/secret/${this.adminSecret}/admin/appeals">Limpar Filtros</a>
                </div>
              </form>
            </div>
          </section>

          <section class="panel">
            <div class="panel-header"><h2>Recursos Recebidos (${(appeals || []).length})</h2></div>
            <div class="panel-body" style="overflow-x: auto;">
              <table class="admin-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Protocolo</th>
                    <th>Inscrição</th>
                    <th>Nome</th>
                    <th>Email</th>
                    <th>CPF</th>
                    <th>Título</th>
                    <th>Etapa</th>
                    <th>PDF</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows}
                </tbody>
              </table>
              ${(appeals || []).length === 0 ? '<p style="text-align:center; color:#666; margin-top:10px;">Nenhum recurso encontrado.</p>' : ''}
            </div>
          </section>
        </div>
      </body>
      </html>
    `;
  }

  render(submissions, evaluations, filters) {
    const { q, status, fromStr, toStr, adminStatusOptions, registrationWindow, registrationOpen, editalYear } = filters;
    const evalMap = new Map(evaluations.map(e => [e.protocol, e]));

    const WEIGHTS = { project: 4, interview: 5, language: 1 };
    const MAX = { project: 10, interview: 10, language: 10 };

    const getScoreDisplay = (s) => {
      const sStatus = s.status;
      if (sStatus.toLowerCase() === 'indeferido') return '<span style="color:red; font-weight:bold;">INDEFERIDO</span>';

      const e = evalMap.get(s.protocol);
      if (!e) return '<span style="color:#ccc;">—</span>';

      const proj = Number(e.proj_total || 0);
      const intr = Number(e.int_total || 0);
      const lang = Number(e.lang_total || 0);

      if (proj < 7 || intr < 7 || lang < 7) {
        return '<span style="color:red; font-weight:bold;">REPROVADO (< 7)</span>';
      }

      const projNorm = Math.max(0, Math.min(1, proj / MAX.project));
      const intrNorm = Math.max(0, Math.min(1, intr / MAX.interview));
      const langNorm = Math.max(0, Math.min(1, lang / MAX.language));
      const weighted = (projNorm * WEIGHTS.project) + (intrNorm * WEIGHTS.interview) + (langNorm * WEIGHTS.language);
      return weighted.toFixed(2);
    };

    const rows = submissions.map(s => {
      const scoreDisplay = getScoreDisplay(s);
      return `
        <tr>
          <td>${escapeHtml(new Date(s.createdAt).toLocaleString('pt-BR'))}</td>
          <td><a href="/secret/${this.adminSecret}/admin/submission/${encodeURIComponent(s.protocol)}">${escapeHtml(s.protocol)}</a></td>
          <td>${escapeHtml(s.status)}</td>
          <td>${escapeHtml(s.cpfLast4)}</td>
          <td>${escapeHtml((s.identified?.nome || '').slice(0, 60))}</td>
          <td>${escapeHtml((s.identified?.email || '').slice(0, 60))}</td>
          <td>${scoreDisplay}</td>
        </tr>
      `;
    }).join('');

    const toDateInput = (iso) => {
      if (!iso) return '';
      try { return new Date(iso).toISOString().slice(0,10); } catch { return ''; }
    };
    const startVal = toDateInput(registrationWindow?.startISO);
    const endVal = toDateInput(registrationWindow?.endISO);

    return `
      <!doctype html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Admin - Inscrições AVALIA+</title>
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
              <img src="/img/logo_planter.png" alt="Logo PLANTERR" style="max-height:80px; width:auto;">
              <h1>Administração de Inscrições - AVALIA+</h1>
              <img src="/img/logo_avalia_horizontal.png" alt="Logo AVALIA+" style="max-height:80px; width:auto;">
            </div>
          </header>

          <section class="panel">
            <div class="panel-header"><h2>Calendário de Inscrições</h2></div>
            <div class="panel-body">
              <div style="margin-bottom:10px;">
                <span class="admin-badge" style="background:${registrationOpen ? '#2e7d32' : '#b71c1c'}; color:white;">Status: ${registrationOpen ? 'ABERTO' : 'FECHADO'}</span>
                <span class="admin-badge" id="reg-countdown" data-start-iso="${escapeHtml(String(registrationWindow?.startISO || ''))}" data-end-iso="${escapeHtml(String(registrationWindow?.endISO || ''))}">Cronômetro: —</span>
              </div>
              <div class="admin-actions" style="justify-content:center; margin-top: 10px;">
                <a class="btn-secondary" href="/secret/${this.adminSecret}/admin/edital/${encodeURIComponent(String(editalYear || new Date().getFullYear()))}/calendar/edit">Calendário do Edital (todas as fases)</a>
              </div>
              <p class="hint" style="text-align:center; margin-top: 6px;">Use esta tela para configurar também as janelas de recursos e etapas (projeto/entrevista/língua).</p>
            </div>
          </section>

          <section class="panel">
            <div class="panel-header"><h2>Busca e filtros</h2></div>
            <div class="panel-body">
              <div class="hint">Dica: clique no protocolo para ver detalhes, status e verificação.</div>
              <div class="admin-actions" style="justify-content:center; margin-top: 8px;">
                <a class="btn-secondary" href="/secret/${this.adminSecret}/admin/appeals">Recursos</a>
                <a class="btn-secondary" href="/secret/${this.adminSecret}/committee">Área da Comissão</a>
                <a class="btn-secondary" href="/secret/${this.adminSecret}/committee/results">Ranking / Resultados</a>
                <a class="btn-secondary" href="/secret/${this.adminSecret}/evaluator-links">Credenciais Avaliadores</a>
                <a class="btn-secondary" href="/secret/${this.adminSecret}/logout" style="background-color: #d9534f; border-color: #d43f3a;">Sair</a>
              </div>
              <form method="GET" action="/secret/${this.adminSecret}/admin">
                <div class="filters-grid" style="margin-top: 8px;">
                  <div class="form-group" style="margin-bottom: 0;">
                    <label for="q">Busca (protocolo, nome, email, título)</label>
                    <input id="q" name="q" type="text" value="${escapeHtml(q)}" placeholder="Ex.: PLANTERR-2025..." />
                  </div>
                  <div class="form-group" style="margin-bottom: 0;">
                    <label for="status">Status</label>
                    <select id="status" name="status">
                      ${['Todos', ...adminStatusOptions].map(opt => {
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
                  <a class="btn-secondary" href="/secret/${this.adminSecret}/admin">Limpar Filtros</a>
                  <a class="btn-secondary" href="/secret/${this.adminSecret}/admin/export.csv?${new URLSearchParams({ q, status, from: fromStr, to: toStr }).toString()}">Exportar CSV</a>
                </div>
              </form>
            </div>
          </section>

          <section class="panel">
            <div class="panel-header"><h2>Inscrições Recebidas (${submissions.length})</h2></div>
            <div class="panel-body" style="overflow-x: auto;">
              <table class="admin-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Protocolo</th>
                    <th>Status</th>
                    <th>CPF (Final)</th>
                    <th>Nome</th>
                    <th>Email</th>
                    <th>Nota Final</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows}
                </tbody>
              </table>
              ${submissions.length === 0 ? '<p style="text-align:center; color:#666; margin-top:10px;">Nenhuma inscrição encontrada.</p>' : ''}
            </div>
          </section>
        </div>
      </body>
      <script>
        (function() {
          const el = document.getElementById('reg-countdown');
          if (!el) return;

          const startISO = (el.getAttribute('data-start-iso') || '').trim();
          const endISO = (el.getAttribute('data-end-iso') || '').trim();

          const parse = (s) => {
            if (!s) return null;
            const d = new Date(s);
            return Number.isNaN(d.getTime()) ? null : d;
          };

          const start = parse(startISO);
          const end = parse(endISO);

          const pad2 = (n) => String(n).padStart(2, '0');
          const fmt = (ms) => {
            const total = Math.max(0, Math.floor(ms / 1000));
            const days = Math.floor(total / 86400);
            const hours = Math.floor((total % 86400) / 3600);
            const minutes = Math.floor((total % 3600) / 60);
            const seconds = total % 60;
            if (days > 0) return days + 'd ' + pad2(hours) + ':' + pad2(minutes) + ':' + pad2(seconds);
            return pad2(hours) + ':' + pad2(minutes) + ':' + pad2(seconds);
          };

          const tick = () => {
            const now = new Date();
            if (!start || !end) {
              el.textContent = 'Cronômetro: —';
              return;
            }
            if (now < start) {
              el.textContent = 'Abre em: ' + fmt(start.getTime() - now.getTime());
              return;
            }
            if (now <= end) {
              el.textContent = 'Fecha em: ' + fmt(end.getTime() - now.getTime());
              return;
            }
            el.textContent = 'Encerrado há: ' + fmt(now.getTime() - end.getTime());
          };

          tick();
          setInterval(tick, 1000);
        })();
      </script>
      </html>
    `;
  }
}

module.exports = AdminDashboardPresenter;
