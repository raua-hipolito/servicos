(() => {
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- Entrada ao rolar ----------
  const items = document.querySelectorAll('.reveal-s');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.15 });
    items.forEach((el) => io.observe(el));
  } else {
    items.forEach((el) => el.classList.add('in'));
  }

  if (!finePointer || reduce) return;

  // ---------- Paralaxe do hero ----------
  const hero = document.getElementById('hero');
  const art = document.getElementById('heroArt');
  hero.addEventListener('pointermove', (e) => {
    const r = hero.getBoundingClientRect();
    art.style.setProperty('--mx', ((e.clientX - r.left) / r.width - 0.5) * 2);
    art.style.setProperty('--my', ((e.clientY - r.top) / r.height - 0.5) * 2);
  });
  hero.addEventListener('pointerleave', () => {
    art.style.setProperty('--mx', 0);
    art.style.setProperty('--my', 0);
  });

  // ---------- Cartões: inclinação + brilho que segue o cursor ----------
  document.querySelectorAll('.card').forEach((card) => {
    const stage = card.querySelector('.stage');

    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      card.style.setProperty('--ry', ((x - 0.5) * 7).toFixed(2) + 'deg');
      card.style.setProperty('--rx', ((0.5 - y) * 7).toFixed(2) + 'deg');

      const s = stage.getBoundingClientRect();
      stage.style.setProperty('--px', (e.clientX - s.left) + 'px');
      stage.style.setProperty('--py', (e.clientY - s.top) + 'px');
    });

    card.addEventListener('pointerleave', () => {
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    });
  });
})();