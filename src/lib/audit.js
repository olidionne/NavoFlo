import { requireLicensingContext, requireManager } from './licensing.js';

function auditError(message, status = 400, code = 'AUDIT_ERROR') {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function parseDetails(value) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function publicDetails(action, value) {
  const details = parseDetails(value);
  if (!details) return null;
  const pick = (...keys) => Object.fromEntries(keys.filter(key => details[key] !== undefined).map(key => [key, details[key]]));
  if (action === 'member.invited') return pick('email_sent');
  if (action === 'auth.activation_email_sent') return pick('source', 'email_provider');
  if (action === 'auth.activation_email_failed') return pick('source', 'reason');
  if (action === 'auth.activation_completed') return pick('source');
  if (action === 'auth.password_reset_requested') return pick('email_provider');
  if (action === 'auth.password_reset_email_failed') return pick('reason');
  if (action === 'auth.session_revoked') return pick('session_id', 'current');
  if (action === 'auth.other_sessions_revoked') return pick('count');
  if (action === 'license.assigned' || action === 'license.revoked') return pick('license_type', 'source');
  if (action === 'license.transferred') return pick('from_user_id');
  if (action === 'license.device_disconnected') return pick('device_id', 'device_name');
  if (action === 'billing.seat_fast_track_requested') return pick('target_seats', 'status');
  // Stable workstation identifiers and any future unknown metadata stay server-side.
  return null;
}

function validDate(value) {
  const text = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

const CATEGORY_PREFIX = Object.freeze({
  auth: 'auth.',
  member: 'member.',
  license: 'license.',
  billing: 'billing.'
});

export async function organizationAudit(request, env) {
  const context = await requireLicensingContext(request, env, { includeMembers:false });
  requireManager(context);
  if (!env?.NAVOFLO_DB) throw auditError('NavoFlo database is unavailable.', 503, 'DB_UNAVAILABLE');

  const url = new URL(request.url);
  const category = String(url.searchParams.get('category') || '').toLowerCase();
  const userId = Number(url.searchParams.get('user_id') || 0);
  const from = validDate(url.searchParams.get('from'));
  const to = validDate(url.searchParams.get('to'));
  const beforeId = Number(url.searchParams.get('before_id') || 0);
  const requestedLimit = Number(url.searchParams.get('limit') || 50);
  const limit = Math.min(100, Math.max(10, Number.isFinite(requestedLimit) ? Math.floor(requestedLimit) : 50));

  if (category && !CATEGORY_PREFIX[category]) throw auditError('Invalid audit category.', 400, 'INVALID_CATEGORY');
  if (url.searchParams.has('user_id') && (!Number.isInteger(userId) || userId <= 0)) throw auditError('Invalid audit user.', 400, 'INVALID_USER');
  if (url.searchParams.has('from') && !from) throw auditError('Invalid audit start date.', 400, 'INVALID_DATE');
  if (url.searchParams.has('to') && !to) throw auditError('Invalid audit end date.', 400, 'INVALID_DATE');
  if (from && to && from > to) throw auditError('Audit start date must be before end date.', 400, 'INVALID_DATE_RANGE');

  const where = ['a.organization_id=?'];
  const bindings = [context.organization.id];
  if (CATEGORY_PREFIX[category]) {
    where.push('a.action LIKE ?');
    bindings.push(`${CATEGORY_PREFIX[category]}%`);
  }
  if (userId) {
    where.push('(a.actor_user_id=? OR a.target_user_id=?)');
    bindings.push(userId, userId);
  }
  if (from) {
    where.push("datetime(a.created_at) >= datetime(?)");
    bindings.push(`${from} 00:00:00`);
  }
  if (to) {
    where.push("datetime(a.created_at) < datetime(?, '+1 day')");
    bindings.push(`${to} 00:00:00`);
  }
  if (Number.isInteger(beforeId) && beforeId > 0) {
    where.push('a.id < ?');
    bindings.push(beforeId);
  }

  const result = await env.NAVOFLO_DB.prepare(`
    SELECT
      a.id, a.action, a.details_json, a.created_at,
      a.actor_user_id, actor.email AS actor_email, actor.display_name AS actor_display_name,
      a.target_user_id, target.email AS target_email, target.display_name AS target_display_name
    FROM audit_log a
    LEFT JOIN users actor ON actor.id=a.actor_user_id
    LEFT JOIN users target ON target.id=a.target_user_id
    WHERE ${where.join(' AND ')}
    ORDER BY a.id DESC
    LIMIT ?
  `).bind(...bindings, limit + 1).all();

  const rows = result.results || [];
  const hasMore = rows.length > limit;
  const visible = rows.slice(0, limit);
  return {
    events:visible.map(row => ({
      id:Number(row.id),
      action:row.action,
      created_at:row.created_at,
      actor:row.actor_user_id ? {
        id:Number(row.actor_user_id),
        email:row.actor_email || null,
        display_name:row.actor_display_name || null
      } : null,
      target:row.target_user_id ? {
        id:Number(row.target_user_id),
        email:row.target_email || null,
        display_name:row.target_display_name || null
      } : null,
      details:publicDetails(row.action, row.details_json)
    })),
    has_more:hasMore,
    next_before_id:hasMore && visible.length ? Number(visible[visible.length - 1].id) : null
  };
}
