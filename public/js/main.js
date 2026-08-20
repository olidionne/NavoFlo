(() => {
  const header = document.querySelector('.site-header');
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('#site-nav');
  const year = document.querySelector('#year');
  const isEnglish = document.documentElement.lang.toLowerCase().startsWith('en');

  if (year) year.textContent = String(new Date().getFullYear());

  // Keep pricing discoverable without requiring a full rewrite of older pages.
  if (nav && !nav.querySelector('a[href*="pricing"]')) {
    const link = document.createElement('a');
    link.href = isEnglish ? '/en/pricing/' : '/pricing/';
    link.textContent = isEnglish ? 'Pricing' : 'Tarifs';
    const contactButton = nav.querySelector('.button');
    nav.insertBefore(link, contactButton || null);
  }

  const updateHeader = () => {
    if (header) header.classList.toggle('scrolled', window.scrollY > 8);
  };

  updateHeader();
  window.addEventListener('scroll', updateHeader, { passive: true });

  if (toggle && nav) {
    const closeMenu = () => {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('menu-open');
    };

    toggle.addEventListener('click', () => {
      const opening = !nav.classList.contains('open');
      nav.classList.toggle('open', opening);
      toggle.setAttribute('aria-expanded', String(opening));
      document.body.classList.toggle('menu-open', opening);
    });

    nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));
    window.addEventListener('resize', () => { if (window.innerWidth > 850) closeMenu(); });
  }
})();
