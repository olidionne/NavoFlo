const DEFAULT_MAX_API_BODY = 64 * 1024;

function secError(message, status = 400, code = 'SECURITY_ERROR', retryAfter = null) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  if (retryAfter != null) error.retryAfter = Math.max(1, Math.ceil(Number(retryAfter) || 1));
  return error;
}

async function digest(value) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value || ''))));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function requestIp(request) {
  return String(request?.headers?.get('cf-connecting-ip') || request?.headers?.get('x-forwarded-for') || '').split(',')[0].trim();
}

function isoAfter(seconds) {
  return new Date(Date.now() + Math.max(1, Number(seconds) || 1) * 1000).toISOString();
}

export function apiBodyTooLarge(request, maxBytes = DEFAULT_MAX_API_BODY) {
  const raw = request.headers.get('content-length');
  if (!raw) return false;
  const size = Number(raw);
  return Number.isFinite(size) && size > maxBytes;
}

export function assertTrustedMutation(request) {
  const method = String(request.method || 'GET').toUpperCase();
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return;

  const url = new URL(request.url);
  const origin = request.headers.get('origin');
  if (origin) {
    let parsed;
    try { parsed = new URL(origin); } catch { throw secError('Untrusted request origin.', 403, 'UNTRUSTED_ORIGIN'); }
    if (parsed.origin !== url.origin) throw secError('Untrusted request origin.', 403, 'UNTRUSTED_ORIGIN');
  }

  const fetchSite = String(request.headers.get('sec-fetch-site') || '').toLowerCase();
  if (fetchSite === 'cross-site') throw secError('Cross-site request blocked.', 403, 'CROSS_SITE_BLOCKED');
}

export async function enforceRateLimit(request, env, scope, {
  identity = '',
  limit = 20,
  windowSeconds = 900,
  blockSeconds = windowSeconds
} = {}) {
  if (!env?.NAVOFLO_DB) return;
  const ip = requestIp(request) || 'unknown';
  const bucketHash = await digest(`${ip}|${String(identity || '').trim().toLowerCase()}`);
  const bucket = `${String(scope || 'request').slice(0, 80)}:${bucketHash}`;
  const now = Date.now();

  let row;
  try {
    row = await env.NAVOFLO_DB.prepare(`
      SELECT hit_count, window_started_at, blocked_until
      FROM security_rate_limits WHERE bucket=? LIMIT 1
    `).bind(bucket).first();
  } catch (error) {
    // A missing 0009 migration must not take the entire production login path down.
    console.warn('[NavoFlo security] rate-limit table unavailable', error?.message || error);
    return;
  }

  if (row?.blocked_until) {
    const until = new Date(row.blocked_until).getTime();
    if (Number.isFinite(until) && until > now) {
      throw secError('Too many requests. Try again later.', 429, 'RATE_LIMITED', (until - now) / 1000);
    }
  }

  const windowStart = row?.window_started_at ? new Date(row.window_started_at).getTime() : 0;
  const expired = !Number.isFinite(windowStart) || now - windowStart >= Number(windowSeconds) * 1000;
  const nextCount = expired ? 1 : Number(row?.hit_count || 0) + 1;
  const nextWindow = expired ? new Date(now).toISOString() : row.window_started_at;
  const over = nextCount > Math.max(1, Number(limit) || 1);
  const blockedUntil = over ? isoAfter(blockSeconds) : null;

  try {
    await env.NAVOFLO_DB.prepare(`
      INSERT INTO security_rate_limits (bucket, hit_count, window_started_at, blocked_until, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(bucket) DO UPDATE SET
        hit_count=excluded.hit_count,
        window_started_at=excluded.window_started_at,
        blocked_until=excluded.blocked_until,
        updated_at=datetime('now')
    `).bind(bucket, nextCount, nextWindow, blockedUntil).run();
  } catch (error) {
    console.warn('[NavoFlo security] unable to update rate limit', error?.message || error);
    return;
  }

  if (over) throw secError('Too many requests. Try again later.', 429, 'RATE_LIMITED', blockSeconds);
}

function cleanupStatement(env, sql) {
  return env.NAVOFLO_DB.prepare(sql);
}

export async function runSecurityMaintenance(env) {
  if (!env?.NAVOFLO_DB) return { ok:false, reason:'db_unavailable' };
  const configuredIdle = Number(env?.NAVOFLO_SESSION_IDLE_HOURS);
  const idleHours = Math.max(1, Math.min(720, Number.isFinite(configuredIdle) ? configuredIdle : 168));
  // Keep a small grace period for diagnostics, then physically remove sessions that can no longer authenticate.
  const idleCleanupHours = idleHours + 24;
  const statements = [
    cleanupStatement(env, `DELETE FROM auth_sessions
      WHERE datetime(expires_at)<=datetime('now')
         OR (revoked_at IS NOT NULL AND datetime(revoked_at)<datetime('now','-14 days'))
         OR datetime(last_seen_at)<datetime('now','-${idleCleanupHours} hours')`),
    cleanupStatement(env, `DELETE FROM app_leases
      WHERE (datetime(expires_at)<=datetime('now','-1 day'))
         OR (revoked_at IS NOT NULL AND datetime(revoked_at)<datetime('now','-7 days'))`),
    cleanupStatement(env, `DELETE FROM password_reset_tokens
      WHERE datetime(expires_at)<datetime('now','-7 days')
         OR (consumed_at IS NOT NULL AND datetime(consumed_at)<datetime('now','-7 days'))
         OR (revoked_at IS NOT NULL AND datetime(revoked_at)<datetime('now','-7 days'))`),
    cleanupStatement(env, `DELETE FROM account_activation_tokens
      WHERE datetime(expires_at)<datetime('now','-7 days')
         OR (consumed_at IS NOT NULL AND datetime(consumed_at)<datetime('now','-7 days'))
         OR (revoked_at IS NOT NULL AND datetime(revoked_at)<datetime('now','-7 days'))`),
    cleanupStatement(env, `DELETE FROM invitations
      WHERE (accepted_at IS NOT NULL AND datetime(accepted_at)<datetime('now','-30 days'))
         OR (accepted_at IS NULL AND datetime(expires_at)<datetime('now','-30 days'))`),
    cleanupStatement(env, `DELETE FROM security_rate_limits
      WHERE datetime(updated_at)<datetime('now','-2 days')
        AND (blocked_until IS NULL OR datetime(blocked_until)<datetime('now'))`)
  ];
  try {
    const result = await env.NAVOFLO_DB.batch(statements);
    return { ok:true, statements:result.length };
  } catch (error) {
    console.warn('[NavoFlo security] maintenance failed', error?.message || error);
    return { ok:false, reason:error?.message || 'maintenance_failed' };
  }
}

export function maybeScheduleSecurityMaintenance(env, ctx) {
  if (!ctx?.waitUntil || !env?.NAVOFLO_DB) return;
  const byte = new Uint8Array(1);
  crypto.getRandomValues(byte);
  if (byte[0] < 4) ctx.waitUntil(runSecurityMaintenance(env)); // ~1.6% API fallback in addition to daily cron.
}

export function hardenResponse(response, request) {
  if (!(response instanceof Response)) return response;
  const headers = new Headers(response.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  if (!headers.has('Referrer-Policy')) headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  const url = new URL(request.url);
  if (url.protocol === 'https:') headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  return new Response(response.body, { status:response.status, statusText:response.statusText, headers });
}

export function securityJsonError(error) {
  const headers = { 'cache-control':'no-store' };
  if (error?.retryAfter) headers['retry-after'] = String(error.retryAfter);
  return new Response(JSON.stringify({ error:error?.message || 'Request blocked.', code:error?.code || 'SECURITY_ERROR' }), {
    status:error?.status || 400,
    headers:{ 'content-type':'application/json; charset=utf-8', ...headers }
  });
}
