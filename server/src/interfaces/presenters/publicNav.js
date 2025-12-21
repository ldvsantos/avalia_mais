function renderPublicNav({
  items,
  active,
  title,
  ariaLabel,
  toggleIdSuffix,
  buttonOffsetTop,
} = {}) {
  const links = Array.isArray(items) ? items : [];
  const activeKey = String(active || '').trim();

  const safeSuffix = String(toggleIdSuffix || activeKey || 'default')
    .replace(/[^a-zA-Z0-9_-]/g, '-');
  const toggleId = `public-menu-toggle-${safeSuffix}`;

  const menuTitle = title != null ? String(title) : 'Menu';
  const menuAriaLabel = ariaLabel != null ? String(ariaLabel) : 'Menu';

  const top = Number.isFinite(Number(buttonOffsetTop)) ? Number(buttonOffsetTop) : -65;

  const linkHtml = links
    .map(({ key, href, label, target }) => {
      const safeKey = String(key || '').trim();
      const safeHref = String(href || '').trim();
      const safeLabel = String(label || '').trim();
      const isActive = safeKey && safeKey === activeKey;

      const cls = isActive ? 'btn-primary' : 'btn-secondary';
      const extra = target === '_blank' ? ' target="_blank" rel="noopener noreferrer"' : '';

      return `<a class="${cls}" href="${safeHref}"${extra} style="display:block; width:100%; box-sizing:border-box; text-align:left; white-space:normal; overflow-wrap:anywhere;">${safeLabel}</a>`;
    })
    .join('\n');

  return `
    <style>
      nav.public-menu-wrap { position: relative; height: 0; margin: 0; z-index: 60; }
      .public-menu-toggle { position: absolute; left: -9999px; }

      label.public-menu-btn {
        position: absolute;
        right: 10px;
        top: ${top}px;
        z-index: 61;
        cursor: pointer;
      }

      label.public-menu-btn .btn-secondary {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 6px 12px;
        background: rgba(255,255,255,0.9);
      }

      .public-drawer {
        position: absolute;
        top: 0;
        right: 0;
        left: auto;
        width: 280px;
        max-width: 85vw;
        background: white;
        border: 1px solid #ddd;
        box-shadow: 4px 4px 12px rgba(0,0,0,0.15);
        border-radius: 0 0 0 8px;

        opacity: 0;
        visibility: hidden;
        transform: translateX(20px);
        transition: all 0.2s ease-in-out;
        pointer-events: none;
        box-sizing: border-box;
      }

      .public-drawer-inner { padding: 15px; box-sizing: border-box; overflow-x: hidden; }
      .public-drawer-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 10px; }
      .public-drawer-links { display: flex; flex-direction: column; gap: 8px; }

      .public-drawer .btn-primary,
      .public-drawer .btn-secondary {
        max-width: 100%;
        box-sizing: border-box;
        white-space: normal;
        overflow-wrap: anywhere;
        word-break: break-word;
      }

      .public-menu-toggle:checked ~ .public-drawer {
        opacity: 1;
        visibility: visible;
        transform: translateX(0);
        pointer-events: auto;
      }

      @media (max-width: 820px) {
        nav.public-menu-wrap { 
          height: 50px; 
          margin: 0 0 10px 0; 
          background-color: #f8f9fa; 
          border-bottom: 1px solid #dee2e6;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          padding-right: 10px;
        }
        label.public-menu-btn { 
          position: static; 
          margin: 0;
        }
        label.public-menu-btn .btn-secondary { 
          padding: 8px 12px; 
          background: white;
          border: 1px solid #ced4da;
        }
        .public-drawer { 
          position: fixed;
          top: 0; 
          right: 0;
          height: 100vh;
          z-index: 9999; 
          width: 280px; 
          max-width: 85vw; 
          border-radius: 0;
          box-shadow: -2px 0 10px rgba(0,0,0,0.2);
        }
      }

      /* Fallback mínimo quando theme.css não está presente */
      nav.public-menu-wrap a.btn-primary,
      nav.public-menu-wrap a.btn-secondary,
      nav.public-menu-wrap label.btn-secondary,
      nav.public-menu-wrap span.btn-secondary {
        text-decoration: none;
      }

      nav.public-menu-wrap .btn-primary {
        background-color: #003366;
        color: white;
        border: 1px solid #002244;
        padding: 5px 15px;
        font-size: 12px;
        cursor: pointer;
        font-weight: bold;
        font-family: Verdana, Arial, sans-serif;
      }

      nav.public-menu-wrap .btn-secondary {
        background-color: #e9ecef;
        color: #212529;
        border: 1px solid #ced4da;
        padding: 5px 15px;
        font-size: 12px;
        cursor: pointer;
        font-weight: bold;
        font-family: Verdana, Arial, sans-serif;
      }
    </style>

    <nav class="public-menu-wrap" aria-label="${menuAriaLabel}">
      <input class="public-menu-toggle" type="checkbox" id="${toggleId}" />

      <label class="public-menu-btn" for="${toggleId}">
        <span class="btn-secondary" aria-label="Abrir menu">\u2630</span>
      </label>

      <aside class="public-drawer" aria-label="${menuAriaLabel} lateral">
        <div class="public-drawer-inner">
          <div class="public-drawer-header">
            <strong>${menuTitle}</strong>
            <label class="btn-secondary" for="${toggleId}" aria-label="Fechar menu">✕</label>
          </div>
          <div class="public-drawer-links">
            ${linkHtml}
          </div>
        </div>
      </aside>
    </nav>
  `;
}

module.exports = { renderPublicNav };
