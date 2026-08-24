(() => {
  const isFr = document.documentElement.lang.startsWith('fr');
  const currency = new Intl.NumberFormat(isFr ? 'fr-CA' : 'en-CA', {
    style: 'currency', currency: 'CAD', maximumFractionDigits: 0
  });
  const prices = {
    base: { main: 1995, seat: 495 },
    pro: { main: 3495, seat: 895 }
  };

  function postalModal() {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'billing-postal-overlay';
      overlay.innerHTML = `
        <div class="billing-postal-dialog" role="dialog" aria-modal="true" aria-labelledby="billing-postal-title">
          <button type="button" class="billing-postal-close" aria-label="${isFr ? 'Fermer' : 'Close'}">×</button>
          <span class="eyebrow-text">${isFr ? 'FACTURATION' : 'BILLING'}</span>
          <h2 id="billing-postal-title">${isFr ? 'Votre code postal' : 'Your postal code'}</h2>
          <p>${isFr
            ? 'Il sert uniquement à déterminer automatiquement les taxes applicables. Stripe recueillera votre adresse complète au paiement.'
            : 'It is used only to determine the applicable taxes automatically. Stripe will collect your full billing address at checkout.'}</p>
          <label>
            <span>${isFr ? 'Code postal de facturation' : 'Billing postal code'}</span>
            <input type="text" inputmode="text" autocomplete="postal-code" maxlength="7" placeholder="A1A 1A1" aria-describedby="billing-postal-error">
          </label>
          <small id="billing-postal-error" class="billing-postal-error" aria-live="polite"></small>
          <button type="button" class="checkout-btn billing-postal-continue">${isFr ? 'Continuer vers Stripe' : 'Continue to Stripe'}</button>
          <small class="billing-postal-privacy">${isFr ? 'Le paiement et les coordonnées bancaires sont traités par Stripe.' : 'Payment and banking details are processed by Stripe.'}</small>
        </div>`;
      document.body.appendChild(overlay);
      const input = overlay.querySelector('input');
      const error = overlay.querySelector('.billing-postal-error');
      const close = () => { overlay.remove(); resolve(null); };
      const submit = () => {
        const value = String(input.value || '').trim().toUpperCase();
        const compact = value.replace(/\s+/g, '');
        if (!/^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTVWXYZ]\d[ABCEGHJ-NPRSTVWXYZ]\d$/.test(compact)) {
          error.textContent = isFr ? 'Entrez un code postal canadien valide.' : 'Enter a valid Canadian postal code.';
          input.focus();
          return;
        }
        overlay.remove();
        resolve(compact.slice(0, 3) + ' ' + compact.slice(3));
      };
      overlay.querySelector('.billing-postal-close').addEventListener('click', close);
      overlay.addEventListener('click', (event) => { if (event.target === overlay) close(); });
      overlay.querySelector('.billing-postal-continue').addEventListener('click', submit);
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') submit();
        if (event.key === 'Escape') close();
      });
      setTimeout(() => input.focus(), 0);
    });
  }

  document.querySelectorAll('[data-plan-card]').forEach(card => {
    const plan = card.dataset.planCard;
    const input = card.querySelector('[data-seats]');
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
    card.querySelector('[data-minus]')?.addEventListener('click', () => {
      input.value = Math.max(1, Number(input.value) - 1); update();
    });
    card.querySelector('[data-plus]')?.addEventListener('click', () => {
      input.value = Math.min(250, Number(input.value) + 1); update();
    });

    buy.addEventListener('click', async () => {
      const postalCode = await postalModal();
      if (!postalCode) return;
      buy.disabled = true;
      const old = buy.textContent;
      buy.textContent = isFr ? 'Ouverture de Stripe…' : 'Opening Stripe…';
      try {
        const response = await fetch('/api/stripe/create-checkout', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            plan,
            seats: Number(input.value),
            postalCode,
            locale: isFr ? 'fr' : 'en'
          })
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
