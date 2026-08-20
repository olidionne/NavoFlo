const STRIPE_API = 'https://api.stripe.com/v1';

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers }
  });
}

export function requireEnv(env, name) {
  const value = env?.[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

export async function stripeRequest(env, path, options = {}) {
  const secret = requireEnv(env, 'STRIPE_SECRET_KEY');
  const method = options.method || 'GET';
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${secret}`);
  if (options.idempotencyKey) headers.set('Idempotency-Key', options.idempotencyKey);

  let body;
  if (options.form) {
    headers.set('Content-Type', 'application/x-www-form-urlencoded');
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(options.form)) {
      if (value === undefined || value === null) continue;
      params.append(key, String(value));
    }
    body = params.toString();
  }

  const response = await fetch(`${STRIPE_API}${path}`, { method, headers, body });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || `Stripe request failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    error.stripe = payload?.error || null;
    throw error;
  }
  return payload;
}

export function planConfig(env, plan) {
  const key = String(plan || '').toLowerCase();
  if (key === 'base') {
    return {
      code: 'base', name: 'NavoBase',
      mainPrice: requireEnv(env, 'STRIPE_PRICE_NAVOBASE_MAIN'),
      seatPrice: requireEnv(env, 'STRIPE_PRICE_NAVOBASE_SEAT')
    };
  }
  if (key === 'pro') {
    return {
      code: 'pro', name: 'NavoPro',
      mainPrice: requireEnv(env, 'STRIPE_PRICE_NAVOPRO_MAIN'),
      seatPrice: requireEnv(env, 'STRIPE_PRICE_NAVOPRO_SEAT')
    };
  }
  throw new Error('Unknown NavoFlo plan.');
}

export function safeOrigin(request, env) {
  const configured = env?.PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, '');
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export async function verifyStripeSignature(rawBody, signatureHeader, secret, toleranceSeconds = 300) {
  if (!signatureHeader || !secret) return false;
  const parts = signatureHeader.split(',').map(v => v.trim());
  const timestamp = parts.find(v => v.startsWith('t='))?.slice(2);
  const signatures = parts.filter(v => v.startsWith('v1=')).map(v => v.slice(3));
  if (!timestamp || !signatures.length) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > toleranceSeconds) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signed = await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${rawBody}`));
  const expected = [...new Uint8Array(signed)].map(b => b.toString(16).padStart(2, '0')).join('');
  return signatures.some(sig => constantTimeEqual(sig, expected));
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function upsertSubscription(env, row) {
  if (!env?.NAVOFLO_DB || !row?.stripe_subscription_id) return;
  await env.NAVOFLO_DB.prepare(`
    INSERT INTO subscriptions (
      stripe_subscription_id, stripe_customer_id, customer_email, plan, seats,
      status, current_period_end, cancel_at_period_end, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(stripe_subscription_id) DO UPDATE SET
      stripe_customer_id=excluded.stripe_customer_id,
      customer_email=COALESCE(excluded.customer_email, subscriptions.customer_email),
      plan=COALESCE(excluded.plan, subscriptions.plan),
      seats=COALESCE(excluded.seats, subscriptions.seats),
      status=excluded.status,
      current_period_end=excluded.current_period_end,
      cancel_at_period_end=excluded.cancel_at_period_end,
      updated_at=datetime('now')
  `).bind(
    row.stripe_subscription_id, row.stripe_customer_id || null,
    row.customer_email || null, row.plan || null, row.seats ?? null,
    row.status || 'unknown', row.current_period_end || null,
    row.cancel_at_period_end ? 1 : 0
  ).run();
}
