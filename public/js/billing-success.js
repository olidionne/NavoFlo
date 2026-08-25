(async () => {
  const root = document.querySelector('[data-billing-success]');
  if (!root) return;
  const fr = document.documentElement.lang.startsWith('fr');
  const id = new URLSearchParams(location.search).get('session_id');
  const resendButton = document.querySelector('[data-resend-activation]');
  let customerEmail = null;
  if (!id) { root.textContent = fr ? 'Session Stripe introuvable.' : 'Stripe session not found.'; if(resendButton)resendButton.hidden=true; return; }
  sessionStorage.setItem('navoflo_checkout_session', id);
  try {
    const response = await fetch(`/api/stripe/session?session_id=${encodeURIComponent(id)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to retrieve session');
    customerEmail = data.customer_email || null;

    if (data.payment_flow === 'pad' || data.mode === 'setup') {
      root.innerHTML = `<strong>${fr ? 'Mandat PAD enregistré' : 'PAD mandate saved'}</strong><p>${fr
        ? 'Merci. Stripe a enregistré votre compte bancaire et votre autorisation de prélèvement annuel. L’abonnement est créé côté serveur et l’accès définitif sera activé lorsque Stripe confirmera le paiement.'
        : 'Thank you. Stripe saved your bank account and annual debit authorization. The subscription is created server-side and final access will activate when Stripe confirms the payment.'}</p>`;
    } else {
      const paid = data.payment_status === 'paid' || data.subscription_status === 'active';
      if (paid && data.account_status === 'ready') {
        root.innerHTML = `<strong>${fr ? 'Abonnement confirmé' : 'Subscription confirmed'}</strong><p>${fr ? 'Votre compte NavoFlo existe déjà. Connectez-vous pour gérer vos licences.' : 'Your NavoFlo account already exists. Sign in to manage your licenses.'}</p>`;
      } else if (paid) {
        const email = customerEmail ? `<strong>${customerEmail}</strong>` : (fr ? 'votre courriel de facturation' : 'your billing email');
        root.innerHTML = `<strong>${fr ? 'Abonnement confirmé' : 'Subscription confirmed'}</strong><p>${fr ? `Merci. Un courriel d’activation du compte ADMIN est envoyé à ${email}. Ouvrez ce lien pour créer votre mot de passe NavoFlo.` : `Thank you. An ADMIN account activation email is being sent to ${email}. Open that link to create your NavoFlo password.`}</p>`;
      } else {
        root.innerHTML = `<strong>${fr ? 'Abonnement reçu — confirmation en cours' : 'Subscription received — confirmation pending'}</strong><p>${fr ? 'Votre abonnement a été reçu. L’accès définitif sera activé lorsque Stripe confirmera le paiement.' : 'Your subscription was received. Final access will activate when Stripe confirms the payment.'}</p>`;
      }
    }
    if(resendButton) resendButton.hidden = !customerEmail || data.account_status === 'ready';
  } catch (error) {
    root.textContent = error.message;
    if(resendButton)resendButton.hidden=true;
  }

  resendButton?.addEventListener('click', async e => {
    const button=e.currentTarget;
    if(!customerEmail)return;
    button.disabled=true;
    try{
      const response=await fetch('/api/auth/resend-activation',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:customerEmail})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||'Unable to resend activation email');
      button.textContent=fr?'Courriel d’activation envoyé':'Activation email sent';
    }catch(error){alert(error.message);button.disabled=false;}
  });

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