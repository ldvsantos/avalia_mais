const escapeHtml = (unsafe) => {
  return String(unsafe || '')
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

const { renderAdminNav } = require('./adminNav');

class AdminDashboardPresenter {
  constructor(adminSecret) {
    this.adminSecret = adminSecret;
  }

  renderAllocationResult(data) {
    const v1 = data.linha1?.total || 0;
    const v2 = data.linha2?.total || 0;

    const renderLineSection = (title, lineData) => {
        if (!lineData || !lineData.resultado) return `<section class="panel"><div class="panel-header"><h2>${title}</h2></div><div class="panel-body"><p>Sem dados para esta linha.</p></div></section>`;

        const { resultado, total, allocator } = lineData;
        const { quadro_vagas_calculado, aprovados, lista_espera } = resultado;
        const vagasExtras = allocator.vagasExtras || {};

        const getRowClass = (c) => {
            const sit = (c.situacao || '').toLowerCase();
            const grp = (c.grupo_concorrencia || '').toLowerCase();
            
            if (sit.includes('ampla')) return 'row-ampla';
            if (sit.includes('negros')) return 'row-negro';
            if (sit.includes('uefs')) return 'row-uefs';
            if (sit.includes('sdr')) return 'row-sdr';
            if (sit.includes('pcd') || sit.includes('indígena') || sit.includes('trans')) return 'row-demais';
            
            if (grp.includes('uefs')) return 'row-uefs';
            if (grp.includes('sdr')) return 'row-sdr';
            if (grp.includes('afirmativa')) return 'row-negro';
            if (grp.includes('pcd')) return 'row-demais';
            
            return '';
        };

        const aprovadosRows = aprovados.map((c, i) => `
          <tr class="${getRowClass(c)}">
            <td>${i + 1}º</td>
            <td>${escapeHtml(c.nome)}</td>
            <td>${c.nota.toFixed(2)}</td>
            <td>${escapeHtml(c.grupo_concorrencia || '-')}</td>
            <td>${escapeHtml(c.situacao)}</td>
          </tr>
        `).join('');

        const esperaRows = lista_espera.map((c, i) => `
          <tr>
            <td>${i + 1}º</td>
            <td>${escapeHtml(c.nome)}</td>
            <td>${c.nota.toFixed(2)}</td>
            <td>${escapeHtml(c.grupo_concorrencia || '-')}</td>
            <td>${escapeHtml(c.situacao)}</td>
          </tr>
        `).join('');

        return `
          <section class="panel" style="margin-bottom: 40px; border-top: 5px solid #2e7d32;">
            <div class="panel-header"><h2>${title}</h2></div>
            <div class="panel-body">
              <div class="summary-box">
                <p><strong>Total de Vagas:</strong> ${total}</p>
                <p><strong>Vagas Extras (Institucionais):</strong> ${
                  Object.entries(vagasExtras).map(([k, v]) => `${v} (${k.replace('_', ' ')})`).join(', ') || 'Nenhuma'
                }</p>
              </div>
              
              <div class="summary-grid">
                <div class="summary-item">
                  <small>Ampla Concorrência</small>
                  <strong>${quadro_vagas_calculado.AC}</strong>
                </div>
                <div class="summary-item">
                  <small>Cotas (Negros)</small>
                  <strong>${quadro_vagas_calculado.Cotas_Negros}</strong>
                </div>
                <div class="summary-item">
                  <small>Cotas (Demais)</small>
                  <strong>${quadro_vagas_calculado.Cotas_Demais}</strong>
                </div>
                <div class="summary-item">
                  <small>Institucionais</small>
                  <strong>${
                    Object.entries(quadro_vagas_calculado.Institucional || {}).map(([k, v]) => `${v} (${k.replace('_', ' ')})`).join(', ') || '0'
                  }</strong>
                </div>
              </div>

              <h3 style="margin-top: 20px;">Candidatos Aprovados (${aprovados.length})</h3>
              <table class="admin-table">
                <thead>
                  <tr>
                    <th>Classificação</th>
                    <th>Nome</th>
                    <th>Nota</th>
                    <th>Grupo</th>
                    <th>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  ${aprovadosRows}
                </tbody>
              </table>

              <h3 style="margin-top: 20px;">Lista de Espera (${lista_espera.length})</h3>
              <table class="admin-table">
                <thead>
                  <tr>
                    <th>Classificação</th>
                    <th>Nome</th>
                    <th>Nota</th>
                    <th>Grupo</th>
                    <th>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  ${esperaRows}
                </tbody>
              </table>
            </div>
          </section>
        `;
    };

    return `
      <!doctype html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>Resultado da Alocação</title>
        <link rel="stylesheet" href="/theme.css" />
        <style>
          .summary-box { background: #f8f9fa; padding: 15px; border-radius: 4px; margin-bottom: 20px; border: 1px solid #ddd; }
          .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
          .summary-item { background: white; padding: 10px; border: 1px solid #eee; border-radius: 4px; text-align: center; }
          .summary-item strong { display: block; font-size: 1.2em; color: #2e7d32; }
          
          .row-ampla { background-color: #fff3cd; }
          .row-negro { background-color: #d4edda; }
          .row-uefs { background-color: #cce5ff; }
          .row-sdr { background-color: #ffffcc; }
          .row-demais { background-color: #e2e3e5; }
          
          .admin-table th { background-color: #004d40; color: white; }
        </style>
      </head>
      <body>
        <div class="container">
          <header class="main-header">
            <h1>Resultado da Alocação de Vagas</h1>
            <div style="text-align: center; margin-top: 15px;">
              <a href="/secret/${this.adminSecret}/admin/allocation/pdf?v1=${v1}&v2=${v2}" class="btn btn-primary" target="_blank" style="background-color: #2e7d32; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">Baixar Relatório PDF (Assinado)</a>
            </div>
          </header>

          <div style="margin-bottom: 20px; padding: 15px; background-color: #f8f9fa; border-left: 4px solid #2e7d32; border-radius: 4px;">
            <h3 style="margin-top: 0; color: #2e7d32; font-size: 1.1em;">Nota Oficial da Coordenação</h3>
            <p style="color: #333; font-size: 0.95em; line-height: 1.5; text-align: justify;">
              A Coordenação do Processo Seletivo torna pública a lista final de candidatos aprovados e classificados, após a aplicação dos critérios de alocação de vagas definidos em edital. A distribuição das vagas seguiu rigorosamente a ordem de classificação (nota final decrescente), respeitando primeiramente a ampla concorrência e, em seguida, aplicando as reservas de vagas (cotas raciais, vagas institucionais e demais grupos) conforme a disponibilidade e a legislação vigente. Em casos de empate, foram utilizados os critérios de desempate previstos. As vagas não preenchidas em grupos específicos foram revertidas para a ampla concorrência, garantindo o máximo aproveitamento das vagas ofertadas.
            </p>
            
            <h4 style="margin-top: 15px; color: #2e7d32; font-size: 1em;">Memória de Cálculo (Regras Aplicadas)</h4>
            <ul style="margin-bottom: 0; padding-left: 20px; color: #555; font-size: 0.95em;">
              <li><strong>Divisão Base:</strong> 50% Ampla Concorrência / 50% Cotas (Resolução CONSEPE 088/2021).</li>
              <li><strong>Subdivisão de Cotas:</strong> 70% para Negros (Pretos/Pardos) e 30% para Demais Grupos.</li>
              <li><strong>Vagas Institucionais (Deduzidas da Ampla):</strong> 20% Termo SDR e 20% Servidor UEFS.</li>
              <li><strong>Arredondamento:</strong> Frações ≥ 0.5 arredondam para cima.</li>
              <li><strong>Proteção da Ampla (Pequenos Quantitativos):</strong> Em editais com poucas vagas (ex: 3 a 5), o sistema garante no mínimo 1 vaga para Ampla Concorrência e ajusta as Cotas se necessário.</li>
              <li><strong>Reversão:</strong> Vagas de cotas ou institucionais não preenchidas são revertidas para Ampla Concorrência.</li>
            </ul>
          </div>

          ${renderLineSection('Linha de Pesquisa 1', data.linha1)}
          ${renderLineSection('Linha de Pesquisa 2', data.linha2)}

        </div>
      </body>
      </html>
    `;
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
              <a href="/secret/${this.adminSecret}/admin" aria-label="Voltar ao painel administrativo" style="display:inline-block;">
                <img src="/img/logo_planter.png" alt="Logo PLANTERR" style="max-height:80px; width:auto;">
              </a>
              <h1>Painel Administrativo</h1>
              <img src="/img/logo_avalia_horizontal.png" alt="Logo AVALIA+" style="max-height:80px; width:auto;">
            </div>
          </header>

          ${renderAdminNav({ adminSecret: this.adminSecret, active: 'home' })}

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

              <a href="/secret/${this.adminSecret}/admin/faq" class="admin-card">
                <div class="admin-card-icon">❓</div>
                <h2>FAQ / Ajuda</h2>
                <p>Atualizar textos de Ajuda e Perguntas Frequentes sem mexer no código.</p>
              </a>
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
              <a href="/secret/${this.adminSecret}/admin" aria-label="Voltar ao painel administrativo" style="display:inline-block;">
                <img src="/img/logo_planter.png" alt="Logo PLANTERR" style="max-height:80px; width:auto;">
              </a>
              <h1>Administração de Recursos - AVALIA+</h1>
              <img src="/img/logo_avalia_horizontal.png" alt="Logo AVALIA+" style="max-height:80px; width:auto;">
            </div>
          </header>

          ${renderAdminNav({ adminSecret: this.adminSecret, active: 'appeals' })}

          <section class="panel">
            <div class="panel-header"><h2>Busca e filtros</h2></div>
            <div class="panel-body">
              <div class="hint">Dica: use a busca por protocolo, nome, email, CPF ou título.</div>
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
      const publicUrl = `/eventos/${e.id}`;
      return `
        <tr>
          <td>${escapeHtml(e.title)}</td>
          <td>${escapeHtml(date)}</td>
          <td>${escapeHtml(e.location)}</td>
          <td>${escapeHtml(e.workload)}</td>
          <td>${escapeHtml(e.status)}</td>
          <td>${registrationCount}</td>
          <td>
            <a class="btn-secondary" href="${publicUrl}" target="_blank" rel="noopener noreferrer">Link público</a>
            <a class="btn-secondary" href="/secret/${this.adminSecret}/admin/events/${e.id}/edit">Editar</a>
            <a class="btn-primary" href="/secret/${this.adminSecret}/admin/events/${e.id}/registrations">Inscritos</a>
            <form method="POST" action="/secret/${this.adminSecret}/admin/events/${e.id}/delete" style="display:inline;" data-confirm="delete-event">
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
              <a href="/secret/${this.adminSecret}/admin" aria-label="Voltar ao painel administrativo" style="display:inline-block;">
                <img src="/img/logo_planter.png" alt="Logo PLANTERR" style="max-height:80px; width:auto;">
              </a>
              <h1>Gestão de Eventos</h1>
              <img src="/img/logo_avalia_horizontal.png" alt="Logo AVALIA+" style="max-height:80px; width:auto;">
            </div>
          </header>

          ${renderAdminNav({ adminSecret: this.adminSecret, active: 'events' })}
          <section class="panel">
            <div class="panel-header"><h2>Eventos Cadastrados</h2></div>
            <div class="panel-body">
              <div class="admin-actions">
                <a class="btn-primary" href="/secret/${this.adminSecret}/admin/events/new">Novo Evento</a>
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

        <script src="/admin-events-confirm.js"></script>
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
              <a href="/secret/${this.adminSecret}/admin" aria-label="Voltar ao painel administrativo" style="display:inline-block;">
                <img src="/img/logo_planter.png" alt="Logo PLANTERR" style="max-height:80px; width:auto;">
              </a>
              <h1>${isEdit ? 'Editar' : 'Novo'} Evento</h1>
              <img src="/img/logo_avalia_horizontal.png" alt="Logo AVALIA+" style="max-height:80px; width:auto;">
            </div>
          </header>

          ${renderAdminNav({ adminSecret: this.adminSecret, active: 'events' })}
          
          <section class="panel">
            <div class="panel-body">
              <form method="POST" action="${action}" id="eventForm" enctype="multipart/form-data">
                <div class="form-group">
                  <label>Imagem de Capa (Estilo Instagram 3:4)</label>
                  ${event.imageFilename ? `<div style="margin-bottom:10px;"><img src="/img/events/${event.imageFilename}" style="max-width:150px; border-radius:4px; border:1px solid #ddd;"></div>` : ''}
                  <input type="file" name="image" accept="image/*" />
                  <small style="color:#666; font-size:11px;">Recomendado: Proporção 3:4 (ex: 1080x1440px)</small>
                </div>
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
                  <button type="button" class="btn-add-activity" id="addActivityBtn">+ Adicionar Atividade</button>
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
          // CSP do servidor bloqueia handlers inline (onclick/onchange) via: script-src-attr 'none'.
          // Portanto, todos os eventos são ligados via addEventListener.

          // Garantir que activities seja um array
          let activities = [];
          try {
            activities = ${activitiesJson};
            if (!Array.isArray(activities)) activities = [];
          } catch (e) {
            console.error('Erro ao carregar atividades:', e);
            activities = [];
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

          function updateTotalWorkload() {
            const total = activities.reduce((sum, act) => sum + (parseFloat(act.workload) || 0), 0);
            const workloadInput = document.querySelector('input[name="workload"]');
            if (workloadInput && total > 0) {
              workloadInput.value = total + ' hora(s)';
            }
          }

          function renderActivities() {
            const list = document.getElementById('activitiesList');
            if (!list) return;

            if (activities.length === 0) {
              list.innerHTML = '<p style="color:#999; text-align:center;">Nenhuma atividade cadastrada</p>';
              updateTotalWorkload();
              return;
            }

            // IMPORTANTÍSSIMO: não usar crases (acento grave) aqui, porque este script está
            // dentro de um template string do Node (AdminDashboardPresenter).
            // Crases não escapadas quebram o JS do servidor e derrubam o app.
            list.innerHTML = activities.map((act, idx) => {
              const name = escapeHtml(act.name || '');
              const role = escapeHtml(act.role || 'PARTICIPANTE');
              const workload = Number(act.workload || 0);

              return '' +
                '<div class="activity-row" data-idx="' + idx + '">' +
                  '<div>' +
                    '<label style="font-size:11px; color:#666;">Atividade</label>' +
                    '<input type="text" data-idx="' + idx + '" data-field="name" value="' + name + '" ' +
                           'placeholder="Ex: Workshop de Redação de Patentes" ' +
                           'style="width:100%; padding:8px;" required />' +
                  '</div>' +
                  '<div>' +
                    '<label style="font-size:11px; color:#666;">Função</label>' +
                    '<input type="text" data-idx="' + idx + '" data-field="role" value="' + role + '" ' +
                           'placeholder="PARTICIPANTE" ' +
                           'style="width:100%; padding:8px;" />' +
                  '</div>' +
                  '<div>' +
                    '<label style="font-size:11px; color:#666;">Carga (h)</label>' +
                    '<input type="number" data-idx="' + idx + '" data-field="workload" value="' + workload + '" ' +
                           'placeholder="0" ' +
                           'style="width:100%; padding:8px;" min="0" step="0.5" />' +
                  '</div>' +
                  '<button type="button" class="btn-remove" data-action="remove" data-idx="' + idx + '">✕</button>' +
                '</div>';
            }).join('');

            updateTotalWorkload();
          }

          function addActivity() {
            activities.push({ name: '', role: 'PARTICIPANTE', workload: 0 });
            renderActivities();
          }

          function removeActivity(idx) {
            if (!Number.isFinite(idx)) return;
            activities.splice(idx, 1);
            renderActivities();
          }

          function bindActivityEvents() {
            const list = document.getElementById('activitiesList');
            const addBtn = document.getElementById('addActivityBtn');
            const form = document.getElementById('eventForm');

            if (addBtn) {
              addBtn.addEventListener('click', (e) => {
                e.preventDefault();
                addActivity();
              });
            }

            if (list) {
              // Delegação: remove
              list.addEventListener('click', (e) => {
                const btn = e.target && e.target.closest ? e.target.closest('button[data-action="remove"]') : null;
                if (!btn) return;
                const idx = Number(btn.getAttribute('data-idx'));
                removeActivity(idx);
              });

              // Delegação: edição dos campos
              const onFieldEdit = (e) => {
                const target = e.target;
                if (!target || target.tagName !== 'INPUT') return;
                const idxStr = target.getAttribute('data-idx');
                const field = target.getAttribute('data-field');
                if (idxStr == null || !field) return;

                const idx = Number(idxStr);
                if (!Number.isFinite(idx) || !activities[idx]) return;

                const value = target.value;
                activities[idx][field] = field === 'workload' ? (parseFloat(value) || 0) : value;
                updateTotalWorkload();
              };
              list.addEventListener('input', onFieldEdit);
              list.addEventListener('change', onFieldEdit);
            }

            if (form) {
              form.addEventListener('submit', () => {
                const hidden = document.getElementById('activitiesInput');
                if (hidden) hidden.value = JSON.stringify(activities);
              });
            }
          }

          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
              bindActivityEvents();
              renderActivities();
            });
          } else {
            bindActivityEvents();
            renderActivities();
          }
        </script>
      </body>
      </html>
    `;
  }

  render(submissions, evaluations, filters) {
    const { q, status, fromStr, toStr, adminStatusOptions, registrationWindow, registrationOpen, editalYear, activeEditalYear, publicFiles } = filters;
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
          .filters-grid { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 0.8fr; gap: 8px; align-items: end; }
          .filters-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; justify-content: center; margin-top: 8px; }
          .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
          @media (max-width: 900px) { .filters-grid { grid-template-columns: 1fr; } }
        </style>
      </head>
      <body>
        <div class="container">
          <header class="main-header">
            <div style="display:flex; align-items:center; justify-content:center; gap:15px;">
              <a href="/secret/${this.adminSecret}/admin" aria-label="Voltar ao painel administrativo" style="display:inline-block;">
                <img src="/img/logo_planter.png" alt="Logo PLANTERR" style="max-height:80px; width:auto;">
              </a>
              <h1>Administração de Inscrições - AVALIA+</h1>
              <img src="/img/logo_avalia_horizontal.png" alt="Logo AVALIA+" style="max-height:80px; width:auto;">
            </div>
          </header>

          ${renderAdminNav({ adminSecret: this.adminSecret, active: 'selection' })}

          <section class="panel">
            <div class="panel-header"><h2>Ações Rápidas</h2></div>
            <div class="panel-body">
              <div class="admin-actions" style="justify-content:center; gap:10px; flex-wrap:wrap;">
                <a class="btn-secondary" href="/secret/${this.adminSecret}/evaluator-links">Credenciais Avaliadores</a>
                <a class="btn-secondary" href="/secret/${this.adminSecret}/committee">Área da Comissão</a>
                <a class="btn-secondary" href="/secret/${this.adminSecret}/committee/results">Ranking / Resultados</a>
                <a class="btn-secondary" href="/secret/${this.adminSecret}/admin/appeals">Gerenciar Recursos</a>
              </div>
            </div>
          </section>

          <section class="panel">
            <div class="panel-header"><h2>Calendário de Inscrições</h2></div>
            <div class="panel-body">
              <div style="margin-bottom:10px;">
                <span class="admin-badge" style="background:${registrationOpen ? '#2e7d32' : '#b71c1c'}; color:white;">Status: ${registrationOpen ? 'ABERTO' : 'FECHADO'}</span>
                <span class="admin-badge" id="reg-countdown" data-start-iso="${escapeHtml(String(registrationWindow?.startISO || ''))}" data-end-iso="${escapeHtml(String(registrationWindow?.endISO || ''))}">Cronômetro: —</span>
              </div>
              <div style="display:flex; flex-wrap:wrap; gap:10px; align-items:center; justify-content:center; margin-top: 8px;">
                <span class="admin-badge" style="background:#0b4b86; color:white;">Ano ativo: ${escapeHtml(String(activeEditalYear ?? '—'))}</span>
                <span class="admin-badge" style="background:#6b7280; color:white;">Visualizando: ${escapeHtml(String(editalYear ?? '—'))}</span>
              </div>
              <form method="POST" action="/secret/${this.adminSecret}/admin/active-year" style="margin-top: 10px; display:flex; gap:8px; justify-content:center; align-items:end; flex-wrap:wrap;">
                <div class="form-group" style="margin-bottom: 0; max-width: 200px;">
                  <label for="activeYear">Definir ano ativo</label>
                  <input id="activeYear" name="year" type="number" min="2000" max="2100" value="${escapeHtml(String(activeEditalYear ?? editalYear ?? ''))}" required />
                </div>
                <button type="submit" class="btn-primary">Salvar</button>
              </form>
              <div class="admin-actions" style="justify-content:center; margin-top: 10px;">
                <a class="btn-secondary" href="/secret/${this.adminSecret}/admin/edital/${encodeURIComponent(String(editalYear ?? activeEditalYear ?? ''))}/calendar/edit">Calendário do Edital (todas as fases)</a>
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
                  <div class="form-group" style="margin-bottom: 0;">
                    <label for="year">Ano</label>
                    <input id="year" name="year" type="number" min="2000" max="2100" value="${escapeHtml(String(editalYear ?? activeEditalYear ?? ''))}" />
                  </div>
                </div>
                <div class="filters-actions">
                  <button class="btn-primary" type="submit">Filtrar</button>
                  <a class="btn-secondary" href="/secret/${this.adminSecret}/admin/selection?${new URLSearchParams({ year: String(editalYear ?? activeEditalYear ?? '') }).toString()}">Limpar Filtros</a>
                  <a class="btn-secondary" href="/secret/${this.adminSecret}/admin/export.csv?${new URLSearchParams({ q, status, from: fromStr, to: toStr, year: String(editalYear ?? activeEditalYear ?? '') }).toString()}">Exportar CSV</a>
                </div>
              </form>
            </div>
          </section>

          <section class="panel">            <div class="panel-header"><h2>Alocação de Vagas (Resolução 088/2021)</h2></div>
            <div class="panel-body">
              <form method="POST" action="/secret/${this.adminSecret}/admin/selection/allocate" target="_blank">
                <div style="display: flex; gap: 15px; align-items: flex-end; flex-wrap: wrap;">
                  <div class="form-group" style="margin-bottom: 0;">
                    <label>Vagas Linha 1</label>
                    <input type="number" name="vagasLinha1" required min="1" value="5" style="width: 120px;" />
                  </div>
                  <div class="form-group" style="margin-bottom: 0;">
                    <label>Vagas Linha 2</label>
                    <input type="number" name="vagasLinha2" required min="1" value="5" style="width: 120px;" />
                  </div>
                  
                  <div class="filters-actions" style="margin-top:0; justify-content:flex-start;">
                    <button class="btn-primary" type="submit">Calcular Alocação</button>
                  </div>
                </div>
              </form>
            </div>
          </section>

          <section class="panel">            <div class="panel-header"><h2>Inscrições Recebidas (${submissions.length})</h2></div>
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
