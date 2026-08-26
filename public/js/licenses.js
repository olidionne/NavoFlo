(() => {
  const root = document.querySelector('[data-license-app]');
  if (!root) return;

  const fr = document.documentElement.lang.toLowerCase().startsWith('fr');
  const currentDeviceId = localStorage.getItem('navoflo_device_id') || '';
  let state = null;
  let security = { sessions: [], devices: [] };
  let audit = { events: [], has_more: false, next_before_id: null, loading: false, error: '', expanded: localStorage.getItem('navoflo_audit_expanded') === '1', filters: { category: '', user_id: '', from: '', to: '' } };
  let banner = '';

  const t = {
    loading: fr ? 'Chargement de vos licences…' : 'Loading your licenses…',
    noOrg: fr ? 'Aucun abonnement NavoFlo n’est lié à ce compte.' : 'No NavoFlo subscription is linked to this account.',
    add: fr ? 'Inviter un utilisateur' : 'Invite user',
    email: fr ? 'Courriel de l’utilisateur' : 'User email',
    name: fr ? 'Nom (facultatif)' : 'Name (optional)',
    remove: fr ? 'Retirer' : 'Remove',
    assigned: fr ? 'Attribuée' : 'Assigned',
    unassigned: fr ? 'Non attribuée' : 'Unassigned',
    pending: fr ? 'En attente' : 'Pending',
    billing: fr ? 'Gérer la facturation' : 'Manage billing',
    plan: fr ? 'Forfait' : 'Plan',
    renewal: fr ? 'Renouvellement' : 'Renewal',
    status: fr ? 'Statut' : 'Status',
    seats: fr ? 'Licences' : 'Licenses',
    available: fr ? 'disponible(s)' : 'available',
    access: fr ? 'Vos accès' : 'Your access',
    denied: fr ? 'Votre forfait actuel ne permet pas l’accès à cette fonction.' : 'Your current plan does not allow access to this feature.',
    fastTitle: fr ? 'Ajouter une licence additionnelle' : 'Add an additional license',
    fastIntro: fr ? 'Toutes vos licences sont actuellement attribuées.' : 'All of your licenses are currently assigned.',
    fastAction: fr ? 'Ajouter la licence et inviter' : 'Add license and invite',
    cancel: fr ? 'Annuler' : 'Cancel',
    prorata: fr ? 'Stripe calculera automatiquement le montant à facturer aujourd’hui au prorata de votre période annuelle, plus les taxes applicables.' : 'Stripe will automatically calculate today’s prorated charge for the remainder of your annual term, plus applicable taxes.',
    processing: fr ? 'Ajout de la licence en cours…' : 'Adding the license…',
    waiting: fr ? 'Paiement accepté. La nouvelle licence sera attribuée automatiquement dès la confirmation Stripe.' : 'Payment accepted. The new license will be assigned automatically as soon as Stripe confirms it.',
    logout: fr ? 'Déconnexion' : 'Sign out',
    transfer: fr ? 'Transférer' : 'Transfer',
    inviteAgain: fr ? 'Renvoyer l’invitation' : 'Resend invitation',
    copyInvite: fr ? 'Copier le lien' : 'Copy link',
    sessions: fr ? 'Sessions Web' : 'Web sessions',
    sessionsIntro: fr ? 'Navigateurs actuellement connectés à votre compte NavoFlo.' : 'Browsers currently signed in to your NavoFlo account.',
    devices: fr ? 'Postes NavoFlo' : 'NavoFlo devices',
    devicesIntro: fr ? 'Postes reconnus par Navo2D et Navo3D. Déconnecter un poste révoque immédiatement ses leases applicatives.' : 'Devices recognized by Navo2D and Navo3D. Disconnecting a device immediately revokes its application leases.',
    current: fr ? 'Cette session' : 'This session',
    currentDevice: fr ? 'Ce poste' : 'This device',
    revoke: fr ? 'Révoquer' : 'Revoke',
    disconnect: fr ? 'Déconnecter' : 'Disconnect',
    revokeOthers: fr ? 'Révoquer les autres sessions' : 'Revoke other sessions',
    active: fr ? 'Actif' : 'Active',
    inactive: fr ? 'Inactif' : 'Inactive',
    disconnected: fr ? 'Déconnecté' : 'Disconnected',
    lastActivity: fr ? 'Dernière activité' : 'Last activity',
    expires: fr ? 'Expiration maximale' : 'Maximum expiry',
    idleExpires: fr ? 'Expire si inactive' : 'Expires if inactive',
    created: fr ? 'Créée' : 'Created',
    noSessions: fr ? 'Aucune session active.' : 'No active sessions.',
    noDevices: fr ? 'Aucun poste Navo2D/Navo3D enregistré pour ce compte.' : 'No Navo2D/Navo3D device is registered for this account.',
    audit: fr ? 'Journal d’audit' : 'Audit log',
    auditIntro: fr ? 'Historique des connexions, invitations, licences et actions de sécurité de votre organisation.' : 'History of sign-ins, invitations, licensing and security actions for your organization.',
    auditAll: fr ? 'Toutes les activités' : 'All activity',
    auditAuth: fr ? 'Connexion et sécurité' : 'Sign-in & security',
    auditMembers: fr ? 'Équipe et invitations' : 'Team & invitations',
    auditLicenses: fr ? 'Licences et postes' : 'Licenses & devices',
    auditBilling: fr ? 'Facturation' : 'Billing',
    auditAllUsers: fr ? 'Tous les utilisateurs' : 'All users',
    auditFrom: fr ? 'Du' : 'From',
    auditTo: fr ? 'Au' : 'To',
    auditFilter: fr ? 'Filtrer' : 'Filter',
    auditReset: fr ? 'Réinitialiser' : 'Reset',
    auditRefresh: fr ? 'Actualiser' : 'Refresh',
    auditMore: fr ? 'Afficher plus' : 'Show more',
    auditEmpty: fr ? 'Aucune activité ne correspond à ces filtres.' : 'No activity matches these filters.',
    auditError: fr ? 'Impossible de charger le journal d’audit.' : 'Unable to load the audit log.',
    pcTitle: fr ? 'Capacité de cet ordinateur' : 'This computer capability',
    pcIntro: fr ? 'Indicateur local utilisé par Navo2D / Navo3D. Aucune information matérielle n’est envoyée à NavoFlo.' : 'Local indicator used by Navo2D / Navo3D. No hardware information is sent to NavoFlo.',
    pcGood: fr ? 'Compatible' : 'Compatible',
    pcLimited: fr ? 'Limitée' : 'Limited',
    pcBad: fr ? 'Incompatible' : 'Incompatible',
    pcThreads: fr ? 'threads CPU' : 'CPU threads',
    pcRam: fr ? 'RAM' : 'RAM',
    pcUnknown: fr ? 'non exposé par le navigateur' : 'not exposed by the browser',
    pcTargets: fr ? 'Repères : minimum 4 threads / 8 Go · STEP recommandé 8+ threads / 16 Go · gros assemblages 32 Go.' : 'Guidance: minimum 4 threads / 8 GB · recommended STEP 8+ threads / 16 GB · large assemblies 32 GB.'
  };

  async function api(path, options = {}) {
    const response = await fetch(path, {
      ...options,
      headers: { 'content-type': 'application/json', ...(options.headers || {}) },
      cache: 'no-store',
      credentials: 'same-origin'
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error || 'Request failed');
      error.code = data.code;
      error.details = data.details;
      throw error;
    }
    return data;
  }

  const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
  const planLabel = plan => plan === 'pro' ? 'NavoPro' : plan === 'base' ? 'NavoBase' : '—';
  const seatPrice = plan => plan === 'pro' ? '895 $ CA/an' : plan === 'base' ? '495 $ CA/an' : '';
  const statusLabel = status => fr
    ? ({ active: 'Actif', trialing: 'Essai', past_due: 'Paiement en retard', canceled: 'Annulé', incomplete: 'Incomplet' }[status] || status || '—')
    : (status || '—').replaceAll('_', ' ');
  const accountStatus = member => {
    if (member.user_status === 'active') return fr ? 'Actif' : 'Active';
    if (member.user_status === 'pending_setup') return fr ? 'Invitation à accepter' : 'Invitation pending';
    return member.user_status || '—';
  };
  const fmtDate = value => {
    const n = Number(value || 0);
    return n ? new Intl.DateTimeFormat(fr ? 'fr-CA' : 'en-CA', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(n * 1000)) : '—';
  };
  const parseUtc = value => {
    if (!value) return null;
    let text = String(value);
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(text)) text = text.replace(' ', 'T') + 'Z';
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? null : date;
  };
  const fmtDateTime = value => {
    const date = parseUtc(value);
    return date ? new Intl.DateTimeFormat(fr ? 'fr-CA' : 'en-CA', { dateStyle: 'medium', timeStyle: 'short' }).format(date) : '—';
  };

  function sessionLabel(userAgent) {
    const ua = String(userAgent || '');
    let browser = fr ? 'Navigateur' : 'Browser';
    let os = fr ? 'Appareil' : 'Device';
    if (/Edg\//.test(ua)) browser = 'Edge';
    else if (/Chrome\//.test(ua)) browser = 'Chrome';
    else if (/Firefox\//.test(ua)) browser = 'Firefox';
    else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) browser = 'Safari';
    if (/Windows/.test(ua)) os = 'Windows';
    else if (/Mac OS|Macintosh/.test(ua)) os = 'macOS';
    else if (/Android/.test(ua)) os = 'Android';
    else if (/iPhone|iPad/.test(ua)) os = 'iOS';
    return `${os} · ${browser}`;
  }

  function inviteDialog(invitation, email) {
    if (!invitation) return;
    const modal = document.createElement('div');
    modal.className = 'license-modal-backdrop';
    modal.innerHTML = `<div class="license-modal"><h2>${fr ? 'Invitation créée' : 'Invitation created'}</h2><p>${invitation.email_sent ? (fr ? `Une invitation a été envoyée à ${esc(email)}.` : `An invitation was sent to ${esc(email)}.`) : (fr ? 'L’envoi de courriel n’est pas encore configuré. Copiez ce lien et transmettez-le à l’utilisateur.' : 'Email delivery is not configured yet. Copy this link and send it to the user.')}</p><div class="invite-link-row"><input readonly value="${esc(invitation.url)}"><button class="button" data-copy>${t.copyInvite}</button></div><div class="license-modal-actions"><button class="button secondary" data-close>${fr ? 'Fermer' : 'Close'}</button></div></div>`;
    document.body.appendChild(modal);
    modal.querySelector('[data-close]').onclick = () => modal.remove();
    modal.querySelector('[data-copy]').onclick = async () => {
      await navigator.clipboard.writeText(invitation.url);
      modal.querySelector('[data-copy]').textContent = fr ? 'Copié ✓' : 'Copied ✓';
    };
  }

  function fastTrackDialog(email, displayName) {
    const price = seatPrice(state.subscription?.plan);
    const who = displayName || email;
    const modal = document.createElement('div');
    modal.className = 'license-modal-backdrop';
    modal.innerHTML = `<div class="license-modal" role="dialog" aria-modal="true"><h2>${t.fastTitle}</h2><p>${t.fastIntro}</p><div class="license-purchase-summary"><div><span>${fr ? 'Utilisateur' : 'User'}</span><strong>${esc(who)}</strong></div><div><span>${fr ? 'Forfait' : 'Plan'}</span><strong>${planLabel(state.subscription?.plan)}</strong></div><div><span>${fr ? 'Licence additionnelle' : 'Additional license'}</span><strong>${price}</strong></div></div><p class="license-muted">${t.prorata}</p><div class="license-modal-actions"><button class="button secondary" data-cancel>${t.cancel}</button><button class="button secondary" data-invite-only>${fr ? 'Inviter sans licence' : 'Invite without license'}</button><button class="button" data-confirm>${t.fastAction}</button></div></div>`;
    document.body.appendChild(modal);
    modal.querySelector('[data-cancel]').onclick = () => modal.remove();
    modal.querySelector('[data-invite-only]').onclick = async event => {
      const button = event.currentTarget;
      button.disabled = true;
      try {
        const result = await api('/api/licensing/members', { method: 'POST', body: JSON.stringify({ email, display_name: displayName, assign_license: false }) });
        state = result.state;
        modal.remove();
        await refreshAuditIfManager();
        render();
        inviteDialog(result.invitation, email);
      } catch (error) {
        alert(error.message);
        button.disabled = false;
      }
    };
    modal.querySelector('[data-confirm]').onclick = async event => {
      const button = event.currentTarget;
      button.disabled = true;
      button.textContent = t.processing;
      try {
        const result = await api('/api/licensing/fast-track-seat', { method: 'POST', body: JSON.stringify({ email, display_name: displayName }) });
        state = result.state || state;
        await refreshAuditIfManager();
        if (result.purchase?.billing_url) {
          location.href = result.purchase.billing_url;
          return;
        }
        banner = t.waiting;
        modal.remove();
        render();
        if (result.invitation) inviteDialog(result.invitation, email);
        pollForSeat(email);
      } catch (error) {
        alert(error.message);
        button.disabled = false;
        button.textContent = t.fastAction;
      }
    };
  }

  async function pollForSeat(email) {
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 1200));
      try {
        const next = await api('/api/licensing/me');
        state = next;
        const member = (next.members || []).find(item => String(item.email).toLowerCase() === String(email).toLowerCase());
        if (Number(member?.licensed)) {
          banner = fr ? `Licence attribuée à ${email}.` : `License assigned to ${email}.`;
          await refreshAuditIfManager();
          render();
          return;
        }
      } catch {}
    }
    render();
  }

  function transferDialog(source) {
    const candidates = (state.members || []).filter(member => Number(member.user_id) !== Number(source.user_id) && member.role !== 'owner' && !Number(member.licensed));
    if (!candidates.length) {
      alert(fr ? 'Aucun utilisateur sans licence n’est disponible. Invitez d’abord l’utilisateur cible.' : 'No unlicensed user is available. Invite the target user first.');
      return;
    }
    const modal = document.createElement('div');
    modal.className = 'license-modal-backdrop';
    modal.innerHTML = `<div class="license-modal"><h2>${fr ? 'Transférer la licence' : 'Transfer license'}</h2><p>${fr ? `La licence de ${esc(source.display_name || source.email)} sera libérée et toutes ses sessions applicatives seront révoquées.` : `${esc(source.display_name || source.email)}'s license will be released and all application sessions will be revoked.`}</p><label class="license-transfer-label">${fr ? 'Nouvel utilisateur' : 'New user'}<select data-target>${candidates.map(candidate => `<option value="${candidate.user_id}">${esc(candidate.display_name || candidate.email)} — ${esc(candidate.email)}</option>`).join('')}</select></label><div class="license-modal-actions"><button class="button secondary" data-close>${t.cancel}</button><button class="button" data-transfer>${t.transfer}</button></div></div>`;
    document.body.appendChild(modal);
    modal.querySelector('[data-close]').onclick = () => modal.remove();
    modal.querySelector('[data-transfer]').onclick = async event => {
      event.currentTarget.disabled = true;
      try {
        state = await api(`/api/licensing/members/${source.user_id}/transfer`, { method: 'POST', body: JSON.stringify({ target_user_id: Number(modal.querySelector('[data-target]').value) }) });
        banner = fr ? 'Licence transférée avec succès.' : 'License transferred successfully.';
        modal.remove();
        await loadSecurity();
        await refreshAuditIfManager();
        render();
      } catch (error) {
        alert(error.message);
        event.currentTarget.disabled = false;
      }
    };
  }

  async function loadSecurity() {
    const deviceQuery = currentDeviceId ? `?current_device_id=${encodeURIComponent(currentDeviceId)}` : '';
    const [sessionResult, deviceResult] = await Promise.allSettled([
      api('/api/auth/sessions'),
      api('/api/licensing/devices' + deviceQuery)
    ]);
    security.sessions = sessionResult.status === 'fulfilled' ? sessionResult.value.sessions || [] : [];
    security.devices = deviceResult.status === 'fulfilled' ? deviceResult.value.devices || [] : [];
  }

  function securityHtml() {
    const sessions = security.sessions || [];
    const devices = security.devices || [];
    return `<section class="license-panel license-security-panel">
      <div class="license-panel-head security-heading"><div><h2>${t.sessions}</h2><p>${t.sessionsIntro}</p></div>${sessions.filter(item => !item.current).length ? `<button class="button secondary security-secondary" data-revoke-others>${t.revokeOthers}</button>` : ''}</div>
      <div class="security-list">${sessions.length ? sessions.map(session => `<article class="security-row">
        <div class="security-icon" aria-hidden="true">W</div>
        <div class="security-main"><div class="security-title"><strong>${esc(sessionLabel(session.user_agent))}</strong>${session.current ? `<span class="security-badge current">${t.current}</span>` : ''}</div><small>${t.lastActivity}: ${esc(fmtDateTime(session.last_seen_at))}${session.idle_expires_at ? ` · ${t.idleExpires}: ${esc(fmtDateTime(session.idle_expires_at))}` : ''}</small><small>${t.created}: ${esc(fmtDateTime(session.created_at))} · ${t.expires}: ${esc(fmtDateTime(session.expires_at))}</small></div>
        <button class="security-danger" data-revoke-session="${session.id}">${session.current ? t.logout : t.revoke}</button>
      </article>`).join('') : `<p class="license-muted">${t.noSessions}</p>`}</div>
    </section>
    <section class="license-panel license-security-panel">
      <div class="license-panel-head security-heading"><div><h2>${t.devices}</h2><p>${t.devicesIntro}</p></div></div>
      <div class="security-list">${devices.length ? devices.map(device => {
        const status = device.active ? t.active : device.disconnected_at ? t.disconnected : t.inactive;
        const products = (device.active_products || []).map(product => product === 'navo2d' ? 'Navo2D' : product === 'navo3d' ? 'Navo3D' : product).join(' + ');
        return `<article class="security-row ${device.active ? 'is-active' : ''}">
          <div class="security-icon" aria-hidden="true">N</div>
          <div class="security-main"><div class="security-title"><strong>${esc(device.name || (fr ? 'Poste NavoFlo' : 'NavoFlo device'))}</strong>${device.current ? `<span class="security-badge current">${t.currentDevice}</span>` : ''}<span class="security-badge ${device.active ? 'active' : ''}">${esc(status)}</span>${products ? `<span class="security-badge product">${esc(products)}</span>` : ''}</div><small>${t.lastActivity}: ${esc(fmtDateTime(device.last_seen_at))}${device.active_until ? ` · ${t.expires}: ${esc(fmtDateTime(device.active_until))}` : ''}</small></div>
          ${device.active ? `<button class="security-danger" data-disconnect-device="${device.id}">${t.disconnect}</button>` : ''}
        </article>`;
      }).join('') : `<p class="license-muted">${t.noDevices}</p>`}</div>
    </section>`;
  }

  const auditPerson = person => person ? (person.display_name || person.email || (fr ? 'Utilisateur' : 'User')) : (fr ? 'Système NavoFlo' : 'NavoFlo system');
  const memberNameById = id => {
    const member = (state?.members || []).find(item => Number(item.user_id) === Number(id));
    return member ? (member.display_name || member.email) : (fr ? `Utilisateur #${id}` : `User #${id}`);
  };

  function auditPresentation(event) {
    const action = String(event.action || '');
    const actor = auditPerson(event.actor);
    const target = auditPerson(event.target);
    const d = event.details || {};
    const map = {
      'auth.login': () => ({ title: fr ? `${actor} s’est connecté à NavoFlo.` : `${actor} signed in to NavoFlo.` }),
      'auth.logout': () => ({ title: fr ? `${actor} s’est déconnecté de NavoFlo.` : `${actor} signed out of NavoFlo.` }),
      'auth.password_reset_requested': () => ({ title: fr ? `Réinitialisation du mot de passe demandée pour ${target}.` : `Password reset requested for ${target}.` }),
      'auth.password_reset_completed': () => ({ title: fr ? `${target} a réinitialisé son mot de passe.` : `${target} reset their password.` }),
      'auth.password_reset_email_failed': () => ({ title: fr ? `Échec d’envoi du courriel de réinitialisation pour ${target}.` : `Password reset email failed for ${target}.` }),
      'auth.activation_email_sent': () => ({ title: fr ? `Courriel d’activation ADMIN envoyé à ${target}.` : `ADMIN activation email sent to ${target}.` }),
      'auth.activation_email_failed': () => ({ title: fr ? `Échec d’envoi du courriel d’activation ADMIN pour ${target}.` : `ADMIN activation email failed for ${target}.` }),
      'auth.activation_completed': () => ({ title: fr ? `${target} a activé son compte ADMIN.` : `${target} activated their ADMIN account.` }),
      'auth.session_revoked': () => ({ title: d.current ? (fr ? `${actor} a fermé sa session Web courante.` : `${actor} signed out the current Web session.`) : (fr ? `${actor} a révoqué une session Web.` : `${actor} revoked a Web session.`) }),
      'auth.other_sessions_revoked': () => ({ title: fr ? `${actor} a révoqué ${Number(d.count || 0)} autre(s) session(s) Web.` : `${actor} revoked ${Number(d.count || 0)} other Web session(s).` }),
      'member.invited': () => ({ title: fr ? `${actor} a invité ${target}.` : `${actor} invited ${target}.`, detail: d.email_sent === false ? (fr ? 'Lien créé, mais le courriel n’a pas été envoyé.' : 'Link created, but the email was not sent.') : null }),
      'member.invitation_accepted': () => ({ title: fr ? `${target} a accepté l’invitation NavoFlo.` : `${target} accepted the NavoFlo invitation.` }),
      'member.removed': () => ({ title: fr ? `${actor} a retiré ${target} de l’organisation.` : `${actor} removed ${target} from the organization.` }),
      'license.assigned': () => ({ title: fr ? `${actor} a attribué une licence USER à ${target}.` : `${actor} assigned a USER license to ${target}.`, detail: d.source === 'stripe_webhook' ? (fr ? 'Attribution automatique après confirmation Stripe.' : 'Automatically assigned after Stripe confirmation.') : null }),
      'license.revoked': () => ({ title: fr ? `${actor} a retiré la licence USER de ${target}.` : `${actor} revoked ${target}’s USER license.` }),
      'license.transferred': () => ({ title: fr ? `${actor} a transféré une licence de ${memberNameById(d.from_user_id)} vers ${target}.` : `${actor} transferred a license from ${memberNameById(d.from_user_id)} to ${target}.` }),
      'license.device_takeover': () => ({ title: fr ? `${actor} a utilisé sa licence sur un autre poste.` : `${actor} moved the license to another device.` }),
      'license.device_disconnected': () => ({ title: fr ? `${actor} a déconnecté ${d.device_name || 'un poste NavoFlo'}.` : `${actor} disconnected ${d.device_name || 'a NavoFlo device'}.` }),
      'billing.seat_fast_track_requested': () => ({ title: fr ? `${actor} a demandé une licence additionnelle pour ${target}.` : `${actor} requested an additional license for ${target}.`, detail: d.status ? (fr ? `Statut Stripe : ${d.status}` : `Stripe status: ${d.status}`) : null })
    };
    const value = map[action]?.() || { title: action.replaceAll('.', ' · ') || (fr ? 'Activité NavoFlo' : 'NavoFlo activity') };
    return value;
  }

  function auditKind(action) {
    if (String(action).startsWith('auth.')) return { cls:'auth', label:'S' };
    if (String(action).startsWith('member.')) return { cls:'member', label:'U' };
    if (String(action).startsWith('license.')) return { cls:'license', label:'L' };
    if (String(action).startsWith('billing.')) return { cls:'billing', label:'$' };
    return { cls:'other', label:'N' };
  }

  function auditQuery(beforeId = null) {
    const params = new URLSearchParams({ limit:'50' });
    const f = audit.filters || {};
    if (f.category) params.set('category', f.category);
    if (f.user_id) params.set('user_id', f.user_id);
    if (f.from) params.set('from', f.from);
    if (f.to) params.set('to', f.to);
    if (beforeId) params.set('before_id', beforeId);
    return params.toString();
  }

  async function loadAudit({ append = false } = {}) {
    if (!state || !['owner', 'admin'].includes(state.user?.role)) return;
    audit.loading = true;
    audit.error = '';
    try {
      const data = await api('/api/audit?' + auditQuery(append ? audit.next_before_id : null));
      audit.events = append ? [...audit.events, ...(data.events || [])] : (data.events || []);
      audit.has_more = Boolean(data.has_more);
      audit.next_before_id = data.next_before_id || null;
    } catch (error) {
      audit.error = error.message || t.auditError;
      if (!append) audit.events = [];
      audit.has_more = false;
      audit.next_before_id = null;
    } finally {
      audit.loading = false;
    }
  }

  async function refreshAuditIfManager() {
    if (state && ['owner', 'admin'].includes(state.user?.role)) await loadAudit();
  }

  function auditHtml() {
    const filters = audit.filters || {};
    const members = state?.members || [];
    const options = members.map(member => `<option value="${member.user_id}" ${String(filters.user_id) === String(member.user_id) ? 'selected' : ''}>${esc(member.display_name || member.email)}</option>`).join('');
    const events = audit.events || [];
    return `<section class="license-panel audit-panel ${audit.expanded ? 'is-open' : ''}">
      <div class="audit-heading">
        <button class="audit-toggle" type="button" data-audit-toggle aria-expanded="${audit.expanded ? 'true' : 'false'}">
          <span class="audit-toggle-copy"><span class="audit-title">${t.audit}</span><span class="audit-intro">${t.auditIntro}</span></span>
          <span class="audit-chevron" aria-hidden="true">⌄</span>
        </button>
      </div>
      <div class="audit-collapse" ${audit.expanded ? '' : 'hidden'}>
      <div class="audit-toolbar"><button class="button secondary audit-refresh" type="button" data-audit-refresh ${audit.loading ? 'disabled' : ''}>${t.auditRefresh}</button></div>
      <form class="audit-filters" data-audit-filters>
        <label><span>${fr ? 'Type' : 'Type'}</span><select name="category"><option value="">${t.auditAll}</option><option value="auth" ${filters.category === 'auth' ? 'selected' : ''}>${t.auditAuth}</option><option value="member" ${filters.category === 'member' ? 'selected' : ''}>${t.auditMembers}</option><option value="license" ${filters.category === 'license' ? 'selected' : ''}>${t.auditLicenses}</option><option value="billing" ${filters.category === 'billing' ? 'selected' : ''}>${t.auditBilling}</option></select></label>
        <label><span>${fr ? 'Utilisateur' : 'User'}</span><select name="user_id"><option value="">${t.auditAllUsers}</option>${options}</select></label>
        <label><span>${t.auditFrom}</span><input type="date" name="from" value="${esc(filters.from || '')}"></label>
        <label><span>${t.auditTo}</span><input type="date" name="to" value="${esc(filters.to || '')}"></label>
        <div class="audit-filter-actions"><button class="button" type="submit">${t.auditFilter}</button><button class="button secondary" type="button" data-audit-reset>${t.auditReset}</button></div>
      </form>
      ${audit.error ? `<div class="audit-error">${esc(audit.error)}</div>` : ''}
      <div class="audit-list">${events.length ? events.map(event => {
        const view = auditPresentation(event);
        const kind = auditKind(event.action);
        return `<article class="audit-row"><div class="audit-kind ${kind.cls}" aria-hidden="true">${kind.label}</div><div class="audit-main"><strong>${esc(view.title)}</strong>${view.detail ? `<span>${esc(view.detail)}</span>` : ''}<small>${esc(fmtDateTime(event.created_at))} · ${esc(event.action)}</small></div></article>`;
      }).join('') : `<p class="license-muted">${audit.loading ? (fr ? 'Chargement du journal…' : 'Loading audit log…') : t.auditEmpty}</p>`}</div>
      ${audit.has_more ? `<div class="audit-more"><button class="button secondary" type="button" data-audit-more ${audit.loading ? 'disabled' : ''}>${t.auditMore}</button></div>` : ''}
      </div>
    </section>`;
  }

  function pcCapabilityHtml() {
    const wasm=typeof WebAssembly==='object';
    let webgl2=false;try{webgl2=!!document.createElement('canvas').getContext('webgl2')}catch{}
    const threads=Number(navigator.hardwareConcurrency)||null,ram=Number(navigator.deviceMemory)||null;
    const required=wasm&&webgl2,cpuOk=threads==null||threads>=4,ramOk=ram==null||ram>=8;
    const level=required&&cpuOk&&ramOk?'good':required?'limited':'bad';
    const label=level==='good'?t.pcGood:level==='limited'?t.pcLimited:t.pcBad;
    const ramText=ram?`${ram} GB+`:`${t.pcUnknown}`;
    return `<section class="license-panel pc-account-panel">
      <div class="license-panel-head pc-account-heading"><div><h2>${t.pcTitle}</h2><p>${t.pcIntro}</p></div><span class="pc-account-status ${level}">${label}</span></div>
      <div class="pc-account-grid">
        <div class="${wasm?'ok':'bad'}"><span>WebAssembly</span><strong>${wasm?'✓':'✕'}</strong></div>
        <div class="${webgl2?'ok':'bad'}"><span>WebGL2</span><strong>${webgl2?'✓':'✕'}</strong></div>
        <div class="${cpuOk?'ok':'warn'}"><span>CPU</span><strong>${threads??'?'} ${t.pcThreads}</strong></div>
        <div class="${ramOk?'ok':'warn'}"><span>${t.pcRam}</span><strong>${ramText}</strong></div>
      </div>
      <p class="pc-account-targets">${t.pcTargets}</p>
    </section>`;
  }

  function render() {
    if (!state) return;
    const manager = ['owner', 'admin'].includes(state.user.role);
    const entitlements = state.entitlements || {};
    const members = manager ? state.members || [] : [];
    root.innerHTML = `${new URLSearchParams(location.search).get('denied') ? `<div class="license-alert">${t.denied}</div>` : ''}${banner ? `<div class="license-alert license-success">${esc(banner)}</div>` : ''}
      <section class="license-hero"><div><span class="eyebrow-text">${fr ? 'COMPTE NAVOFLO' : 'NAVOFLO ACCOUNT'}</span><h1>${esc(state.organization.name)}</h1><p>${esc(state.user.email)} · ${esc(state.user.role)} · ${state.user.license_type === 'admin' ? (fr ? 'Licence Admin' : 'Admin license') : (fr ? 'Licence utilisateur' : 'User license')}</p></div><div class="license-hero-actions">${manager ? `<button class="button" data-billing>${t.billing}</button>` : ''}<button class="button license-logout" data-logout>${t.logout}</button></div></section>
      <section class="license-stats"><article><span>${t.plan}</span><strong>${planLabel(state.subscription?.plan)}</strong></article><article><span>${t.status}</span><strong>${statusLabel(state.subscription?.status)}</strong></article><article><span>${t.renewal}</span><strong>${fmtDate(state.subscription?.current_period_end)}</strong></article><article><span>${t.seats}</span><strong>${state.seats.used} / ${state.seats.purchased}</strong><small>${state.seats.available} ${t.available}</small></article></section>
      <section class="license-panel"><h2>${t.access}</h2><div class="entitlement-grid"><div class="${entitlements.automation ? 'yes' : 'no'}"><strong>Automatisation</strong><span>${entitlements.automation ? '✓' : '—'}</span></div><div class="${entitlements.navo2d ? 'yes' : 'no'}"><strong>Navo2D</strong><span>${entitlements.navo2d ? '✓' : '—'}</span></div><div class="${entitlements.navo3d ? 'yes' : 'no'}"><strong>Navo3D</strong><span>${entitlements.navo3d ? '✓' : '—'}</span></div><div class="${entitlements.navoanalyzer ? 'yes' : 'no'}"><strong>NavoAnalyzer</strong><span>${fr ? 'À venir' : 'Coming soon'}</span></div></div></section>
      ${securityHtml()}
      ${manager ? auditHtml() : ''}
      ${manager ? `<section class="license-panel"><div class="license-panel-head"><div><h2>${fr ? 'Équipe et licences' : 'Team & licenses'}</h2><p>${state.seats.used} / ${state.seats.purchased} ${fr ? 'licences utilisées' : 'licenses used'}</p></div></div><form class="license-add-form" data-add-member><input name="email" type="email" required placeholder="${t.email}"><input name="display_name" placeholder="${t.name}"><button class="button" type="submit">${t.add}</button></form>${state.seats.available <= 0 ? `<p class="license-seat-note">${fr ? `Aucune licence libre. NavoFlo proposera le Fast Track pour ajouter automatiquement une licence ${planLabel(state.subscription?.plan)}.` : `No free license. NavoFlo will offer Fast Track to add an additional ${planLabel(state.subscription?.plan)} license.`}</p>` : ''}<div class="license-members">${members.map(member => {
        const pending = Number(member.pending_license) && !Number(member.licensed);
        const isAdmin = member.license_type === 'admin' || member.role === 'owner';
        return `<div class="license-member"><div><strong>${esc(member.display_name || member.email)}</strong><small>${esc(member.email)}</small><small>${accountStatus(member)}</small></div><span class="role-badge">${isAdmin ? 'ADMIN' : 'USER'}</span><button class="license-toggle ${Number(member.licensed) ? 'on' : ''}" data-license-user="${member.user_id}" data-active="${Number(member.licensed) ? '1' : '0'}" ${pending || isAdmin ? 'disabled' : ''}>${pending ? t.pending : (Number(member.licensed) ? t.assigned : t.unassigned)}</button>${!isAdmin && Number(member.licensed) ? `<button class="license-transfer" data-transfer-user="${member.user_id}">${t.transfer}</button>` : ''}${member.user_status !== 'active' ? `<button class="license-invite" data-invite-user="${member.user_id}">${t.inviteAgain}</button>` : ''}${member.role === 'owner' ? '' : `<button class="license-remove" data-remove-user="${member.user_id}">${t.remove}</button>`}</div>`;
      }).join('')}</div></section>` : ''}
      ${pcCapabilityHtml()}`;

    root.querySelector('[data-billing]')?.addEventListener('click', async event => {
      event.currentTarget.disabled = true;
      try {
        const data = await api('/api/licensing/portal', { method: 'POST', body: '{}' });
        location.href = data.url;
      } catch (error) {
        alert(error.message);
        event.currentTarget.disabled = false;
      }
    });
    root.querySelector('[data-logout]')?.addEventListener('click', async () => {
      await api('/api/auth/logout', { method: 'POST', body: '{}' }).catch(() => {});
      location.href = fr ? '/login/' : '/en/login/';
    });
    root.querySelector('[data-revoke-others]')?.addEventListener('click', async event => {
      if (!confirm(fr ? 'Révoquer toutes les autres sessions Web de ce compte?' : 'Revoke all other web sessions for this account?')) return;
      event.currentTarget.disabled = true;
      try {
        const result = await api('/api/auth/sessions/revoke-others', { method: 'POST', body: '{}' });
        banner = fr ? `${result.revoked || 0} autre(s) session(s) révoquée(s).` : `${result.revoked || 0} other session(s) revoked.`;
        await loadSecurity();
        await refreshAuditIfManager();
        render();
      } catch (error) {
        alert(error.message);
        event.currentTarget.disabled = false;
      }
    });
    root.querySelectorAll('[data-revoke-session]').forEach(button => button.addEventListener('click', async () => {
      const session = security.sessions.find(item => Number(item.id) === Number(button.dataset.revokeSession));
      const message = session?.current
        ? (fr ? 'Déconnecter cette session maintenant?' : 'Sign out this session now?')
        : (fr ? 'Révoquer cette session Web?' : 'Revoke this web session?');
      if (!confirm(message)) return;
      button.disabled = true;
      try {
        const result = await api(`/api/auth/sessions/${button.dataset.revokeSession}/revoke`, { method: 'POST', body: '{}' });
        if (result.current) {
          location.href = fr ? '/login/' : '/en/login/';
          return;
        }
        banner = fr ? 'Session révoquée.' : 'Session revoked.';
        await loadSecurity();
        await refreshAuditIfManager();
        render();
      } catch (error) {
        alert(error.message);
        button.disabled = false;
      }
    }));
    root.querySelectorAll('[data-disconnect-device]').forEach(button => button.addEventListener('click', async () => {
      const device = security.devices.find(item => Number(item.id) === Number(button.dataset.disconnectDevice));
      const name = device?.name || (fr ? 'ce poste' : 'this device');
      if (!confirm(fr ? `Déconnecter ${name}? Navo2D/Navo3D seront verrouillés à leur prochain heartbeat.` : `Disconnect ${name}? Navo2D/Navo3D will be locked on their next heartbeat.`)) return;
      button.disabled = true;
      try {
        await api(`/api/licensing/devices/${button.dataset.disconnectDevice}/disconnect`, { method: 'POST', body: '{}' });
        banner = fr ? `${name} a été déconnecté.` : `${name} was disconnected.`;
        await loadSecurity();
        await refreshAuditIfManager();
        render();
      } catch (error) {
        alert(error.message);
        button.disabled = false;
      }
    }));
    root.querySelector('[data-add-member]')?.addEventListener('submit', async event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const email = String(data.get('email') || '').trim();
      const displayName = String(data.get('display_name') || '').trim();
      if (state.seats.available <= 0) {
        fastTrackDialog(email, displayName);
        return;
      }
      try {
        const result = await api('/api/licensing/members', { method: 'POST', body: JSON.stringify({ email, display_name: displayName }) });
        state = result.state;
        await refreshAuditIfManager();
        render();
        inviteDialog(result.invitation, email);
      } catch (error) {
        if (error.code === 'NO_SEAT_AVAILABLE') fastTrackDialog(email, displayName);
        else alert(error.message);
      }
    });
    root.querySelectorAll('[data-license-user]').forEach(button => button.addEventListener('click', async () => {
      const active = button.dataset.active !== '1';
      button.disabled = true;
      try {
        state = await api(`/api/licensing/members/${button.dataset.licenseUser}/license`, { method: 'POST', body: JSON.stringify({ active }) });
        await loadSecurity();
        await refreshAuditIfManager();
        render();
      } catch (error) {
        alert(error.message);
        button.disabled = false;
      }
    }));
    root.querySelectorAll('[data-transfer-user]').forEach(button => button.addEventListener('click', () => transferDialog(members.find(member => Number(member.user_id) === Number(button.dataset.transferUser)))));
    root.querySelectorAll('[data-invite-user]').forEach(button => button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        const result = await api(`/api/licensing/members/${button.dataset.inviteUser}/invite`, { method: 'POST', body: '{}' });
        state = result.state;
        await refreshAuditIfManager();
        render();
        const member = state.members.find(item => Number(item.user_id) === Number(button.dataset.inviteUser));
        inviteDialog(result.invitation, member?.email || '');
      } catch (error) {
        alert(error.message);
        button.disabled = false;
      }
    }));
    root.querySelectorAll('[data-remove-user]').forEach(button => button.addEventListener('click', async () => {
      if (!confirm(fr ? 'Retirer cet utilisateur de l’entreprise?' : 'Remove this user from the organization?')) return;
      button.disabled = true;
      try {
        state = await api(`/api/licensing/members/${button.dataset.removeUser}`, { method: 'DELETE' });
        await refreshAuditIfManager();
        render();
      } catch (error) {
        alert(error.message);
        button.disabled = false;
      }
    }));
    root.querySelector('[data-audit-toggle]')?.addEventListener('click', () => {
      audit.expanded = !audit.expanded;
      localStorage.setItem('navoflo_audit_expanded', audit.expanded ? '1' : '0');
      render();
    });
    root.querySelector('[data-audit-refresh]')?.addEventListener('click', async event => {
      event.currentTarget.disabled = true;
      await loadAudit();
      render();
    });
    root.querySelector('[data-audit-filters]')?.addEventListener('submit', async event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      audit.filters = {
        category:String(form.get('category') || ''),
        user_id:String(form.get('user_id') || ''),
        from:String(form.get('from') || ''),
        to:String(form.get('to') || '')
      };
      await loadAudit();
      render();
    });
    root.querySelector('[data-audit-reset]')?.addEventListener('click', async () => {
      audit.filters = { category:'', user_id:'', from:'', to:'' };
      await loadAudit();
      render();
    });
    root.querySelector('[data-audit-more]')?.addEventListener('click', async event => {
      event.currentTarget.disabled = true;
      await loadAudit({ append:true });
      render();
    });
  }

  function renderAccountFallback(error) {
    const noOrganization = error?.code === 'NO_ORGANIZATION';
    const title = noOrganization ? t.noOrg : (fr ? 'Impossible de charger le compte NavoFlo.' : 'Unable to load the NavoFlo account.');
    const description = noOrganization
      ? (fr ? 'Votre compte NavoFlo est toujours connecté, mais il n’est actuellement lié à aucune organisation active.' : 'Your NavoFlo account is still signed in, but it is not currently linked to an active organization.')
      : (error?.message || (fr ? 'Une erreur est survenue.' : 'An error occurred.'));
    root.innerHTML = `<section class="license-empty"><h1>${title}</h1><p>${esc(description)}</p><div class="license-empty-actions"><a class="button" href="${fr ? '/pricing/' : '/en/pricing/'}">${fr ? 'Voir les tarifs' : 'View pricing'}</a><button class="button secondary" type="button" data-fallback-logout>${t.logout}</button></div></section>`;
    root.querySelector('[data-fallback-logout]')?.addEventListener('click', async event => {
      event.currentTarget.disabled = true;
      await api('/api/auth/logout', { method: 'POST', body: '{}' }).catch(() => {});
      location.href = fr ? '/login/' : '/en/login/';
    });
  }

  root.textContent = t.loading;
  api('/api/licensing/me')
    .then(async data => {
      state = data;
      await Promise.all([loadSecurity(), refreshAuditIfManager()]);
      render();
    })
    .catch(error => {
      if (error.code === 'AUTH_REQUIRED') {
        location.href = (fr ? '/login/' : '/en/login/') + '?next=' + encodeURIComponent(location.pathname);
        return;
      }
      renderAccountFallback(error);
    });
})();
