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
      return `<a class="${cls}" href="${href}" style="display:block; width:100%; box-sizing:border-box; text-align:left; white-space:normal; overflow-wrap:anywhere;">${label}</a>`;
    })
    .join('\n');

  return `
    <style>
      /* Menu dentro da caixa central (container) */
      nav.admin-menu-wrap { position: relative; height: 0; margin: 0; z-index: 60; }
      .admin-menu-toggle { position: absolute; left: -9999px; }
      
      /* Botão do menu (hambúrguer) */
      label.admin-menu-btn { 
        position: absolute; 
        left: 10px; 
        top: -65px; /* Sobe para ficar na linha do header */
        z-index: 61; 
        cursor: pointer; 
      }
      label.admin-menu-btn .btn-secondary { display: inline-flex; align-items: center; justify-content: center; padding: 6px 12px; background: rgba(255,255,255,0.9); }

      /* Drawer lateral */
      .admin-drawer { 
        position: absolute; 
        top: 0; 
        left: 0; 
        width: 280px; 
        max-width: 85vw; 
        background: white;
        border: 1px solid #ddd;
        box-shadow: 4px 4px 12px rgba(0,0,0,0.15);
        border-radius: 0 0 8px 0;
        
        /* Estado Fechado: invisível e levemente deslocado */
        opacity: 0;
        visibility: hidden;
        transform: translateX(-20px);
        transition: all 0.2s ease-in-out;
        pointer-events: none;
        box-sizing: border-box;
      }
      
      .admin-drawer-inner { padding: 15px; box-sizing: border-box; overflow-x: hidden; }
      .admin-drawer-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 10px; }
      .admin-drawer-links { display: flex; flex-direction: column; gap: 8px; }

      /* Garante que botões dentro do drawer não ultrapassem a largura */
      .admin-drawer .btn-primary,
      .admin-drawer .btn-secondary {
        max-width: 100%;
        box-sizing: border-box;
        white-space: normal;
        overflow-wrap: anywhere;
        word-break: break-word;
      }

      /* Estado Aberto */
      .admin-menu-toggle:checked ~ .admin-drawer { 
        opacity: 1;
        visibility: visible;
        transform: translateX(0);
        pointer-events: auto;
      }

      /* Em telas pequenas */
      @media (max-width: 820px) {
        nav.admin-menu-wrap { height: auto; margin: 10px 0; }
        label.admin-menu-btn { position: static; display: inline-block; margin-bottom: 0; }
        .admin-drawer { top: 10px; z-index: 100; }
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
            <a class="btn-secondary" href="${base}/logout" style="display:block; width:100%; box-sizing:border-box; text-align:left; white-space:normal; overflow-wrap:anywhere;">Sair</a>
          </div>
        </div>
      </aside>
    </nav>
  `;
}

module.exports = { renderAdminNav };
