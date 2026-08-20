(async () => {
  const root = document.querySelector('[data-billing-success]');
  if (!root) return;
  const fr = document.documentElement.lang.startsWith('fr');
  const id = new URLSearchParams(location.search).get('session_id');
  if (!id) { root.textContent = fr ? 'Session Stripe introuvable.' : 'Stripe session not found.'; return; }
  sessionStorage.setItem('navoflo_checkout_session', id);
  try {
    const response = await fetch(`/api/stripe/session?session_id=${encodeURIComponent(id)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to retrieve session');
    const paid = data.payment_status === 'paid' || data.subscription_status === 'active';
    root.innerHTML = paid
      ? `<strong>${fr ? 'Abonnement confirmé' : 'Subscription confirmed'}</strong><p>${fr ? 'Merci. Votre paiement est confirmé.' : 'Thank you. Your payment is confirmed.'}</p>`
      : `<strong>${fr ? 'Abonnement reçu — confirmation bancaire en cours' : 'Subscription received — bank confirmation pending'}</strong><p>${fr ? 'Avec un PAD, la confirmation peut prendre quelques jours. L’accès définitif sera activé lorsque Stripe confirmera le paiement.' : 'With PAD, confirmation can take a few days. Final access will activate when Stripe confirms payment.'}</p>`;
  } catch (error) {
    root.textContent = error.message;
  }

  document.querySelector('[data-open-portal]')?.addEventListener('click', async e => {
    const button = e.currentTarget; button.disabled = true;
    try {
      const response = await fetch('/api/stripe/portal', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ session_id: id }) });
      const data = await response.json();
      if (!response.ok || !data.url) throw new Error(data.error || 'Portal unavailable');
      location.href = data.url;
    } catch (error) { alert(error.message); button.disabled = false; }
  });
})();
