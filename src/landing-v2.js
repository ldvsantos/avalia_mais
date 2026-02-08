(() => {
  'use strict';

  // ── Smooth scroll ──
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', e => {
      e.preventDefault();
      const target = document.querySelector(anchor.getAttribute('href'));
      if (target) {
        window.scrollTo({ top: target.offsetTop - 80, behavior: 'smooth' });
      }
    });
  });

  // ── Navbar scroll class ──
  const navbar = document.querySelector('.navbar');
  const onScroll = () => {
    navbar.classList.toggle('scrolled', window.scrollY > 60);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ── Intersection Observer for .reveal ──
  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
  );

  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

  // ── Stagger reveal delay for grid children ──
  document.querySelectorAll('.problems-grid, .differentials-grid, .segments-colored-grid, .roadmap-grid').forEach(grid => {
    grid.querySelectorAll('.reveal').forEach((card, i) => {
      card.style.transitionDelay = `${i * 80}ms`;
    });
  });

  // ── Counter animation for hero stats ──
  const animateCounters = () => {
    document.querySelectorAll('.stat-number').forEach(el => {
      const text = el.textContent;
      const match = text.match(/(-?\d+)/);
      if (!match) return;
      const target = parseInt(match[1]);
      const prefix = text.startsWith('−') || text.startsWith('-') ? '−' : '';
      const suffix = text.replace(/^-?\d+/, '');
      let current = 0;
      const step = Math.ceil(Math.abs(target) / 30);
      const dir = target >= 0 ? 1 : -1;

      const timer = setInterval(() => {
        current += step;
        if (current >= Math.abs(target)) {
          current = Math.abs(target);
          clearInterval(timer);
        }
        el.textContent = prefix + current + suffix;
      }, 30);
    });
  };

  const heroStats = document.querySelector('.hero-stats');
  if (heroStats) {
    const statsObserver = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        animateCounters();
        statsObserver.unobserve(heroStats);
      }
    }, { threshold: 0.5 });
    statsObserver.observe(heroStats);
  }
})();
