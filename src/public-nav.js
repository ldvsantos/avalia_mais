(function () {
  function getActiveKey(pathname) {
    const p = String(pathname || '').toLowerCase();
    if (p === '/' || p.endsWith('/index.html')) return 'home';
    if (p.endsWith('/cursos.html')) return 'cursos';
    if (p.endsWith('/selecao.html')) return 'selecao';
    if (p.endsWith('/inscricao.html')) return 'inscricao';
    if (p.endsWith('/recurso.html')) return 'recurso';
    if (p.endsWith('/suporte.html')) return 'suporte';
    if (p.startsWith('/consulta')) return 'consulta';
    if (p.startsWith('/candidato/')) return 'consulta';
    if (p.startsWith('/eventos/')) return 'cursos';
    return '';
  }

  function renderPublicNav(items, activeKey) {
    const toggleId = 'public-menu-toggle';

    const linksHtml = (items || [])
      .map(function (it) {
        const isActive = it.key && it.key === activeKey;
        const cls = isActive ? 'btn-primary' : 'btn-secondary';
        const extra = it.target === '_blank' ? ' target="_blank" rel="noopener noreferrer"' : '';
        return (
          '<a class="' +
          cls +
          '" href="' +
          it.href +
          '"' +
          extra +
          ' style="display:block; width:100%; box-sizing:border-box; text-align:left; white-space:normal; overflow-wrap:anywhere;">' +
          it.label +
          '</a>'
        );
      })
      .join('\n');

    return (
      '<style>' +
      'nav.public-menu-wrap { position: relative; height: 0; margin: 0; z-index: 60; }' +
      '.public-menu-toggle { position: absolute; left: -9999px; }' +
      'label.public-menu-btn { position: absolute; right: 10px; top: -65px; z-index: 61; cursor: pointer; }' +
      'label.public-menu-btn .btn-secondary { display: inline-flex; align-items: center; justify-content: center; padding: 6px 12px; background: rgba(255,255,255,0.9); }' +
      '.public-drawer { position: absolute; top: 0; right: 0; left: auto; width: 280px; max-width: 85vw; background: white; border: 1px solid #ddd; box-shadow: 4px 4px 12px rgba(0,0,0,0.15); border-radius: 0 0 0 8px; opacity: 0; visibility: hidden; transform: translateX(20px); transition: all 0.2s ease-in-out; pointer-events: none; box-sizing: border-box; }' +
      '.public-drawer-inner { padding: 15px; box-sizing: border-box; overflow-x: hidden; }' +
      '.public-drawer-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 10px; }' +
      '.public-drawer-links { display: flex; flex-direction: column; gap: 8px; }' +
      '.public-drawer .btn-primary, .public-drawer .btn-secondary { max-width: 100%; box-sizing: border-box; white-space: normal; overflow-wrap: anywhere; word-break: break-word; }' +
      '.public-menu-toggle:checked ~ .public-drawer { opacity: 1; visibility: visible; transform: translateX(0); pointer-events: auto; }' +
      '@media (max-width: 820px) { nav.public-menu-wrap { height: auto; margin: 10px 0; display: flex; justify-content: flex-end; } label.public-menu-btn { position: static; display: inline-block; margin-bottom: 0; } .public-drawer { top: 10px; z-index: 100; } }' +
      '</style>' +
      '<nav class="public-menu-wrap" aria-label="Menu">' +
      '<input class="public-menu-toggle" type="checkbox" id="' +
      toggleId +
      '" />' +
      '<label class="public-menu-btn" for="' +
      toggleId +
      '"><span class="btn-secondary" aria-label="Abrir menu">☰</span></label>' +
      '<aside class="public-drawer" aria-label="Menu lateral">' +
      '<div class="public-drawer-inner">' +
      '<div class="public-drawer-header"><strong>Menu</strong><label class="btn-secondary" for="' +
      toggleId +
      '" aria-label="Fechar menu">✕</label></div>' +
      '<div class="public-drawer-links">' +
      linksHtml +
      '</div>' +
      '</div>' +
      '</aside>' +
      '</nav>'
    );
  }

  function init() {
    var container = document.querySelector('.container');
    if (!container) return;

    var header = container.querySelector('.main-header');
    if (!header) return;

    if (container.querySelector('nav.public-menu-wrap')) return;

    var activeKey = getActiveKey(window.location.pathname);

    var items = [
      { key: 'home', href: '/', label: 'Início' },
      { key: 'cursos', href: 'cursos.html', label: 'Cursos e eventos' },
      { key: 'selecao', href: 'selecao.html', label: 'Processo seletivo' },
      { key: 'inscricao', href: 'inscricao.html', label: 'Inscrição' },
      { key: 'consulta', href: '/consulta', label: 'Consulta / Portal do candidato' },
      { key: 'recurso', href: 'recurso.html', label: 'Recurso' },
      { key: 'suporte', href: 'suporte.html', label: 'Ajuda / FAQ' },
    ];

    var wrap = document.createElement('div');
    wrap.innerHTML = renderPublicNav(items, activeKey);

    header.insertAdjacentElement('afterend', wrap.firstChild);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
