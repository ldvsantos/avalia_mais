function renderAdminNav({ adminSecret, active } = {}) {
  const secret = String(adminSecret || '').trim();

  const base = `/secret/${encodeURIComponent(secret)}`;

  const links = [
    { key: 'home', href: `${base}/admin`, label: 'Início' },
    { key: 'selection', href: `${base}/admin/selection`, label: 'Processo Seletivo' },
    { key: 'appeals', href: `${base}/admin/appeals`, label: 'Recursos' },
    { key: 'events', href: `${base}/admin/events`, label: 'Eventos' },
    { key: 'faq', href: `${base}/admin/faq`, label: 'FAQ / Ajuda' },
    { key: 'committee', href: `${base}/committee`, label: 'Comissão' },
    { key: 'results', href: `${base}/committee/results`, label: 'Ranking / Resultados' },
    { key: 'evaluator-links', href: `${base}/evaluator-links`, label: 'Credenciais Avaliadores' },
  ];

  const activeKey = String(active || '').trim();

  const linkHtml = links
    .map(({ key, href, label }) => {
      const cls = key === activeKey ? 'btn-primary' : 'btn-secondary';
      return `<a class="${cls}" href="${href}">${label}</a>`;
    })
    .join('\n');

  return `
    <style>
      /* Menu hambúrguer no topo-direita (barra do cabeçalho) */
      .container { position: relative; }
      details.admin-menu-float { position: absolute; top: 12px; right: 12px; z-index: 50; }
      details.admin-menu-float > summary { list-style: none; }
      details.admin-menu-float > summary::-webkit-details-marker { display: none; }
      details.admin-menu-float .admin-menu-trigger { display: inline-flex; align-items: center; gap: 6px; }
      details.admin-menu-float .admin-menu-panel { margin-top: 8px; }
      details.admin-menu-float .admin-menu-panel .admin-actions { justify-content: flex-end; }
    </style>
    <details class="admin-menu-float" aria-label="Menu administrativo">
      <summary class="admin-menu-trigger">
        <span class="btn-secondary" aria-label="Abrir menu">\u2630</span>
      </summary>
      <div class="admin-box admin-menu-panel">
        <div class="admin-actions" style="justify-content:flex-end;">
          ${linkHtml}
          <a class="btn-secondary" href="${base}/logout">Sair</a>
        </div>
      </div>
    </details>
  `;
}

module.exports = { renderAdminNav };
