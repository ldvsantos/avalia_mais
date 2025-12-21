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

  const toggleId = `admin-menu-toggle-${encodeURIComponent(activeKey || 'default')}`;

  const linkHtml = links
    .map(({ key, href, label }) => {
      const cls = key === activeKey ? 'btn-primary' : 'btn-secondary';
      return `<a class="${cls}" href="${href}" style="display:block; width:100%; text-align:left;">${label}</a>`;
    })
    .join('\n');

  return `
    <style>
      /* Menu dentro da caixa central (container) */
      nav.admin-menu-wrap { position: relative; height: 0; margin: 0; }
      .admin-menu-toggle { position: absolute; left: -9999px; }
      label.admin-menu-btn { position: absolute; left: 12px; top: -64px; z-index: 60; cursor: pointer; }
      label.admin-menu-btn .btn-secondary { display: inline-flex; align-items: center; justify-content: center; }

      /* Drawer lateral */
      .admin-drawer { position: absolute; top: 0; left: -340px; width: 320px; max-width: 85vw; z-index: 70; transition: left 0.2s ease-in-out; }
      .admin-drawer-inner { height: 100%; overflow: auto; padding: 12px; }
      .admin-drawer-header { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 10px; }
      .admin-drawer-links { display: flex; flex-direction: column; gap: 8px; }

      /* Quando aberto */
      .admin-menu-toggle:checked ~ .admin-drawer { left: 0; }

      /* Altura do drawer acompanhando a tela, mas dentro do container */
      .admin-menu-wrap .admin-drawer { height: calc(100vh - 140px); }

      /* Em telas pequenas, evita sobreposição no header e coloca o botão no fluxo */
      @media (max-width: 820px) {
        nav.admin-menu-wrap { height: auto; margin: 10px 0; display: flex; justify-content: flex-end; }
        label.admin-menu-btn { position: static; }
      }
    </style>
    <nav class="admin-menu-wrap" aria-label="Menu administrativo">
      <input class="admin-menu-toggle" type="checkbox" id="${toggleId}" />

      <label class="admin-menu-btn" for="${toggleId}">
        <span class="btn-secondary" aria-label="Abrir menu">\u2630</span>
      </label>

      <aside class="admin-drawer" aria-label="Menu administrativo lateral">
        <div class="admin-box admin-drawer-inner">
          <div class="admin-drawer-header">
            <strong>Menu</strong>
            <label class="btn-secondary" for="${toggleId}" aria-label="Fechar menu">✕</label>
          </div>
          <div class="admin-drawer-links">
            ${linkHtml}
            <a class="btn-secondary" href="${base}/logout" style="display:block; width:100%; text-align:left;">Sair</a>
          </div>
        </div>
      </aside>
    </nav>
  `;
}

module.exports = { renderAdminNav };
