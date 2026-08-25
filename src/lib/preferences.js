import { json } from './stripe.js';
import { requireAuthUser, authError } from './auth.js';

const MAX_PREFERENCES_BYTES = 32 * 1024;
const MODULE_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/;

function normalizeModule(value) {
  const module = String(value || '').trim().toLowerCase();
  if (!MODULE_RE.test(module)) throw authError('Invalid preferences module.', 400, 'INVALID_PREFERENCES_MODULE');
  return module;
}

function cleanValue(value, depth = 0) {
  if (depth > 8) throw authError('Preferences are too deeply nested.', 400, 'PREFERENCES_TOO_DEEP');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) {
    if (value.length > 200) throw authError('Preferences contain too many values.', 400, 'PREFERENCES_TOO_LARGE');
    return value.map(item => cleanValue(item, depth + 1));
  }
  if (typeof value === 'object') {
    const out = {};
    const entries = Object.entries(value);
    if (entries.length > 200) throw authError('Preferences contain too many fields.', 400, 'PREFERENCES_TOO_LARGE');
    for (const [key, item] of entries) {
      if (['__proto__', 'prototype', 'constructor'].includes(key)) continue;
      const safeKey = String(key).slice(0, 100);
      out[safeKey] = cleanValue(item, depth + 1);
    }
    return out;
  }
  return null;
}

function parseStored(raw) {
  try {
    const value = JSON.parse(String(raw || '{}'));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch { return {}; }
}

export async function getUserPreferences(request, env) {
  const user = await requireAuthUser(request, env);
  const module = normalizeModule(new URL(request.url).searchParams.get('module'));
  let row;
  try {
    row = await env.NAVOFLO_DB.prepare(`
      SELECT preferences_json, revision, updated_at
      FROM user_preferences WHERE user_id=? AND module=? LIMIT 1
    `).bind(user.id, module).first();
  } catch (error) {
    if (String(error?.message || '').toLowerCase().includes('no such table')) {
      return json({ module, preferences:{}, revision:0, updated_at:null, persistence:false }, 200, { 'cache-control':'no-store' });
    }
    throw error;
  }
  return json({
    module,
    preferences:parseStored(row?.preferences_json),
    revision:Number(row?.revision || 0),
    updated_at:row?.updated_at || null,
    persistence:true
  }, 200, { 'cache-control':'no-store' });
}

export async function putUserPreferences(request, env) {
  const user = await requireAuthUser(request, env);
  const body = await request.json().catch(() => ({}));
  const module = normalizeModule(body.module);
  const rawPreferences = body.preferences;
  if (!rawPreferences || typeof rawPreferences !== 'object' || Array.isArray(rawPreferences)) {
    throw authError('Preferences must be a JSON object.', 400, 'INVALID_PREFERENCES');
  }
  const preferences = cleanValue(rawPreferences);
  const encoded = JSON.stringify(preferences);
  if (new TextEncoder().encode(encoded).byteLength > MAX_PREFERENCES_BYTES) {
    throw authError('Preferences exceed the 32 KB module limit.', 413, 'PREFERENCES_TOO_LARGE');
  }

  await env.NAVOFLO_DB.prepare(`
    INSERT INTO user_preferences (user_id, module, preferences_json, revision, updated_at)
    VALUES (?, ?, ?, 1, datetime('now'))
    ON CONFLICT(user_id, module) DO UPDATE SET
      preferences_json=excluded.preferences_json,
      revision=user_preferences.revision+1,
      updated_at=datetime('now')
  `).bind(user.id, module, encoded).run();

  const row = await env.NAVOFLO_DB.prepare(`
    SELECT revision, updated_at FROM user_preferences WHERE user_id=? AND module=? LIMIT 1
  `).bind(user.id, module).first();

  return json({ ok:true, module, revision:Number(row?.revision || 1), updated_at:row?.updated_at || null }, 200, { 'cache-control':'no-store' });
}
