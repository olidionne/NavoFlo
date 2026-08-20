(() => {
  const isFr = document.documentElement.lang.startsWith('fr');
  const currency = new Intl.NumberFormat(isFr ? 'fr-CA' : 'en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 });
  const prices = {
    base: { main: 1995, seat: 495 },
    pro: { main: 3495, seat: 895 }
  };

  document.querySelectorAll('[data-plan-card]').forEach(card => {
    const plan = card.dataset.planCard;
    const input = card.querySelector('[data-seats]');
    const province = card.querySelector('[data-province]');
    const total = card.querySelector('[data-total]');
    const extra = card.querySelector('[data-extra-seats]');
    const buy = card.querySelector('[data-checkout]');
    const update = () => {
      const seats = Math.max(1, Math.min(250, Math.floor(Number(input.value) || 1)));
      input.value = seats;
      const extras = Math.max(0, seats - 1);
      extra.textContent = String(extras);
      total.textContent = currency.format(prices[plan].main + extras * prices[plan].seat);
    };
    input.addEventListener('input', update);
    card.querySelector('[data-minus]')?.addEventListener('click', () => { input.value = Math.max(1, Number(input.value) - 1); update(); });
    card.querySelector('[data-plus]')?.addEventListener('click', () => { input.value = Math.min(250, Number(input.value) + 1); update(); });
    buy.addEventListener('click', async () => {
      buy.disabled = true;
      const old = buy.textContent;
      buy.textContent = isFr ? 'Ouverture de Stripe…' : 'Opening Stripe…';
      try {
        if (!province?.value) throw new Error(isFr ? 'Choisissez la province de facturation.' : 'Choose the billing province.');
        const response = await fetch('/api/stripe/create-checkout', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ plan, seats: Number(input.value), province: province.value, locale: isFr ? 'fr' : 'en' })
        });
        const data = await response.json();
        if (!response.ok || !data.url) throw new Error(data.error || 'Stripe unavailable');
        location.href = data.url;
      } catch (error) {
        alert((isFr ? 'Paiement non configuré pour le moment : ' : 'Payment is not configured yet: ') + error.message);
        buy.disabled = false;
        buy.textContent = old;
      }
    });
    update();
  });
})();
