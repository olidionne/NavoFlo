import { json, safeOrigin } from './stripe.js';

const SESSION_COOKIE = 'navoflo_session';
const SESSION_DAYS = 30;
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
  await logAudit(env, { actor_user_id: user.id, action: 'auth.login' });
  return json({ ok: true, user: { id:user.id, email:user.email, display_name:user.display_name } }, 200, { 'set-cookie': session.cookie });
}

export async function logout(request, env) {
  const token = cookieValue(request, SESSION_COOKIE);
  if (token && env?.NAVOFLO_DB) {
    const tokenHash = await sha256(token);
    await env.NAVOFLO_DB.prepare(`UPDATE auth_sessions SET revoked_at=datetime('now') WHERE token_hash=?`).bind(tokenHash).run();
  }
  return json({ ok: true }, 200, { 'set-cookie': clearSessionCookie(request, env) });
}

export async function authStatus(request, env) {
  const user = await sessionUser(request, env, { touch:false });
  const accessEmail = normalizeEmail(request.headers.get('cf-access-authenticated-user-email'));
  let bootstrap = false;
  if (!user && accessEmail && env?.NAVOFLO_DB) {
    const row = await env.NAVOFLO_DB.prepare(`SELECT password_hash FROM users WHERE email=? COLLATE NOCASE LIMIT 1`).bind(accessEmail).first();
    bootstrap = Boolean(row && !row.password_hash);
  }
  return json({ authenticated:Boolean(user), user:user ? { id:user.id,email:user.email,display_name:user.display_name,status:user.status } : null, bootstrap_available:bootstrap, access_email:bootstrap ? accessEmail : null });
}

export async function bootstrapAccount(request, env) {
  const accessEmail = normalizeEmail(request.headers.get('cf-access-authenticated-user-email'));
  if (!accessEmail) throw authError('Cloudflare Access identity is required for initial account setup.', 401, 'ACCESS_REQUIRED');
  const body = await request.json().catch(() => ({}));
  const passwordHash = await hashPassword(body.password);
  const user = await env.NAVOFLO_DB.prepare(`
    SELECT id, email, password_hash FROM users WHERE email=? COLLATE NOCASE LIMIT 1
  `).bind(accessEmail).first();
  if (!user) throw authError('No NavoFlo account is linked to this Cloudflare Access identity.', 404, 'ACCOUNT_NOT_FOUND');
  if (user.password_hash) throw authError('This NavoFlo account already has a password.', 409, 'PASSWORD_ALREADY_SET');
  await env.NAVOFLO_DB.prepare(`
    UPDATE users SET password_hash=?, status='active', email_verified_at=COALESCE(email_verified_at, datetime('now')),
      activated_at=COALESCE(activated_at, datetime('now')), updated_at=datetime('now') WHERE id=?
  `).bind(passwordHash, user.id).run();
  const session = await createSession(request, env, user.id);
  await logAudit(env, { actor_user_id:user.id, action:'auth.bootstrap' });
  return session.cookie ? json({ ok:true }, 200, { 'set-cookie':session.cookie }) : json({ ok:true });
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
  const apiKey = String(env?.RESEND_API_KEY || '');
  const from = String(env?.NAVOFLO_FROM_EMAIL || '');
  if (!apiKey || !from) return { sent:false, error:'Email delivery is not configured.' };
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method:'POST',
      headers:{ 'authorization':`Bearer ${apiKey}`, 'content-type':'application/json' },
      body:JSON.stringify({
        from, to:[to], subject:'Invitation NavoFlo',
        html:`<p>Vous avez été invité à rejoindre une organisation NavoFlo.</p><p><a href="${url}">Créer votre compte NavoFlo</a></p><p>Ce lien expire dans 7 jours.</p>`
      })
    });
    if (!response.ok) return { sent:false, error:`Email provider returned ${response.status}.` };
    return { sent:true };
  } catch (error) {
    return { sent:false, error:error?.message || 'Email delivery failed.' };
  }
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

export async function revokeAllUserSessions(env, userId) {
  if (!env?.NAVOFLO_DB || !userId) return;
  await env.NAVOFLO_DB.batch([
    env.NAVOFLO_DB.prepare(`UPDATE auth_sessions SET revoked_at=datetime('now') WHERE user_id=? AND revoked_at IS NULL`).bind(userId),
    env.NAVOFLO_DB.prepare(`UPDATE app_leases SET revoked_at=datetime('now') WHERE user_id=? AND revoked_at IS NULL`).bind(userId)
  ]);
}

export function authJsonError(error) {
  return json({ error:error.message || 'Authentication request failed.', code:error.code || 'AUTH_ERROR' }, error.status || 500);
}
