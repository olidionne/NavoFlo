import { json, safeOrigin } from './stripe.js';

const SESSION_COOKIE = 'navoflo_session';
const SESSION_DAYS = 30;
const PASSWORD_RESET_TTL_MINUTES = 60;
const PASSWORD_RESET_COOLDOWN_SECONDS = 60;
const ACCOUNT_ACTIVATION_TTL_HOURS = 24;
const ACCOUNT_ACTIVATION_COOLDOWN_SECONDS = 60;
// Cloudflare Workers WebCrypto currently rejects PBKDF2 deriveBits calls above 100,000 iterations.
const PBKDF2_ITERATIONS = 100000;

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function bytesToBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value) {
  let s = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const binary = atob(s);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

export function randomToken(bytes = 32) {
  const out = new Uint8Array(bytes);
  crypto.getRandomValues(out);
  return bytesToBase64Url(out);
}

export async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value || '')));
  return bytesToBase64Url(new Uint8Array(digest));
}

async function pbkdf2(password, saltBytes, iterations = PBKDF2_ITERATIONS) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations }, key, 256
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password) {
  const value = String(password || '');
  if (value.length < 12) throw authError('Password must contain at least 12 characters.', 400, 'WEAK_PASSWORD');
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const hash = await pbkdf2(value, salt);
  return `pbkdf2_sha256$${PBKDF2_ITERATIONS}$${bytesToBase64Url(salt)}$${bytesToBase64Url(hash)}`;
}

export async function verifyPassword(password, encoded) {
  const [scheme, iterationsRaw, saltRaw, hashRaw] = String(encoded || '').split('$');
  if (scheme !== 'pbkdf2_sha256' || !iterationsRaw || !saltRaw || !hashRaw) return false;
  const iterations = Number(iterationsRaw);
  if (!Number.isInteger(iterations) || iterations !== PBKDF2_ITERATIONS) return false;
  const actual = await pbkdf2(String(password || ''), base64UrlToBytes(saltRaw), iterations);
  const expected = base64UrlToBytes(hashRaw);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

export function authError(message, status = 400, code = 'AUTH_ERROR') {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function cookieValue(request, name) {
  const raw = request.headers.get('cookie') || '';
  for (const part of raw.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    if (part.slice(0, index).trim() === name) return decodeURIComponent(part.slice(index + 1).trim());
  }
  return '';
}

function sessionCookie(token, request, env, maxAgeSeconds = SESSION_DAYS * 86400) {
  const url = new URL(request.url);
  const secure = url.protocol === 'https:';
  const domain = String(env?.NAVOFLO_COOKIE_DOMAIN || '').trim();
  return [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    secure ? 'Secure' : '',
    domain ? `Domain=${domain}` : '',
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`
  ].filter(Boolean).join('; ');
}

function clearSessionCookie(request, env) {
  return sessionCookie('', request, env, 0);
}

async function requestIpHash(request) {
  const ip = request.headers.get('cf-connecting-ip') || '';
  return ip ? sha256(ip) : null;
}

function escapeEmailHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[ch]));
}

async function sendTransactionalEmail(env, { to, subject, html }) {
  const apiKey = String(env?.RESEND_API_KEY || '').trim();
  const from = String(env?.NAVOFLO_FROM_EMAIL || '').trim();
  if (!apiKey || !from) return { sent:false, error:'Email delivery is not configured.' };
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method:'POST',
      headers:{ 'authorization':`Bearer ${apiKey}`, 'content-type':'application/json' },
      body:JSON.stringify({ from, to:[to], subject, html })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return { sent:false, error:`Email provider returned ${response.status}.` };
    return { sent:true, id:payload?.id || null };
  } catch (error) {
    return { sent:false, error:error?.message || 'Email delivery failed.' };
  }
}

export async function createSession(request, env, userId) {
  if (!env?.NAVOFLO_DB) throw authError('NavoFlo database is unavailable.', 503, 'DB_UNAVAILABLE');
  const rawToken = randomToken(32);
  const tokenHash = await sha256(rawToken);
  const expiry = new Date(Date.now() + SESSION_DAYS * 86400 * 1000).toISOString();
  await env.NAVOFLO_DB.prepare(`
    INSERT INTO auth_sessions (user_id, token_hash, expires_at, ip_hash, user_agent)
    VALUES (?, ?, ?, ?, ?)
  `).bind(
    userId, tokenHash, expiry,
    await requestIpHash(request),
    String(request.headers.get('user-agent') || '').slice(0, 500) || null
  ).run();
  return { token: rawToken, cookie: sessionCookie(rawToken, request, env), expires_at: expiry };
}

export async function sessionUser(request, env, { touch = true } = {}) {
  if (!env?.NAVOFLO_DB) return null;
  const token = cookieValue(request, SESSION_COOKIE);
  if (!token) return null;
  const tokenHash = await sha256(token);
  const row = await env.NAVOFLO_DB.prepare(`
    SELECT u.id, u.email, u.display_name, u.status, u.email_verified_at,
           s.id AS session_id, s.expires_at
    FROM auth_sessions s
    JOIN users u ON u.id=s.user_id
    WHERE s.token_hash=?
      AND s.revoked_at IS NULL
      AND datetime(s.expires_at) > datetime('now')
    LIMIT 1
  `).bind(tokenHash).first();
  if (!row) return null;
  if (touch) {
    await env.NAVOFLO_DB.batch([
      env.NAVOFLO_DB.prepare(`UPDATE auth_sessions SET last_seen_at=datetime('now') WHERE id=?`).bind(row.session_id),
      env.NAVOFLO_DB.prepare(`UPDATE users SET last_login_at=datetime('now'), updated_at=datetime('now') WHERE id=?`).bind(row.id)
    ]);
  }
  return row;
}

export async function identityEmail(request, env) {
  const user = await sessionUser(request, env);
  if (user?.email) return normalizeEmail(user.email);
  if (String(env?.NAVOFLO_DEV_ACCESS_FALLBACK || '').toLowerCase() === 'true') {
    return normalizeEmail(request.headers.get('cf-access-authenticated-user-email'));
  }
  return '';
}

export async function requireAuthUser(request, env) {
  const user = await sessionUser(request, env);
  if (!user) throw authError('Authentication required.', 401, 'AUTH_REQUIRED');
  if (user.status !== 'active') throw authError('This NavoFlo account is not active.', 403, 'ACCOUNT_INACTIVE');
  return user;
}

async function logAudit(env, row = {}) {
  if (!env?.NAVOFLO_DB) return;
  await env.NAVOFLO_DB.prepare(`
    INSERT INTO audit_log (organization_id, actor_user_id, action, target_user_id, details_json)
    VALUES (?, ?, ?, ?, ?)
  `).bind(
    row.organization_id || null,
    row.actor_user_id || null,
    row.action || 'auth.event',
    row.target_user_id || null,
    row.details ? JSON.stringify(row.details) : null
  ).run();
}

export async function login(request, env) {
  const body = await request.json().catch(() => ({}));
  const email = normalizeEmail(body.email);
  const password = String(body.password || '');
  if (!email || !password) throw authError('Email and password are required.', 400, 'MISSING_CREDENTIALS');

  const user = await env.NAVOFLO_DB.prepare(`
    SELECT id, email, display_name, password_hash, status, failed_login_count, locked_until
    FROM users WHERE email=? COLLATE NOCASE LIMIT 1
  `).bind(email).first();

  const generic = () => authError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
  if (!user || !user.password_hash) throw generic();
  if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
    throw authError('Too many failed attempts. Try again later.', 429, 'ACCOUNT_TEMPORARILY_LOCKED');
  }

  if (!(await verifyPassword(password, user.password_hash))) {
    const failures = Number(user.failed_login_count || 0) + 1;
    const lockedUntil = failures >= 10 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;
    await env.NAVOFLO_DB.prepare(`
      UPDATE users SET failed_login_count=?, locked_until=?, updated_at=datetime('now') WHERE id=?
    `).bind(failures >= 10 ? 0 : failures, lockedUntil, user.id).run();
    throw generic();
  }

  if (user.status !== 'active') throw authError('Your NavoFlo account has not been activated yet.', 403, 'ACCOUNT_NOT_ACTIVE');
  await env.NAVOFLO_DB.prepare(`
    UPDATE users SET failed_login_count=0, locked_until=NULL, last_login_at=datetime('now'), updated_at=datetime('now') WHERE id=?
  `).bind(user.id).run();
  const session = await createSession(request, env, user.id);
  await logAudit(env, {
    organization_id:await organizationIdForUser(env, user.id),
    actor_user_id:user.id,
    target_user_id:user.id,
    action:'auth.login'
  });
  return json({ ok: true, user: { id:user.id, email:user.email, display_name:user.display_name } }, 200, { 'set-cookie': session.cookie });
}

export async function logout(request, env) {
  const user = await sessionUser(request, env, { touch:false });
  const token = cookieValue(request, SESSION_COOKIE);
  if (token && env?.NAVOFLO_DB) {
    const tokenHash = await sha256(token);
    await env.NAVOFLO_DB.prepare(`UPDATE auth_sessions SET revoked_at=datetime('now') WHERE token_hash=?`).bind(tokenHash).run();
  }
  if (user) {
    await logAudit(env, {
      organization_id:await organizationIdForUser(env, user.id),
      actor_user_id:user.id,
      target_user_id:user.id,
      action:'auth.logout'
    });
  }
  return json({ ok: true }, 200, { 'set-cookie': clearSessionCookie(request, env) });
}

export async function authStatus(request, env) {
  const user = await sessionUser(request, env, { touch:false });
  return json({
    authenticated:Boolean(user),
    user:user ? { id:user.id,email:user.email,display_name:user.display_name,status:user.status } : null
  }, 200, { 'cache-control':'no-store' });
}

function accountActivationEmailHtml({ frUrl, enUrl, organizationName }) {
  const safeFrUrl = escapeEmailHtml(frUrl);
  const safeEnUrl = escapeEmailHtml(enUrl);
  const safeOrganization = escapeEmailHtml(organizationName || 'NavoFlo');
  return `<p>Merci pour votre abonnement NavoFlo.</p>
<p>Votre compte administrateur pour <strong>${safeOrganization}</strong> est prêt à être activé.</p>
<p><a href="${safeFrUrl}">Créer mon mot de passe NavoFlo</a></p>
<p>Ce lien expire dans ${ACCOUNT_ACTIVATION_TTL_HOURS} heures et ne peut être utilisé qu'une seule fois.</p>
<p>Si vous possédez déjà un compte NavoFlo avec ce courriel, vous pouvez simplement vous connecter.</p>
<hr>
<p>Thank you for subscribing to NavoFlo.</p>
<p>Your administrator account for <strong>${safeOrganization}</strong> is ready to activate.</p>
<p><a href="${safeEnUrl}">Create my NavoFlo password</a></p>
<p>This link expires in ${ACCOUNT_ACTIVATION_TTL_HOURS} hours and can only be used once.</p>
<p>If you already have a NavoFlo account with this email address, you can simply sign in.</p>`;
}

async function issueAccountActivation(request, env, { userId, email, organizationId = null, organizationName = null, source = 'manual' } = {}) {
  if (!env?.NAVOFLO_DB || !userId || !normalizeEmail(email)) return { sent:false, skipped:true, reason:'invalid_account' };
  if (!String(env?.RESEND_API_KEY || '').trim() || !String(env?.NAVOFLO_FROM_EMAIL || '').trim()) {
    return { sent:false, skipped:false, error:'Account activation email delivery is not configured.' };
  }

  const user = await env.NAVOFLO_DB.prepare(`
    SELECT id, email, password_hash, status FROM users WHERE id=? LIMIT 1
  `).bind(userId).first();
  if (!user || user.password_hash || user.status !== 'pending_setup') {
    return { sent:false, skipped:true, reason:user?.password_hash ? 'already_active' : 'account_unavailable' };
  }

  const recent = await env.NAVOFLO_DB.prepare(`
    SELECT id FROM account_activation_tokens
    WHERE user_id=?
      AND consumed_at IS NULL
      AND revoked_at IS NULL
      AND datetime(created_at) > datetime('now', '-' || ? || ' seconds')
    ORDER BY id DESC LIMIT 1
  `).bind(user.id, ACCOUNT_ACTIVATION_COOLDOWN_SECONDS).first();
  if (recent) return { sent:false, skipped:true, reason:'cooldown' };

  const rawToken = randomToken(32);
  const tokenHash = await sha256(rawToken);
  const expires = new Date(Date.now() + ACCOUNT_ACTIVATION_TTL_HOURS * 60 * 60 * 1000).toISOString();
  const ipHash = request ? await requestIpHash(request) : null;
  const userAgent = request ? String(request.headers.get('user-agent') || '').slice(0, 500) || null : null;

  await env.NAVOFLO_DB.batch([
    env.NAVOFLO_DB.prepare(`
      UPDATE account_activation_tokens
      SET revoked_at=COALESCE(revoked_at, datetime('now'))
      WHERE user_id=? AND consumed_at IS NULL AND revoked_at IS NULL
    `).bind(user.id),
    env.NAVOFLO_DB.prepare(`
      INSERT INTO account_activation_tokens (
        user_id, token_hash, expires_at, requested_ip_hash, user_agent
      ) VALUES (?, ?, ?, ?, ?)
    `).bind(user.id, tokenHash, expires, ipHash, userAgent)
  ]);

  const origin = request
    ? safeOrigin(request, env)
    : String(env?.PUBLIC_APP_URL || 'https://navoflo.com').replace(/\/$/, '');
  const frUrl = `${origin}/auth/setup/?token=${encodeURIComponent(rawToken)}`;
  const enUrl = `${origin}/en/auth/setup/?token=${encodeURIComponent(rawToken)}`;
  const emailResult = await sendTransactionalEmail(env, {
    to:user.email,
    subject:'Activez votre compte administrateur NavoFlo / Activate your NavoFlo admin account',
    html:accountActivationEmailHtml({ frUrl, enUrl, organizationName })
  });

  if (!emailResult.sent) {
    await env.NAVOFLO_DB.prepare(`
      UPDATE account_activation_tokens SET revoked_at=datetime('now') WHERE token_hash=?
    `).bind(tokenHash).run();
    await logAudit(env, {
      organization_id:organizationId || null,
      target_user_id:user.id,
      action:'auth.activation_email_failed',
      details:{ source, reason:emailResult.error || 'email_delivery_failed' }
    });
    return { sent:false, skipped:false, error:emailResult.error || 'Email delivery failed.' };
  }

  await logAudit(env, {
    organization_id:organizationId || null,
    target_user_id:user.id,
    action:'auth.activation_email_sent',
    details:{ source, email_provider:'resend' }
  });
  return { sent:true, skipped:false, expires_at:expires };
}

export async function sendBillingOwnerActivation(request, env, { userId, email, organizationId = null, organizationName = null } = {}) {
  return issueAccountActivation(request, env, {
    userId, email, organizationId, organizationName, source:'stripe_checkout'
  });
}

export async function requestAccountActivation(request, env) {
  if (!env?.NAVOFLO_DB) throw authError('NavoFlo database is unavailable.', 503, 'DB_UNAVAILABLE');
  if (!String(env?.RESEND_API_KEY || '').trim() || !String(env?.NAVOFLO_FROM_EMAIL || '').trim()) {
    throw authError('Account activation email delivery is not configured.', 503, 'EMAIL_NOT_CONFIGURED');
  }
  const body = await request.json().catch(() => ({}));
  const email = normalizeEmail(body.email);
  if (!email || email.length > 320 || !/^\S+@\S+\.\S+$/.test(email)) {
    throw authError('A valid email address is required.', 400, 'INVALID_EMAIL');
  }

  const response = () => json({ ok:true }, 200, { 'cache-control':'no-store' });
  const row = await env.NAVOFLO_DB.prepare(`
    SELECT u.id, u.email, u.password_hash, u.status,
      m.organization_id, o.name AS organization_name
    FROM users u
    JOIN memberships m ON m.user_id=u.id AND m.active=1 AND m.role='owner'
    JOIN organizations o ON o.id=m.organization_id
    WHERE u.email=? COLLATE NOCASE
    ORDER BY m.id LIMIT 1
  `).bind(email).first();
  if (!row || row.password_hash || row.status !== 'pending_setup') return response();

  await issueAccountActivation(request, env, {
    userId:row.id,
    email:row.email,
    organizationId:row.organization_id,
    organizationName:row.organization_name,
    source:'activation_resend'
  });
  return response();
}

export async function accountActivationInfo(request, env) {
  if (!env?.NAVOFLO_DB) throw authError('NavoFlo database is unavailable.', 503, 'DB_UNAVAILABLE');
  const token = new URL(request.url).searchParams.get('token') || '';
  if (!token) throw authError('Account activation token is required.', 400, 'ACTIVATION_TOKEN_REQUIRED');
  const tokenHash = await sha256(token);
  const row = await env.NAVOFLO_DB.prepare(`
    SELECT a.expires_at, u.email, u.display_name, o.name AS organization_name
    FROM account_activation_tokens a
    JOIN users u ON u.id=a.user_id
    LEFT JOIN memberships m ON m.user_id=u.id AND m.active=1 AND m.role='owner'
    LEFT JOIN organizations o ON o.id=m.organization_id
    WHERE a.token_hash=?
      AND a.consumed_at IS NULL
      AND a.revoked_at IS NULL
      AND datetime(a.expires_at) > datetime('now')
      AND u.password_hash IS NULL
      AND u.status='pending_setup'
    ORDER BY m.id LIMIT 1
  `).bind(tokenHash).first();
  if (!row) throw authError('This account activation link is invalid or expired.', 410, 'ACTIVATION_TOKEN_EXPIRED');
  return json({
    valid:true,
    email:row.email,
    display_name:row.display_name || null,
    organization_name:row.organization_name || 'NavoFlo',
    expires_at:row.expires_at
  }, 200, { 'cache-control':'no-store' });
}

export async function activateAccount(request, env) {
  if (!env?.NAVOFLO_DB) throw authError('NavoFlo database is unavailable.', 503, 'DB_UNAVAILABLE');
  const body = await request.json().catch(() => ({}));
  const token = String(body.token || '');
  if (!token) throw authError('Account activation token is required.', 400, 'ACTIVATION_TOKEN_REQUIRED');
  const tokenHash = await sha256(token);
  const activation = await env.NAVOFLO_DB.prepare(`
    SELECT a.id, a.user_id, a.expires_at, u.email, u.password_hash, u.status,
      (SELECT m.organization_id FROM memberships m WHERE m.user_id=u.id AND m.active=1 AND m.role='owner' ORDER BY m.id LIMIT 1) AS organization_id
    FROM account_activation_tokens a
    JOIN users u ON u.id=a.user_id
    WHERE a.token_hash=?
      AND a.consumed_at IS NULL
      AND a.revoked_at IS NULL
      AND datetime(a.expires_at) > datetime('now')
      AND u.password_hash IS NULL
      AND u.status='pending_setup'
    LIMIT 1
  `).bind(tokenHash).first();
  if (!activation) throw authError('This account activation link is invalid or expired.', 410, 'ACTIVATION_TOKEN_EXPIRED');

  const passwordHash = await hashPassword(body.password);
  await env.NAVOFLO_DB.batch([
    env.NAVOFLO_DB.prepare(`
      UPDATE users SET password_hash=?, status='active', failed_login_count=0, locked_until=NULL,
        email_verified_at=COALESCE(email_verified_at, datetime('now')),
        activated_at=COALESCE(activated_at, datetime('now')), updated_at=datetime('now')
      WHERE id=?
    `).bind(passwordHash, activation.user_id),
    env.NAVOFLO_DB.prepare(`UPDATE account_activation_tokens SET consumed_at=datetime('now') WHERE id=?`).bind(activation.id),
    env.NAVOFLO_DB.prepare(`
      UPDATE account_activation_tokens
      SET revoked_at=COALESCE(revoked_at, datetime('now'))
      WHERE user_id=? AND id<>? AND consumed_at IS NULL AND revoked_at IS NULL
    `).bind(activation.user_id, activation.id),
    env.NAVOFLO_DB.prepare(`UPDATE auth_sessions SET revoked_at=datetime('now') WHERE user_id=? AND revoked_at IS NULL`).bind(activation.user_id)
  ]);

  const session = await createSession(request, env, activation.user_id);
  await logAudit(env, {
    organization_id:activation.organization_id || null,
    actor_user_id:activation.user_id,
    target_user_id:activation.user_id,
    action:'auth.activation_completed',
    details:{ source:'stripe_checkout' }
  });
  return json({ ok:true }, 200, { 'set-cookie':session.cookie, 'cache-control':'no-store' });
}


function passwordResetEmailHtml(url) {
  const safeUrl = escapeEmailHtml(url);
  return `<p>Une demande de réinitialisation du mot de passe NavoFlo a été reçue.</p>
<p><a href="${safeUrl}">Réinitialiser mon mot de passe</a></p>
<p>Ce lien expire dans ${PASSWORD_RESET_TTL_MINUTES} minutes et ne peut être utilisé qu'une seule fois.</p>
<p>Si vous n'avez pas fait cette demande, vous pouvez ignorer ce courriel.</p>
<hr>
<p>A NavoFlo password reset was requested for your account.</p>
<p><a href="${safeUrl}">Reset my password</a></p>
<p>This link expires in ${PASSWORD_RESET_TTL_MINUTES} minutes and can only be used once.</p>
<p>If you did not request this, you can ignore this email.</p>`;
}

export async function requestPasswordReset(request, env) {
  if (!env?.NAVOFLO_DB) throw authError('NavoFlo database is unavailable.', 503, 'DB_UNAVAILABLE');
  if (!String(env?.RESEND_API_KEY || '').trim() || !String(env?.NAVOFLO_FROM_EMAIL || '').trim()) {
    throw authError('Password reset email delivery is not configured.', 503, 'EMAIL_NOT_CONFIGURED');
  }

  const body = await request.json().catch(() => ({}));
  const email = normalizeEmail(body.email);
  if (!email || email.length > 320 || !/^\S+@\S+\.\S+$/.test(email)) {
    throw authError('A valid email address is required.', 400, 'INVALID_EMAIL');
  }

  // Always return the same public response whether the account exists or not.
  const response = () => json({ ok:true }, 200, { 'cache-control':'no-store' });
  const user = await env.NAVOFLO_DB.prepare(`
    SELECT u.id, u.email, u.status, u.password_hash,
      (SELECT m.organization_id FROM memberships m WHERE m.user_id=u.id AND m.active=1 ORDER BY m.id LIMIT 1) AS organization_id
    FROM users u
    WHERE u.email=? COLLATE NOCASE
    LIMIT 1
  `).bind(email).first();

  if (!user || user.status !== 'active' || !user.password_hash) return response();

  const recent = await env.NAVOFLO_DB.prepare(`
    SELECT id FROM password_reset_tokens
    WHERE user_id=?
      AND consumed_at IS NULL
      AND revoked_at IS NULL
      AND datetime(created_at) > datetime('now', '-' || ? || ' seconds')
    ORDER BY id DESC LIMIT 1
  `).bind(user.id, PASSWORD_RESET_COOLDOWN_SECONDS).first();
  if (recent) return response();

  const rawToken = randomToken(32);
  const tokenHash = await sha256(rawToken);
  const expires = new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000).toISOString();

  await env.NAVOFLO_DB.batch([
    env.NAVOFLO_DB.prepare(`
      UPDATE password_reset_tokens
      SET revoked_at=COALESCE(revoked_at, datetime('now'))
      WHERE user_id=? AND consumed_at IS NULL AND revoked_at IS NULL
    `).bind(user.id),
    env.NAVOFLO_DB.prepare(`
      INSERT INTO password_reset_tokens (
        user_id, token_hash, expires_at, requested_ip_hash, user_agent
      ) VALUES (?, ?, ?, ?, ?)
    `).bind(
      user.id,
      tokenHash,
      expires,
      await requestIpHash(request),
      String(request.headers.get('user-agent') || '').slice(0, 500) || null
    )
  ]);

  const origin = safeOrigin(request, env);
  const url = `${origin}/reset-password/?token=${encodeURIComponent(rawToken)}`;
  const emailResult = await sendTransactionalEmail(env, {
    to:user.email,
    subject:'Réinitialisation du mot de passe NavoFlo / NavoFlo password reset',
    html:passwordResetEmailHtml(url)
  });

  if (!emailResult.sent) {
    await env.NAVOFLO_DB.prepare(`
      UPDATE password_reset_tokens SET revoked_at=datetime('now') WHERE token_hash=?
    `).bind(tokenHash).run();
    await logAudit(env, {
      organization_id:user.organization_id || null,
      target_user_id:user.id,
      action:'auth.password_reset_email_failed',
      details:{ reason:emailResult.error || 'email_delivery_failed' }
    });
    return response();
  }

  await logAudit(env, {
    organization_id:user.organization_id || null,
    target_user_id:user.id,
    action:'auth.password_reset_requested',
    details:{ email_provider:'resend' }
  });
  return response();
}

export async function passwordResetInfo(request, env) {
  if (!env?.NAVOFLO_DB) throw authError('NavoFlo database is unavailable.', 503, 'DB_UNAVAILABLE');
  const token = new URL(request.url).searchParams.get('token') || '';
  if (!token) throw authError('Password reset token is required.', 400, 'RESET_TOKEN_REQUIRED');
  const tokenHash = await sha256(token);
  const row = await env.NAVOFLO_DB.prepare(`
    SELECT pr.expires_at
    FROM password_reset_tokens pr
    JOIN users u ON u.id=pr.user_id
    WHERE pr.token_hash=?
      AND pr.consumed_at IS NULL
      AND pr.revoked_at IS NULL
      AND datetime(pr.expires_at) > datetime('now')
      AND u.status='active'
    LIMIT 1
  `).bind(tokenHash).first();
  if (!row) throw authError('This password reset link is invalid or expired.', 410, 'RESET_TOKEN_EXPIRED');
  return json({ valid:true, expires_at:row.expires_at }, 200, { 'cache-control':'no-store' });
}

export async function resetPassword(request, env) {
  if (!env?.NAVOFLO_DB) throw authError('NavoFlo database is unavailable.', 503, 'DB_UNAVAILABLE');
  const body = await request.json().catch(() => ({}));
  const token = String(body.token || '');
  if (!token) throw authError('Password reset token is required.', 400, 'RESET_TOKEN_REQUIRED');

  const tokenHash = await sha256(token);
  const reset = await env.NAVOFLO_DB.prepare(`
    SELECT pr.id, pr.user_id, pr.expires_at, u.email, u.status,
      (SELECT m.organization_id FROM memberships m WHERE m.user_id=u.id AND m.active=1 ORDER BY m.id LIMIT 1) AS organization_id
    FROM password_reset_tokens pr
    JOIN users u ON u.id=pr.user_id
    WHERE pr.token_hash=?
      AND pr.consumed_at IS NULL
      AND pr.revoked_at IS NULL
      AND datetime(pr.expires_at) > datetime('now')
      AND u.status='active'
    LIMIT 1
  `).bind(tokenHash).first();
  if (!reset) throw authError('This password reset link is invalid or expired.', 410, 'RESET_TOKEN_EXPIRED');

  const passwordHash = await hashPassword(body.password);
  await env.NAVOFLO_DB.batch([
    env.NAVOFLO_DB.prepare(`
      UPDATE users
      SET password_hash=?, failed_login_count=0, locked_until=NULL, updated_at=datetime('now')
      WHERE id=?
    `).bind(passwordHash, reset.user_id),
    env.NAVOFLO_DB.prepare(`
      UPDATE password_reset_tokens SET consumed_at=datetime('now') WHERE id=?
    `).bind(reset.id),
    env.NAVOFLO_DB.prepare(`
      UPDATE password_reset_tokens
      SET revoked_at=COALESCE(revoked_at, datetime('now'))
      WHERE user_id=? AND id<>? AND consumed_at IS NULL AND revoked_at IS NULL
    `).bind(reset.user_id, reset.id),
    env.NAVOFLO_DB.prepare(`
      UPDATE auth_sessions SET revoked_at=datetime('now') WHERE user_id=? AND revoked_at IS NULL
    `).bind(reset.user_id),
    env.NAVOFLO_DB.prepare(`
      UPDATE app_leases SET revoked_at=datetime('now') WHERE user_id=? AND revoked_at IS NULL
    `).bind(reset.user_id)
  ]);

  await logAudit(env, {
    organization_id:reset.organization_id || null,
    actor_user_id:reset.user_id,
    target_user_id:reset.user_id,
    action:'auth.password_reset_completed'
  });
  return json({ ok:true }, 200, { 'set-cookie':clearSessionCookie(request, env), 'cache-control':'no-store' });
}

export async function createInvitation(env, { organizationId, userId, email, createdByUserId, request } = {}) {
  const normalized = normalizeEmail(email);
  if (!env?.NAVOFLO_DB || !organizationId || !userId || !normalized) throw authError('Unable to create invitation.', 500, 'INVITE_CREATE_FAILED');
  await env.NAVOFLO_DB.prepare(`
    UPDATE invitations SET accepted_at=COALESCE(accepted_at, datetime('now'))
    WHERE organization_id=? AND email=? COLLATE NOCASE AND accepted_at IS NULL
  `).bind(organizationId, normalized).run();
  const rawToken = randomToken(32);
  const tokenHash = await sha256(rawToken);
  const expires = new Date(Date.now() + 7 * 86400 * 1000).toISOString();
  await env.NAVOFLO_DB.prepare(`
    INSERT INTO invitations (organization_id, user_id, email, token_hash, created_by_user_id, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(organizationId, userId, normalized, tokenHash, createdByUserId || null, expires).run();
  const origin = request ? safeOrigin(request, env) : String(env?.PUBLIC_APP_URL || 'https://navoflo.com').replace(/\/$/, '');
  const url = `${origin}/invite/accept/?token=${encodeURIComponent(rawToken)}`;
  const emailResult = await sendInvitationEmail(env, { to:normalized, url });
  await logAudit(env, { organization_id:organizationId, actor_user_id:createdByUserId, action:'member.invited', target_user_id:userId, details:{ email_sent:emailResult.sent } });
  return { url, expires_at:expires, email_sent:emailResult.sent, email_error:emailResult.error || null };
}

async function sendInvitationEmail(env, { to, url }) {
  const safeUrl = escapeEmailHtml(url);
  return sendTransactionalEmail(env, {
    to,
    subject:'Invitation NavoFlo',
    html:`<p>Vous avez été invité à rejoindre une organisation NavoFlo.</p><p><a href="${safeUrl}">Créer votre compte NavoFlo</a></p><p>Ce lien expire dans 7 jours.</p><hr><p>You have been invited to join a NavoFlo organization.</p><p><a href="${safeUrl}">Create your NavoFlo account</a></p><p>This link expires in 7 days.</p>`
  });
}

export async function invitationInfo(request, env) {
  const token = new URL(request.url).searchParams.get('token') || '';
  if (!token) throw authError('Invitation token is required.', 400, 'INVITE_TOKEN_REQUIRED');
  const tokenHash = await sha256(token);
  const row = await env.NAVOFLO_DB.prepare(`
    SELECT i.email, i.expires_at, i.accepted_at, o.name AS organization_name, u.display_name, CASE WHEN u.password_hash IS NULL THEN 0 ELSE 1 END AS has_account
    FROM invitations i
    JOIN organizations o ON o.id=i.organization_id
    JOIN users u ON u.id=i.user_id
    WHERE i.token_hash=? LIMIT 1
  `).bind(tokenHash).first();
  if (!row || row.accepted_at || new Date(row.expires_at).getTime() <= Date.now()) throw authError('This invitation is invalid or expired.', 410, 'INVITE_EXPIRED');
  return json({ email:row.email, display_name:row.display_name, organization_name:row.organization_name, expires_at:row.expires_at, has_account:Boolean(row.has_account) });
}

export async function acceptInvitation(request, env) {
  const body = await request.json().catch(() => ({}));
  const token = String(body.token || '');
  if (!token) throw authError('Invitation token is required.', 400, 'INVITE_TOKEN_REQUIRED');
  const tokenHash = await sha256(token);
  const invite = await env.NAVOFLO_DB.prepare(`
    SELECT i.*, u.password_hash FROM invitations i
    JOIN users u ON u.id=i.user_id
    WHERE i.token_hash=? LIMIT 1
  `).bind(tokenHash).first();
  if (!invite || invite.accepted_at || new Date(invite.expires_at).getTime() <= Date.now()) throw authError('This invitation is invalid or expired.', 410, 'INVITE_EXPIRED');
  const displayName = String(body.display_name || '').trim() || null;
  let session;
  if (invite.password_hash) {
    const current = await sessionUser(request, env, { touch:false });
    if (!current || Number(current.id) !== Number(invite.user_id)) {
      throw authError('This email already has a NavoFlo account. Sign in first, then reopen the invitation link.', 409, 'EXISTING_ACCOUNT_LOGIN_REQUIRED');
    }
    await env.NAVOFLO_DB.batch([
      env.NAVOFLO_DB.prepare(`UPDATE users SET display_name=COALESCE(?, display_name), updated_at=datetime('now') WHERE id=?`).bind(displayName, invite.user_id),
      env.NAVOFLO_DB.prepare(`UPDATE invitations SET accepted_at=datetime('now') WHERE id=?`).bind(invite.id)
    ]);
    session = { cookie: null };
  } else {
    const passwordHash = await hashPassword(body.password);
    await env.NAVOFLO_DB.batch([
      env.NAVOFLO_DB.prepare(`
        UPDATE users SET password_hash=?, display_name=COALESCE(?, display_name), status='active',
          email_verified_at=COALESCE(email_verified_at, datetime('now')),
          activated_at=COALESCE(activated_at, datetime('now')), updated_at=datetime('now') WHERE id=?
      `).bind(passwordHash, displayName, invite.user_id),
      env.NAVOFLO_DB.prepare(`UPDATE invitations SET accepted_at=datetime('now') WHERE id=?`).bind(invite.id)
    ]);
    session = await createSession(request, env, invite.user_id);
  }
  await logAudit(env, { organization_id:invite.organization_id, actor_user_id:invite.user_id, action:'member.invitation_accepted', target_user_id:invite.user_id });
  return session.cookie ? json({ ok:true }, 200, { 'set-cookie':session.cookie }) : json({ ok:true });
}

async function organizationIdForUser(env, userId) {
  if (!env?.NAVOFLO_DB || !userId) return null;
  const row = await env.NAVOFLO_DB.prepare(`
    SELECT organization_id FROM memberships
    WHERE user_id=? AND active=1
    ORDER BY CASE role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, id
    LIMIT 1
  `).bind(userId).first();
  return row?.organization_id || null;
}

export async function accountSessions(request, env) {
  const user = await requireAuthUser(request, env);
  const result = await env.NAVOFLO_DB.prepare(`
    SELECT id, created_at, last_seen_at, expires_at, user_agent
    FROM auth_sessions
    WHERE user_id=?
      AND revoked_at IS NULL
      AND datetime(expires_at) > datetime('now')
    ORDER BY CASE WHEN id=? THEN 0 ELSE 1 END, datetime(last_seen_at) DESC, id DESC
  `).bind(user.id, user.session_id).all();
  const sessions = (result.results || []).map(row => ({
    id:Number(row.id),
    created_at:row.created_at,
    last_seen_at:row.last_seen_at,
    expires_at:row.expires_at,
    user_agent:row.user_agent || null,
    current:Number(row.id) === Number(user.session_id)
  }));
  return json({ sessions }, 200, { 'cache-control':'no-store' });
}

export async function revokeAccountSession(request, env, sessionId) {
  const user = await requireAuthUser(request, env);
  const id = Number(sessionId);
  if (!Number.isInteger(id) || id <= 0) throw authError('Invalid session.', 400, 'INVALID_SESSION');
  const row = await env.NAVOFLO_DB.prepare(`
    SELECT id FROM auth_sessions
    WHERE id=? AND user_id=? AND revoked_at IS NULL AND datetime(expires_at)>datetime('now')
    LIMIT 1
  `).bind(id, user.id).first();
  if (!row) throw authError('Session not found.', 404, 'SESSION_NOT_FOUND');
  await env.NAVOFLO_DB.prepare(`UPDATE auth_sessions SET revoked_at=datetime('now') WHERE id=? AND user_id=?`).bind(id, user.id).run();
  const current = Number(id) === Number(user.session_id);
  await logAudit(env, {
    organization_id:await organizationIdForUser(env, user.id),
    actor_user_id:user.id,
    target_user_id:user.id,
    action:'auth.session_revoked',
    details:{ session_id:id, current }
  });
  return json({ ok:true, current }, 200, current ? { 'set-cookie':clearSessionCookie(request, env), 'cache-control':'no-store' } : { 'cache-control':'no-store' });
}

export async function revokeOtherAccountSessions(request, env) {
  const user = await requireAuthUser(request, env);
  const result = await env.NAVOFLO_DB.prepare(`
    UPDATE auth_sessions SET revoked_at=datetime('now')
    WHERE user_id=? AND id<>? AND revoked_at IS NULL AND datetime(expires_at)>datetime('now')
  `).bind(user.id, user.session_id).run();
  const count = Number(result?.meta?.changes || 0);
  await logAudit(env, {
    organization_id:await organizationIdForUser(env, user.id),
    actor_user_id:user.id,
    target_user_id:user.id,
    action:'auth.other_sessions_revoked',
    details:{ count }
  });
  return json({ ok:true, revoked:count }, 200, { 'cache-control':'no-store' });
}

export async function revokeAllUserSessions(env, userId) {
  if (!env?.NAVOFLO_DB || !userId) return;
  await env.NAVOFLO_DB.batch([
    env.NAVOFLO_DB.prepare(`UPDATE auth_sessions SET revoked_at=datetime('now') WHERE user_id=? AND revoked_at IS NULL`).bind(userId),
    env.NAVOFLO_DB.prepare(`UPDATE app_leases SET revoked_at=datetime('now') WHERE user_id=? AND revoked_at IS NULL`).bind(userId)
  ]);
}

export function authJsonError(error) {
  return json({ error:error.message || 'Authentication request failed.', code:error.code || 'AUTH_ERROR' }, error.status || 500, { 'cache-control':'no-store' });
}

