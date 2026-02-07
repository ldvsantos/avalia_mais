function renderAdminNav({ adminSecret, active } = {}) {
  const secret = String(adminSecret || '').trim();
  const base = `/secret/${encodeURIComponent(secret)}`;

  const links = [
    { key: 'home',       href: `${base}/admin`,           label: 'Início',               icon: '🏠' },
    { key: 'selection',  href: `${base}/admin/selection`,  label: 'Processo Seletivo',    icon: '📋' },
    { key: 'appeals',    href: `${base}/admin/appeals`,    label: 'Recursos',             icon: '📝' },
    { key: 'events',     href: `${base}/admin/events`,     label: 'Eventos',              icon: '📅' },
    { key: 'faq',        href: `${base}/admin/faq`,        label: 'FAQ / Ajuda',          icon: '❓' },
    { key: 'committee',  href: `${base}/committee`,        label: 'Comissão',             icon: '👥' },
    { key: 'results',    href: `${base}/committee/results`,label: 'Ranking / Resultados', icon: '🏆' },
    { key: 'evaluator-links', href: `${base}/evaluator-links`, label: 'Credenciais',      icon: '🔑' },
  ];

  const activeKey = String(active || '').trim();

  const navItems = links.map(({ key, href, label, icon }) => {
    const cls = key === activeKey ? 'nav-item active' : 'nav-item';
    return `<a class="${cls}" href="${href}"><span class="nav-icon">${icon}</span>${label}</a>`;
  }).join('\n');

  return `
    <!-- Topbar -->
    <div class="topbar">
      <a class="topbar-logo" href="${base}/admin">
        <img src="/img/logo_avalia_horizontal.png" alt="AVALIA+"
             onerror="this.style.display='none'">
      </a>
      <span class="topbar-title">AVALIA+ Painel Administrativo</span>
      <a class="topbar-logout" href="${base}/logout">Sair</a>
    </div>

    <!-- Mobile menu toggle -->
    <button class="mobile-menu-btn" onclick="document.querySelector('.sidebar').classList.toggle('open')" aria-label="Menu">☰</button>

    <!-- Sidebar -->
    <aside class="sidebar" id="admin-sidebar">
      <nav class="sidebar-nav">
        ${navItems}
        <div class="nav-separator"></div>
        <a class="nav-item" href="${base}/logout"><span class="nav-icon">🚪</span>Sair</a>
      </nav>
    </aside>
  `;
}

/**
 * Wraps page body content in the modern layout shell (topbar + sidebar + main-content).
 * Use this instead of manually writing <body>...</body> in each presenter method.
 */
function renderAdminShell({ adminSecret, active, title, headExtra, bodyContent }) {
  const nav = renderAdminNav({ adminSecret, active });

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title || 'AVALIA+'}</title>
  <link rel="stylesheet" href="/system-modern.css" />
  ${headExtra || ''}
</head>
<body>
  ${nav}
  <div class="main-content">
    <div class="container">
      ${bodyContent}
    </div>
  </div>
  <div class="toast-container" id="toast-container"></div>
  <script>
    // Close sidebar on mobile when clicking a link
    document.querySelectorAll('.sidebar .nav-item').forEach(function(a) {
      a.addEventListener('click', function() {
        if (window.innerWidth <= 900) {
          document.querySelector('.sidebar').classList.remove('open');
        }
      });
    });
  </script>
</body>
</html>`;
}

module.exports = { renderAdminNav, renderAdminShell };

