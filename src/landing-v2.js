(() => {
  'use strict';

  /* ── Smooth scroll ── */
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      const t = document.querySelector(a.getAttribute('href'));
      if (t) window.scrollTo({ top: t.offsetTop - 72, behavior: 'smooth' });
      // close mobile menu
      document.getElementById('navMenu')?.classList.remove('open');
    });
  });

  /* ── Navbar scroll ── */
  const nav = document.getElementById('navbar');
  const onScroll = () => nav.classList.toggle('scrolled', scrollY > 50);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ── Mobile toggle ── */
  document.getElementById('navToggle')?.addEventListener('click', () => {
    document.getElementById('navMenu').classList.toggle('open');
  });

  /* ── Reveal on scroll ── */
  const io = new IntersectionObserver(
    entries => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
    }),
    { threshold: 0.08, rootMargin: '0px 0px -30px 0px' }
  );
  document.querySelectorAll('.rv').forEach(el => io.observe(el));

  /* ── Metric counter animation ── */
  const animateMetrics = () => {
    document.querySelectorAll('.metric').forEach(m => {
      const target = parseInt(m.dataset.target, 10);
      const prefix = m.dataset.prefix || '';
      const suffix = m.dataset.suffix || '';
      const el = m.querySelector('.metric-value');
      if (!el || m.dataset.done) return;
      m.dataset.done = '1';

      if (target === 0) { el.textContent = prefix + '0' + suffix; return; }
      let cur = 0;
      const step = Math.max(1, Math.ceil(target / 40));
      const t = setInterval(() => {
        cur += step;
        if (cur >= target) { cur = target; clearInterval(t); }
        el.textContent = prefix + cur + suffix;
      }, 25);
    });
  };

  const metricsEl = document.querySelector('.hero-metrics');
  if (metricsEl) {
    const mio = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) { animateMetrics(); mio.disconnect(); }
    }, { threshold: 0.5 });
    mio.observe(metricsEl);
  }

  /* ── Floating particles (subtle) ── */
  const canvas = document.getElementById('particles');
  if (canvas) {
    const pCount = 35;
    const dots = [];
    for (let i = 0; i < pCount; i++) {
      const d = document.createElement('div');
      const size = 2 + Math.random() * 3;
      Object.assign(d.style, {
        position: 'absolute',
        width: size + 'px', height: size + 'px',
        borderRadius: '50%',
        background: `rgba(255,255,255,${.04 + Math.random() * .08})`,
        left: Math.random() * 100 + '%',
        top: Math.random() * 100 + '%',
        transition: 'none',
        pointerEvents: 'none'
      });
      canvas.appendChild(d);
      dots.push({ el: d, x: Math.random() * 100, y: Math.random() * 100, vx: (Math.random() - .5) * .015, vy: (Math.random() - .5) * .012 });
    }
    const moveDots = () => {
      dots.forEach(d => {
        d.x += d.vx; d.y += d.vy;
        if (d.x < 0 || d.x > 100) d.vx *= -1;
        if (d.y < 0 || d.y > 100) d.vy *= -1;
        d.el.style.left = d.x + '%';
        d.el.style.top = d.y + '%';
      });
      requestAnimationFrame(moveDots);
    };
    moveDots();
  }
})();
