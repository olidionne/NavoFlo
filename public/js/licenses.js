(() => {
  const root = document.querySelector('[data-license-app]');
  if (!root) return;
  const fr = document.documentElement.lang.toLowerCase().startsWith('fr');
  const fmtDate = value => {
    const n = Number(value || 0);
    if (!n) return '—';
    return new Intl.DateTimeFormat(fr ? 'fr-CA' : 'en-CA', { year:'numeric', month:'long', day:'numeric' }).format(new Date(n * 1000));
  };
  const t = {
    loading: fr ? 'Chargement de vos licences…' : 'Loading your licenses…',
    auth: fr ? 'Connexion Cloudflare Access requise.' : 'Cloudflare Access sign-in required.',
    noOrg: fr ? 'Aucun abonnement NavoFlo n’est lié à ce compte.' : 'No NavoFlo subscription is linked to this account.',
    add: fr ? 'Ajouter un utilisateur' : 'Add user',
    email: fr ? 'Courriel de l’utilisateur' : 'User email',
    name: fr ? 'Nom (facultatif)' : 'Name (optional)',
    seat: fr ? 'Licence' : 'License',
    role: fr ? 'Rôle' : 'Role',
    member: fr ? 'Utilisateur' : 'User',
    remove: fr ? 'Retirer' : 'Remove',
    assigned: fr ? 'Attribuée' : 'Assigned',
    unassigned: fr ? 'Non attribuée' : 'Unassigned',
    billing: fr ? 'Gérer la facturation' : 'Manage billing',
    plan: fr ? 'Forfait' : 'Plan',
    renewal: fr ? 'Renouvellement' : 'Renewal',
    status: fr ? 'Statut' : 'Status',
    seats: fr ? 'Licences' : 'Licenses',
    available: fr ? 'disponible(s)' : 'available',
    access: fr ? 'Vos accès' : 'Your access',
    denied: fr ? 'Votre forfait actuel ne permet pas l’accès à cette fonction.' : 'Your current plan does not allow access to this feature.'
  };

  let state = null;

  async function api(path, options={}) {
    const response = await fetch(path, { ...options, headers: { 'content-type':'application/json', ...(options.headers||{}) } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error || 'Request failed');
      error.code = data.code;
      throw error;
    }
    return data;
  }

  function planLabel(plan) { return plan === 'pro' ? 'NavoPro' : plan === 'base' ? 'NavoBase' : '—'; }
  function statusLabel(status) {
    const mapFr = { active:'Actif', trialing:'Essai', past_due:'Paiement en retard', canceled:'Annulé', incomplete:'Incomplet' };
    return fr ? (mapFr[status] || status || '—') : (status || '—').replaceAll('_',' ');
  }

  function render() {
    if (!state) return;
    const manager = ['owner','admin'].includes(state.user.role);
    const e = state.entitlements || {};
    const members = manager ? state.members || [] : [];
    root.innerHTML = `
      ${new URLSearchParams(location.search).get('denied') ? `<div class="license-alert">${t.denied}</div>` : ''}
      <section class="license-hero">
        <div><span class="eyebrow-text">${fr ? 'COMPTE NAVOFLO' : 'NAVOFLO ACCOUNT'}</span><h1>${state.organization.name}</h1><p>${state.user.email} · ${state.user.role}</p></div>
        ${manager ? `<button class="button" data-billing>${t.billing}</button>` : ''}
      </section>
      <section class="license-stats">
        <article><span>${t.plan}</span><strong>${planLabel(state.subscription?.plan)}</strong></article>
        <article><span>${t.status}</span><strong>${statusLabel(state.subscription?.status)}</strong></article>
        <article><span>${t.renewal}</span><strong>${fmtDate(state.subscription?.current_period_end)}</strong></article>
        <article><span>${t.seats}</span><strong>${state.seats.used} / ${state.seats.purchased}</strong><small>${state.seats.available} ${t.available}</small></article>
      </section>
      <section class="license-panel">
        <h2>${t.access}</h2>
        <div class="entitlement-grid">
          <div class="${e.automation?'yes':'no'}"><strong>Automatisation</strong><span>${e.automation?'✓':'—'}</span></div>
          <div class="${e.navo2d?'yes':'no'}"><strong>Navo2D</strong><span>${e.navo2d?'✓':'—'}</span></div>
          <div class="${e.navo3d?'yes':'no'}"><strong>Navo3D</strong><span>${e.navo3d?'✓':'—'}</span></div>
          <div class="${e.navoanalyzer?'yes':'no'}"><strong>NavoAnalyzer</strong><span>${fr?'À venir':'Coming soon'}</span></div>
        </div>
      </section>
      ${manager ? `<section class="license-panel"><div class="license-panel-head"><div><h2>${fr?'Équipe et licences':'Team & licenses'}</h2><p>${state.seats.used} / ${state.seats.purchased} ${fr?'licences utilisées':'licenses used'}</p></div></div>
        <form class="license-add-form" data-add-member><input name="email" type="email" required placeholder="${t.email}"><input name="display_name" placeholder="${t.name}"><button class="button" type="submit" ${state.seats.available<=0?'disabled':''}>${t.add}</button></form>
        <div class="license-members">${members.map(m => `<div class="license-member"><div><strong>${m.display_name || m.email}</strong><small>${m.email}</small></div><span class="role-badge">${m.role}</span><button class="license-toggle ${Number(m.licensed)?'on':''}" data-license-user="${m.user_id}" data-active="${Number(m.licensed)?'1':'0'}">${Number(m.licensed)?t.assigned:t.unassigned}</button>${m.role==='owner'?'':`<button class="license-remove" data-remove-user="${m.user_id}">${t.remove}</button>`}</div>`).join('')}</div>
      </section>` : ''}`;

    root.querySelector('[data-billing]')?.addEventListener('click', async e => {
      e.currentTarget.disabled = true;
      try { const d = await api('/api/licensing/portal', {method:'POST',body:'{}'}); location.href=d.url; }
      catch(err){ alert(err.message); e.currentTarget.disabled=false; }
    });
    root.querySelector('[data-add-member]')?.addEventListener('submit', async e => {
      e.preventDefault(); const fd = new FormData(e.currentTarget);
      try { state = await api('/api/licensing/members',{method:'POST',body:JSON.stringify({email:fd.get('email'),display_name:fd.get('display_name')})}); render(); }
      catch(err){ alert(err.message); }
    });
    root.querySelectorAll('[data-license-user]').forEach(btn => btn.addEventListener('click', async () => {
      const active = btn.dataset.active !== '1'; btn.disabled=true;
      try { state=await api(`/api/licensing/members/${btn.dataset.licenseUser}/license`,{method:'POST',body:JSON.stringify({active})}); render(); }
      catch(err){ alert(err.message); btn.disabled=false; }
    }));
    root.querySelectorAll('[data-remove-user]').forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm(fr?'Retirer cet utilisateur de l’entreprise?':'Remove this user from the organization?')) return;
      btn.disabled=true; try { state=await api(`/api/licensing/members/${btn.dataset.removeUser}`,{method:'DELETE'}); render(); }
      catch(err){ alert(err.message); btn.disabled=false; }
    }));
  }

  root.textContent = t.loading;
  api('/api/licensing/me').then(data => { state=data; render(); }).catch(error => {
    root.innerHTML = `<section class="license-empty"><h1>${error.code==='AUTH_REQUIRED'?t.auth:t.noOrg}</h1><p>${error.message}</p><a class="button" href="/pricing/">${fr?'Voir les tarifs':'View pricing'}</a></section>`;
  });
})();
