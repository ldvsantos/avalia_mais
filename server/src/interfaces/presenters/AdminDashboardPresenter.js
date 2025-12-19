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

  renderIndex() {
    return `
      <!doctype html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Painel Administrativo - PLANTERR</title>
        <link rel="stylesheet" href="/style.css" />
        <link rel="stylesheet" href="/theme.css" />
        <style>
          .admin-home-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 80vh;
            gap: 40px;
          }
          .admin-cards {
            display: flex;
            gap: 30px;
            flex-wrap: wrap;
            justify-content: center;
          }
          .admin-card {
            background: white;
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 40px;
            width: 300px;
            text-align: center;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            transition: transform 0.2s, box-shadow 0.2s;
            text-decoration: none;
            color: inherit;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 20px;
          }
          .admin-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 8px 12px rgba(0,0,0,0.15);
            border-color: #2e7d32;
          }
          .admin-card h2 {
            margin: 0;
            color: #2e7d32;
            font-size: 1.5rem;
          }
          .admin-card p {
            color: #666;
            margin: 0;
          }
          .admin-card-icon {
            font-size: 48px;
            color: #2e7d32;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <header class="main-header">
            <div style="display:flex; align-items:center; justify-content:center; gap:15px;">
              <img src="/img/logo_planter.png" alt="Logo PLANTERR" style="max-height:80px; width:auto;">
              <h1>Painel Administrativo</h1>
              <img src="/img/logo_uefs.png" alt="Logo UEFS" style="max-height:80px; width:auto;">
            </div>
          </header>

          <div class="admin-home-container">
            <div class="admin-cards">
              <a href="/secret/${this.adminSecret}/admin/selection" class="admin-card">
                <div class="admin-card-icon">📋</div>
                <h2>Processo Seletivo</h2>
                <p>Gerenciar inscrições, avaliações, recursos e resultados do processo seletivo.</p>
              </a>

              <a href="/secret/${this.adminSecret}/admin/events" class="admin-card">
                <div class="admin-card-icon">📅</div>
                <h2>Gestão de Eventos</h2>
                <p>Criar eventos, gerenciar inscrições e emitir certificados.</p>
              </a>
            </div>
            
            <div style="margin-top: 20px;">
               <a href="/secret/${this.adminSecret}/logout" class="btn-secondary">Sair</a>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
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

  renderEventsList(events) {
    const rows = (events || []).map(e => {
      const date = e.date ? new Date(e.date).toLocaleDateString('pt-BR') : '';
      const registrationCount = (e.registrations || []).length;
      return `
        <tr>
          <td>${escapeHtml(e.title)}</td>
          <td>${escapeHtml(date)}</td>
          <td>${escapeHtml(e.location)}</td>
          <td>${escapeHtml(e.workload)}</td>
          <td>${escapeHtml(e.status)}</td>
          <td>${registrationCount}</td>
          <td>
            <a class="btn-secondary" href="/secret/${this.adminSecret}/admin/events/${e.id}/edit">Editar</a>
            <a class="btn-primary" href="/secret/${this.adminSecret}/admin/events/${e.id}/registrations">Inscritos</a>
            <form method="POST" action="/secret/${this.adminSecret}/admin/events/${e.id}/delete" style="display:inline;" onsubmit="return confirm('Tem certeza?');">
              <button class="btn-secondary" style="background-color:#d9534f; border-color:#d43f3a; color:white;" type="submit">Excluir</button>
            </form>
          </td>
        </tr>
      `;
    }).join('');

    return `
      <!doctype html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Admin - Eventos</title>
        <link rel="stylesheet" href="/theme.css" />
      </head>
      <body>
        <div class="container">
          <header class="main-header">
            <div style="display:flex; align-items:center; justify-content:center; gap:15px;">
              <img src="/img/logo_planter.png" alt="Logo PLANTERR" style="max-height:80px; width:auto;">
              <h1>Gestão de Eventos</h1>
              <img src="/img/logo_avalia_horizontal.png" alt="Logo AVALIA+" style="max-height:80px; width:auto;">
            </div>
          </header>
          <section class="panel">
            <div class="panel-header"><h2>Eventos Cadastrados</h2></div>
            <div class="panel-body">
              <div class="admin-actions">
                <a class="btn-primary" href="/secret/${this.adminSecret}/admin/events/new">Novo Evento</a>
                <a class="btn-secondary" href="/secret/${this.adminSecret}/admin">Voltar ao Admin</a>
              </div>
              <table class="admin-table">
                <thead>
                  <tr>
                    <th>Título</th>
                    <th>Data</th>
                    <th>Local</th>
                    <th>Carga Horária</th>
                    <th>Status</th>
                    <th>Inscritos</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>
            </div>
          </section>
        </div>
      </body>
      </html>
    `;
  }

  renderEventForm(event = {}) {
    const isEdit = !!event.id;
    const action = isEdit 
      ? `/secret/${this.adminSecret}/admin/events/${event.id}/edit` 
      : `/secret/${this.adminSecret}/admin/events`;
    
    const activitiesJson = JSON.stringify(event.activities || []);
    
    return `
      <!doctype html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${isEdit ? 'Editar' : 'Novo'} Evento</title>
        <link rel="stylesheet" href="/theme.css" />
        <style>
          .activity-row {
            display: grid;
            grid-template-columns: 1fr 200px 80px;
            gap: 10px;
            margin-bottom: 10px;
            align-items: end;
          }
          .activity-list {
            margin-top: 10px;
            padding: 15px;
            background: #f5f5f5;
            border-radius: 4px;
          }
          .btn-remove {
            background: #dc3545;
            color: white;
            border: none;
            padding: 8px 12px;
            cursor: pointer;
            border-radius: 4px;
          }
          .btn-remove:hover {
            background: #c82333;
          }
          .btn-add-activity {
            background: #28a745;
            color: white;
            border: none;
            padding: 8px 16px;
            cursor: pointer;
            border-radius: 4px;
            margin-top: 10px;
          }
          .btn-add-activity:hover {
            background: #218838;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <header class="main-header">
            <div style="display:flex; align-items:center; justify-content:center; gap:15px;">
              <img src="/img/logo_planter.png" alt="Logo PLANTERR" style="max-height:80px; width:auto;">
              <h1>${isEdit ? 'Editar' : 'Novo'} Evento</h1>
              <img src="/img/logo_avalia_horizontal.png" alt="Logo AVALIA+" style="max-height:80px; width:auto;">
            </div>
          </header>
          
          <div class="admin-actions" style="justify-content:center; margin-bottom:10px;">
            <a class="btn-secondary" href="/secret/${this.adminSecret}/admin/events">← Voltar aos Eventos</a>
          </div>
          
          <section class="panel">
            <div class="panel-body">
              <form method="POST" action="${action}" id="eventForm">
                <div class="form-group">
                  <label>Título</label>
                  <input name="title" value="${escapeHtml(event.title)}" required />
                </div>
                <div class="form-group">
                  <label>Data</label>
                  <input name="date" type="date" value="${escapeHtml(event.date)}" required />
                </div>
                <div class="form-group">
                  <label>Local</label>
                  <input name="location" value="${escapeHtml(event.location)}" />
                </div>
                <div class="form-group">
                  <label>Carga Horária Total</label>
                  <input name="workload" value="${escapeHtml(event.workload)}" placeholder="Ex: 12 hora(s)" />
                  <small style="color:#666; font-size:11px;">Será calculada automaticamente com base nas atividades abaixo</small>
                </div>
                <div class="form-group">
                  <label>Coordenador(a)</label>
                  <input name="coordinator" value="${escapeHtml(event.coordinator)}" placeholder="Ex: Prof. João da Silva" />
                </div>
                <div class="form-group">
                  <label>Departamento/Órgão Promotor</label>
                  <input name="department" value="${escapeHtml(event.department)}" placeholder="Ex: DEPARTAMENTO DE CIÊNCIAS HUMANDAS E FILOSOFIA" />
                </div>
                <div class="form-group">
                  <label>Palestrante(s)/Ministrante(s)</label>
                  <input name="speakers" value="${escapeHtml(event.speakers)}" placeholder="Ex: Dra. Maria Santos, Dr. José Lima" />
                </div>
                <div class="form-group">
                  <label>Função Padrão dos Participantes</label>
                  <input name="participantRole" value="${escapeHtml(event.participantRole)}" placeholder="Ex: PARTICIPANTE, COLABORADOR(A), OUVINTE" />
                  <small style="color:#666; font-size:11px;">Esta será a função padrão no certificado.</small>
                </div>
                <div class="form-group">
                  <label>Status</label>
                  <select name="status">
                    <option value="draft" ${event.status === 'draft' ? 'selected' : ''}>Rascunho</option>
                    <option value="open" ${event.status === 'open' ? 'selected' : ''}>Inscrições Abertas</option>
                    <option value="closed" ${event.status === 'closed' ? 'selected' : ''}>Encerrado</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>Descrição</label>
                  <textarea name="description" rows="5">${escapeHtml(event.description)}</textarea>
                </div>
                
                <div class="form-group">
                  <label>Ementa do Curso</label>
                  <textarea name="syllabus" rows="4" placeholder="Descreva a ementa do curso...">${escapeHtml(event.syllabus)}</textarea>
                  <small style="color:#666; font-size:11px;">Descrição geral do conteúdo programático</small>
                </div>
                
                <div class="form-group">
                  <label>Atividades do Evento</label>
                  <small style="color:#666; font-size:11px; display:block; margin-bottom:10px;">
                    Liste as atividades que farão parte deste evento. Estas aparecerão em uma tabela no certificado.
                  </small>
                  <div id="activitiesList" class="activity-list"></div>
                  <button type="button" class="btn-add-activity" onclick="addActivity()">+ Adicionar Atividade</button>
                  <input type="hidden" name="activities" id="activitiesInput" />
                </div>
                
                <div class="actions">
                  <button class="btn-primary" type="submit">Salvar</button>
                  <a class="btn-secondary" href="/secret/${this.adminSecret}/admin/events">Cancelar</a>
                </div>
              </form>
            </div>
          </section>
        </div>
        
        <script>
          let activities = ${activitiesJson};
          
          function renderActivities() {
            const list = document.getElementById('activitiesList');
            if (activities.length === 0) {
              list.innerHTML = '<p style="color:#999; text-align:center;">Nenhuma atividade cadastrada</p>';
              updateTotalWorkload();
              return;
            }
            
            list.innerHTML = activities.map((act, idx) => \`
              <div class="activity-row">
                <div>
                  <label style="font-size:11px; color:#666;">Atividade</label>
                  <input type="text" value="\${escapeHtml(act.name || '')}" 
                         onchange="updateActivity(\${idx}, 'name', this.value)" 
                         placeholder="Ex: Workshop de Redação de Patentes"
                         style="width:100%; padding:8px;" required />
                </div>
                <div>
                  <label style="font-size:11px; color:#666;">Função</label>
                  <input type="text" value="\${escapeHtml(act.role || 'PARTICIPANTE')}" 
                         onchange="updateActivity(\${idx}, 'role', this.value)" 
                         placeholder="PARTICIPANTE"
                         style="width:100%; padding:8px;" />
                </div>
                <div>
                  <label style="font-size:11px; color:#666;">Carga (h)</label>
                  <input type="number" value="\${act.workload || 0}" 
                         onchange="updateActivity(\${idx}, 'workload', this.value)" 
                         placeholder="0"
                         style="width:100%; padding:8px;" min="0" step="0.5" />
                </div>
                <button type="button" class="btn-remove" onclick="removeActivity(\${idx})">✕</button>
              </div>
            \`).join('');
            
            updateTotalWorkload();
          }
          
          function addActivity() {
            activities.push({ name: '', role: 'PARTICIPANTE', workload: 0 });
            renderActivities();
          }
          
          function removeActivity(idx) {
            activities.splice(idx, 1);
            renderActivities();
          }
          
          function updateActivity(idx, field, value) {
            activities[idx][field] = field === 'workload' ? parseFloat(value) || 0 : value;
            updateTotalWorkload();
          }
          
          function updateTotalWorkload() {
            const total = activities.reduce((sum, act) => sum + (parseFloat(act.workload) || 0), 0);
            const workloadInput = document.querySelector('input[name="workload"]');
            if (workloadInput && total > 0) {
              workloadInput.value = total + ' hora(s)';
            }
          }
          
          function escapeHtml(text) {
            if (!text) return '';
            return String(text)
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&#039;");
          }
          
          document.getElementById('eventForm').addEventListener('submit', function(e) {
            document.getElementById('activitiesInput').value = JSON.stringify(activities);
          });
          
          renderActivities();
        </script>
      </body>
      </html>
    `;
  }

  render(submissions, evaluations, filters) {
    const { q, status, fromStr, toStr, adminStatusOptions, registrationWindow, registrationOpen, editalYear, publicFiles } = filters;
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

    const publicFilesRows = (publicFiles || []).map(f => `
      <tr>
        <td>${escapeHtml(new Date(f.date).toLocaleString('pt-BR'))}</td>
        <td><a href="/results/${escapeHtml(f.filename)}" target="_blank">${escapeHtml(f.title)}</a></td>
        <td>
          <form method="POST" action="/secret/${this.adminSecret}/admin/public-files/delete/${f.id}" onsubmit="return confirm('Tem certeza?');" style="display:inline;">
            <button type="submit" class="btn-secondary" style="background-color:#d9534f; border-color:#d43f3a; padding: 2px 6px; font-size: 0.8em;">Excluir</button>
          </form>
        </td>
      </tr>
    `).join('');

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
            <div class="panel-header"><h2>Gerenciar Publicações e Resultados</h2></div>
            <div class="panel-body">
              <form method="POST" action="/secret/${this.adminSecret}/admin/public-files" enctype="multipart/form-data" style="margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom: 15px;">
                <div class="grid" style="grid-template-columns: 1fr 1fr auto; gap: 10px; align-items: end;">
                  <div class="form-group" style="margin-bottom:0;">
                    <label for="pub_title">Título da Publicação</label>
                    <input type="text" id="pub_title" name="title" placeholder="Ex: Resultado Preliminar..." required />
                  </div>
                  <div class="form-group" style="margin-bottom:0;">
                    <label for="pub_file">Arquivo (PDF)</label>
                    <input type="file" id="pub_file" name="file" accept=".pdf" required />
                  </div>
                  <button type="submit" class="btn-primary">Publicar</button>
                </div>
              </form>

              <table class="admin-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Título / Arquivo</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  ${publicFilesRows.length > 0 ? publicFilesRows : '<tr><td colspan="3" style="text-align:center; color:#666;">Nenhuma publicação encontrada.</td></tr>'}
                </tbody>
              </table>
            </div>
          </section>

          <section class="panel">
            <div class="panel-header"><h2>Busca e filtros</h2></div>
            <div class="panel-body">
              <div class="hint">Dica: clique no protocolo para ver detalhes, status e verificação.</div>
              <div class="admin-actions" style="justify-content:center; margin-top: 8px;">
                <a class="btn-secondary" href="/secret/${this.adminSecret}/admin">Voltar ao Início</a>
                <a class="btn-secondary" href="/secret/${this.adminSecret}/admin/appeals">Recursos</a>
                <a class="btn-secondary" href="/secret/${this.adminSecret}/committee">Área da Comissão</a>
                <a class="btn-secondary" href="/secret/${this.adminSecret}/committee/results">Ranking / Resultados</a>
                <a class="btn-secondary" href="/secret/${this.adminSecret}/evaluator-links">Credenciais Avaliadores</a>
                <a class="btn-secondary" href="/secret/${this.adminSecret}/logout" style="background-color: #d9534f; border-color: #d43f3a;">Sair</a>
              </div>
              <form method="GET" action="/secret/${this.adminSecret}/admin/selection">
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
                  <a class="btn-secondary" href="/secret/${this.adminSecret}/admin/selection">Limpar Filtros</a>
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
