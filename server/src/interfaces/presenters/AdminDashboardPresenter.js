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

  render(submissions, evaluations, filters) {
    const { q, status, fromStr, toStr, adminStatusOptions, registrationWindow, registrationOpen } = filters;
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
                <span class="admin-badge">Início: ${startVal || '—'}</span>
                <span class="admin-badge">Fim: ${endVal || '—'}</span>
              </div>
              <form method="POST" action="/secret/${this.adminSecret}/admin/registration-window">
                <div class="filters-grid" style="margin-top: 8px; grid-template-columns: 1fr 1fr;">
                  <div class="form-group" style="margin-bottom:0;">
                    <label for="start">Início das inscrições</label>
                    <input id="start" name="start" type="date" value="${startVal}" />
                  </div>
                  <div class="form-group" style="margin-bottom:0;">
                    <label for="end">Fim das inscrições</label>
                    <input id="end" name="end" type="date" value="${endVal}" />
                  </div>
                </div>
                <div class="filters-actions">
                  <button class="btn-primary" type="submit">Salvar Calendário</button>
                  <a class="btn-secondary" href="/secret/${this.adminSecret}/admin">Atualizar</a>
                </div>
                <p class="hint">Deixe vazio para início/fim sem restrição. Quando definido, o sistema bloqueia novas inscrições fora do período.</p>
              </form>
            </div>
          </section>

          <section class="panel">
            <div class="panel-header"><h2>Busca e filtros</h2></div>
            <div class="panel-body">
              <div class="hint">Dica: clique no protocolo para ver detalhes, status e verificação.</div>
              <div class="admin-actions" style="justify-content:center; margin-top: 8px;">
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
      </html>
    `;
  }
}

module.exports = AdminDashboardPresenter;
