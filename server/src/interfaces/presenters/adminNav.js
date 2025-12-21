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
      /* Menu hambúrguer alinhado ao cabeçalho (topo-direita) */
      nav.admin-menu-wrap { position: relative; height: 0; margin: 0; }
      details.admin-menu-float { position: absolute; right: 12px; top: -64px; z-index: 50; }
      details.admin-menu-float > summary { list-style: none; }
      details.admin-menu-float > summary::-webkit-details-marker { display: none; }
      details.admin-menu-float .admin-menu-trigger { display: inline-flex; align-items: center; }
      details.admin-menu-float .admin-menu-panel { margin-top: 8px; }
      details.admin-menu-float .admin-menu-panel .admin-actions { justify-content: flex-end; }

      /* Em telas pequenas, evita sobreposição no header e coloca abaixo */
      @media (max-width: 820px) {
        nav.admin-menu-wrap { height: auto; margin: 10px 0; display: flex; justify-content: flex-end; }
        details.admin-menu-float { position: static; }
        details.admin-menu-float .admin-menu-panel .admin-actions { justify-content: center; }
      }
    </style>
    <nav class="admin-menu-wrap" aria-label="Menu administrativo">
      <details class="admin-menu-float">
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
    </nav>
  `;
}

module.exports = { renderAdminNav };
