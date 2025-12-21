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
      details.admin-menu > summary { list-style: none; }
      details.admin-menu > summary::-webkit-details-marker { display: none; }
    </style>
    <details class="admin-box admin-menu" style="margin: 10px 0;" aria-label="Menu administrativo">
      <summary class="admin-actions" style="justify-content:center; cursor:pointer;">
        <span class="btn-secondary">\u2630 Menu</span>
      </summary>
      <div class="admin-actions" style="justify-content:center; margin-top: 8px;">
        ${linkHtml}
        <a class="btn-secondary" href="${base}/logout">Sair</a>
      </div>
    </details>
  `;
}

module.exports = { renderAdminNav };
