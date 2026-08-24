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

    if (data.payment_flow === 'pad' || data.mode === 'setup') {
      root.innerHTML = `<strong>${fr ? 'Mandat PAD enregistré' : 'PAD mandate saved'}</strong><p>${fr
        ? 'Merci. Stripe a enregistré votre compte bancaire et votre autorisation de prélèvement annuel. L’abonnement est créé côté serveur et l’accès définitif sera activé lorsque Stripe confirmera le paiement.'
        : 'Thank you. Stripe saved your bank account and annual debit authorization. The subscription is created server-side and final access will activate when Stripe confirms the payment.'}</p>`;
    } else {
      const paid = data.payment_status === 'paid' || data.subscription_status === 'active';
      root.innerHTML = paid
        ? `<strong>${fr ? 'Abonnement confirmé' : 'Subscription confirmed'}</strong><p>${fr ? 'Merci. Votre paiement est confirmé.' : 'Thank you. Your payment is confirmed.'}</p>`
        : `<strong>${fr ? 'Abonnement reçu — confirmation en cours' : 'Subscription received — confirmation pending'}</strong><p>${fr ? 'Votre abonnement a été reçu. L’accès définitif sera activé lorsque Stripe confirmera le paiement.' : 'Your subscription was received. Final access will activate when Stripe confirms the payment.'}</p>`;
    }
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
