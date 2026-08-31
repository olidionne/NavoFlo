import { json } from './stripe.js';
import { requireAuthUser } from './auth.js';

// Processes recognized by NavoFlo for manufacturing capability declarations.
export const KNOWN_PROCESSES = Object.freeze([
  'laser', 'plasma', 'waterjet', 'punching',   // 2D cutting
  'bending', 'rolling', 'stamping',              // forming
  'milling', 'turning', 'drilling', 'grinding', // machining
  'welding', 'assembly',                         // joining
  'sawing', 'painting', 'sandblasting'           // other
]);

const MAX_BEND_PARAMS_ROWS = 50;
const MAX_NOTES_LEN = 500;

export function companyError(message, status = 400, code = 'COMPANY_ERROR') {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

export function companyJsonError(error) {
  const status = Number(error?.status) || 500;
  const code = String(error?.code || 'COMPANY_ERROR');
  const message = String(error?.message || 'An unexpected error occurred.');
  return json({ error: message, code }, status, { 'cache-control': 'no-store' });
}

// Require admin or owner role.
export async function requireCompanyAdmin(request, env) {
  const user = await requireAuthUser(request, env);
  const row = await env.NAVOFLO_DB.prepare(`
    SELECT m.organization_id, m.role, o.name AS organization_name
    FROM memberships m
    JOIN organizations o ON o.id = m.organization_id
    WHERE m.user_id = ? AND m.active = 1
    ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, m.id
    LIMIT 1
  `).bind(user.id).first();
  if (!row) throw companyError('No active organization found.', 403, 'NO_ORGANIZATION');
  if (row.role !== 'owner' && row.role !== 'admin') {
    throw companyError('Admin or owner role required.', 403, 'INSUFFICIENT_ROLE');
  }
  return { user, organizationId: row.organization_id, role: row.role, organizationName: row.organization_name };
}

// Any authenticated member can read company settings (needed by the viewer).
export async function requireCompanyMember(request, env) {
  const user = await requireAuthUser(request, env);
  const row = await env.NAVOFLO_DB.prepare(`
    SELECT m.organization_id, m.role
    FROM memberships m
    WHERE m.user_id = ? AND m.active = 1
    ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, m.id
    LIMIT 1
  `).bind(user.id).first();
  if (!row) throw companyError('No active organization found.', 403, 'NO_ORGANIZATION');
  return { user, organizationId: row.organization_id, role: row.role };
}

// ── Capabilities ────────────────────────────────────────────────────────────

export async function getCapabilities(request, env) {
  const { organizationId } = await requireCompanyMember(request, env);
  const rows = await env.NAVOFLO_DB.prepare(`
    SELECT process, enabled, notes, updated_at
    FROM organization_capabilities
    WHERE organization_id = ?
    ORDER BY id
  `).bind(organizationId).all();

  // Merge stored rows with known processes so caller always gets the full list.
  const stored = new Map((rows.results || []).map(r => [r.process, r]));
  const capabilities = KNOWN_PROCESSES.map(process => {
    const row = stored.get(process);
    return {
      process,
      enabled: row ? Boolean(row.enabled) : false,
      notes: row?.notes || null,
      updated_at: row?.updated_at || null
    };
  });
  return json({ capabilities }, 200, { 'cache-control': 'no-store' });
}

export async function putCapabilities(request, env) {
  const { organizationId, user } = await requireCompanyAdmin(request, env);
  const body = await request.json().catch(() => ({}));
  const updates = body.capabilities;
  if (!Array.isArray(updates)) throw companyError('capabilities must be an array.', 400, 'INVALID_PAYLOAD');

  const stmts = [];
  for (const item of updates) {
    const process = String(item?.process || '').trim().toLowerCase();
    if (!KNOWN_PROCESSES.includes(process)) continue; // silently skip unknown
    const enabled = item.enabled ? 1 : 0;
    const notes = item.notes ? String(item.notes).slice(0, MAX_NOTES_LEN) : null;
    stmts.push(env.NAVOFLO_DB.prepare(`
      INSERT INTO organization_capabilities (organization_id, process, enabled, notes, updated_at, updated_by_user_id)
      VALUES (?, ?, ?, ?, datetime('now'), ?)
      ON CONFLICT(organization_id, process) DO UPDATE SET
        enabled = excluded.enabled,
        notes = excluded.notes,
        updated_at = excluded.updated_at,
        updated_by_user_id = excluded.updated_by_user_id
    `).bind(organizationId, process, enabled, notes, user.id));
  }
  if (stmts.length) await env.NAVOFLO_DB.batch(stmts);
  return json({ ok: true }, 200, { 'cache-control': 'no-store' });
}

// ── Bend params ──────────────────────────────────────────────────────────────

function validateBendParam(item) {
  const kFactor = Number(item?.k_factor);
  if (!Number.isFinite(kFactor) || kFactor < 0.2 || kFactor > 0.8) {
    throw companyError('k_factor must be between 0.2 and 0.8.', 400, 'INVALID_K_FACTOR');
  }
  const materialClass = String(item?.material_class || 'all').trim().toLowerCase();
  if (!['all', 'soft', 'medium', 'hard'].includes(materialClass)) {
    throw companyError('material_class must be all, soft, medium, or hard.', 400, 'INVALID_MATERIAL_CLASS');
  }
  const toOptionalPositive = v => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  return {
    material_class: materialClass,
    thickness_min_mm: toOptionalPositive(item?.thickness_min_mm),
    thickness_max_mm: toOptionalPositive(item?.thickness_max_mm),
    inner_radius_min_mm: toOptionalPositive(item?.inner_radius_min_mm),
    inner_radius_max_mm: toOptionalPositive(item?.inner_radius_max_mm),
    k_factor: kFactor,
    notes: item?.notes ? String(item.notes).slice(0, MAX_NOTES_LEN) : null
  };
}

export async function getBendParams(request, env) {
  const { organizationId } = await requireCompanyMember(request, env);
  const rows = await env.NAVOFLO_DB.prepare(`
    SELECT id, material_class, thickness_min_mm, thickness_max_mm,
           inner_radius_min_mm, inner_radius_max_mm, k_factor, notes, updated_at
    FROM organization_bend_params
    WHERE organization_id = ?
    ORDER BY material_class, thickness_min_mm, inner_radius_min_mm, id
  `).bind(organizationId).all();
  return json({ bend_params: rows.results || [] }, 200, { 'cache-control': 'no-store' });
}

export async function putBendParam(request, env) {
  const { organizationId, user } = await requireCompanyAdmin(request, env);
  const body = await request.json().catch(() => ({}));

  // Check row count limit.
  const count = await env.NAVOFLO_DB.prepare(`
    SELECT COUNT(*) AS n FROM organization_bend_params WHERE organization_id = ?
  `).bind(organizationId).first();
  const id = body.id ? Number(body.id) : null;
  if (!id && Number(count?.n || 0) >= MAX_BEND_PARAMS_ROWS) {
    throw companyError(`Maximum ${MAX_BEND_PARAMS_ROWS} bend parameter rows allowed.`, 400, 'TOO_MANY_BEND_PARAMS');
  }

  const p = validateBendParam(body);

  if (id) {
    // Update existing row — verify it belongs to this org.
    const existing = await env.NAVOFLO_DB.prepare(`
      SELECT id FROM organization_bend_params WHERE id = ? AND organization_id = ? LIMIT 1
    `).bind(id, organizationId).first();
    if (!existing) throw companyError('Bend parameter not found.', 404, 'BEND_PARAM_NOT_FOUND');
    await env.NAVOFLO_DB.prepare(`
      UPDATE organization_bend_params SET
        material_class=?, thickness_min_mm=?, thickness_max_mm=?,
        inner_radius_min_mm=?, inner_radius_max_mm=?,
        k_factor=?, notes=?, updated_at=datetime('now'), updated_by_user_id=?
      WHERE id=? AND organization_id=?
    `).bind(p.material_class, p.thickness_min_mm, p.thickness_max_mm,
            p.inner_radius_min_mm, p.inner_radius_max_mm,
            p.k_factor, p.notes, user.id, id, organizationId).run();
    return json({ ok: true, id }, 200, { 'cache-control': 'no-store' });
  } else {
    const result = await env.NAVOFLO_DB.prepare(`
      INSERT INTO organization_bend_params (
        organization_id, material_class, thickness_min_mm, thickness_max_mm,
        inner_radius_min_mm, inner_radius_max_mm, k_factor, notes,
        updated_at, updated_by_user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
    `).bind(organizationId, p.material_class, p.thickness_min_mm, p.thickness_max_mm,
            p.inner_radius_min_mm, p.inner_radius_max_mm, p.k_factor, p.notes, user.id).run();
    return json({ ok: true, id: result.meta?.last_row_id }, 201, { 'cache-control': 'no-store' });
  }
}

export async function deleteBendParam(request, env, paramId) {
  const { organizationId } = await requireCompanyAdmin(request, env);
  const id = Number(paramId);
  if (!id) throw companyError('Invalid bend parameter ID.', 400, 'INVALID_ID');
  const existing = await env.NAVOFLO_DB.prepare(`
    SELECT id FROM organization_bend_params WHERE id = ? AND organization_id = ? LIMIT 1
  `).bind(id, organizationId).first();
  if (!existing) throw companyError('Bend parameter not found.', 404, 'BEND_PARAM_NOT_FOUND');
  await env.NAVOFLO_DB.prepare(`DELETE FROM organization_bend_params WHERE id=? AND organization_id=?`)
    .bind(id, organizationId).run();
  return json({ ok: true }, 200, { 'cache-control': 'no-store' });
}

// ── Combined read for the viewer (one request) ───────────────────────────────

export async function getCompanySettings(request, env) {
  const { organizationId } = await requireCompanyMember(request, env);

  const [capRows, bendRows] = await Promise.all([
    env.NAVOFLO_DB.prepare(`
      SELECT process, enabled FROM organization_capabilities WHERE organization_id=?
    `).bind(organizationId).all(),
    env.NAVOFLO_DB.prepare(`
      SELECT id, material_class, thickness_min_mm, thickness_max_mm,
             inner_radius_min_mm, inner_radius_max_mm, k_factor
      FROM organization_bend_params WHERE organization_id=?
      ORDER BY material_class, thickness_min_mm, inner_radius_min_mm, id
    `).bind(organizationId).all()
  ]);

  const capabilities = {};
  for (const r of (capRows.results || [])) capabilities[r.process] = Boolean(r.enabled);

  return json({
    capabilities,
    bend_params: bendRows.results || []
  }, 200, { 'cache-control': 'no-store' });
}
