import { json, planConfig, safeOrigin, stripeRequest, taxRatesForProvince } from './stripe.js';

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing']);

export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function accessEmail(request) {
  return normalizeEmail(request.headers.get('cf-access-authenticated-user-email'));
}

export function entitlementsForPlan(plan) {
  const code = String(plan || '').toLowerCase();
  return {
    automation: code === 'base' || code === 'pro',
    navo2d: code === 'pro',
    navo3d: code === 'pro',
    navoanalyzer: false
  };
}

export async function ensureUser(env, { email, display_name = null, touch_login = false } = {}) {
  const normalized = normalizeEmail(email);
  if (!env?.NAVOFLO_DB || !normalized) return null;

  await env.NAVOFLO_DB.prepare(`
    INSERT INTO users (email, display_name, last_login_at, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(email) DO UPDATE SET
      display_name=COALESCE(excluded.display_name, users.display_name),
      last_login_at=COALESCE(excluded.last_login_at, users.last_login_at),
      updated_at=datetime('now')
  `).bind(
    normalized,
    display_name || null,
    touch_login ? new Date().toISOString() : null
  ).run();

  return env.NAVOFLO_DB.prepare(`
    SELECT id, email, display_name, last_login_at
    FROM users WHERE email=? COLLATE NOCASE LIMIT 1
  `).bind(normalized).first();
}

async function organizationSubscription(env, organizationId) {
  if (!env?.NAVOFLO_DB || !organizationId) return null;
  return env.NAVOFLO_DB.prepare(`
    SELECT s.*
    FROM subscriptions s
    JOIN organizations o ON o.id=?
    WHERE (s.organization_id=o.id OR s.stripe_customer_id=o.stripe_customer_id)
    ORDER BY
      CASE s.status WHEN 'active' THEN 0 WHEN 'trialing' THEN 1 WHEN 'past_due' THEN 2 ELSE 3 END,
      s.updated_at DESC
    LIMIT 1
  `).bind(organizationId).first();
}

export async function ensureBillingOwnerLicense(env, { organization, email, display_name = null, subscription = null } = {}) {
  if (!env?.NAVOFLO_DB || !organization?.id || !normalizeEmail(email)) return null;

  const user = await ensureUser(env, { email, display_name });
  if (!user) return null;

  const existingOwner = await env.NAVOFLO_DB.prepare(`
    SELECT m.user_id FROM memberships m
    WHERE m.organization_id=? AND m.role='owner' AND m.active=1
    ORDER BY m.id LIMIT 1
  `).bind(organization.id).first();

  if (!existingOwner || Number(existingOwner.user_id) === Number(user.id)) {
    await env.NAVOFLO_DB.prepare(`
      INSERT INTO memberships (organization_id, user_id, role, active, updated_at)
      VALUES (?, ?, 'owner', 1, datetime('now'))
      ON CONFLICT(organization_id, user_id) DO UPDATE SET
        role='owner', active=1, updated_at=datetime('now')
    `).bind(organization.id, user.id).run();
  } else {
    await env.NAVOFLO_DB.prepare(`
      INSERT INTO memberships (organization_id, user_id, role, active, updated_at)
      VALUES (?, ?, 'member', 1, datetime('now'))
      ON CONFLICT(organization_id, user_id) DO UPDATE SET
        active=1, updated_at=datetime('now')
    `).bind(organization.id, user.id).run();
  }

  const sub = subscription || await organizationSubscription(env, organization.id);
  const seats = Math.max(0, Number(sub?.seats || 0));
  if (seats > 0 && ACTIVE_SUBSCRIPTION_STATUSES.has(String(sub?.status || ''))) {
    const assignmentCount = await env.NAVOFLO_DB.prepare(`
      SELECT COUNT(*) AS count FROM license_assignments
      WHERE organization_id=? AND active=1
    `).bind(organization.id).first();

    const alreadyAssigned = await env.NAVOFLO_DB.prepare(`
      SELECT id FROM license_assignments
      WHERE organization_id=? AND user_id=? AND active=1 LIMIT 1
    `).bind(organization.id, user.id).first();

    if (alreadyAssigned || Number(assignmentCount?.count || 0) < seats) {
      await env.NAVOFLO_DB.prepare(`
        INSERT INTO license_assignments (
          organization_id, user_id, active, assigned_at, revoked_at, subscription_id
        ) VALUES (?, ?, 1, datetime('now'), NULL, ?)
        ON CONFLICT(organization_id, user_id) DO UPDATE SET
          active=1, assigned_at=datetime('now'), revoked_at=NULL,
          subscription_id=COALESCE(excluded.subscription_id, license_assignments.subscription_id)
      `).bind(organization.id, user.id, sub?.stripe_subscription_id || null).run();
    }
  }

  return user;
}

async function bootstrapFromBillingEmail(env, email) {
  const normalized = normalizeEmail(email);
  if (!env?.NAVOFLO_DB || !normalized) return null;
  const organization = await env.NAVOFLO_DB.prepare(`
    SELECT * FROM organizations WHERE billing_email=? COLLATE NOCASE ORDER BY updated_at DESC LIMIT 1
  `).bind(normalized).first();
  if (!organization) return null;
  const subscription = await organizationSubscription(env, organization.id);
  if (!subscription) return null;
  await env.NAVOFLO_DB.prepare(`
    UPDATE subscriptions SET organization_id=?, updated_at=datetime('now')
    WHERE stripe_customer_id=? AND organization_id IS NULL
  `).bind(organization.id, organization.stripe_customer_id).run();
  await ensureBillingOwnerLicense(env, { organization, email: normalized, subscription });
  return organization;
}

async function currentMembership(env, email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;

  let row = await env.NAVOFLO_DB.prepare(`
    SELECT
      u.id AS user_id, u.email, u.display_name,
      m.id AS membership_id, m.role,
      o.id AS organization_id, o.name AS organization_name,
      o.billing_email, o.stripe_customer_id
    FROM users u
    JOIN memberships m ON m.user_id=u.id AND m.active=1
    JOIN organizations o ON o.id=m.organization_id
    WHERE u.email=? COLLATE NOCASE
    ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, m.id
    LIMIT 1
  `).bind(normalized).first();

  if (!row) {
    await bootstrapFromBillingEmail(env, normalized);
    row = await env.NAVOFLO_DB.prepare(`
      SELECT
        u.id AS user_id, u.email, u.display_name,
        m.id AS membership_id, m.role,
        o.id AS organization_id, o.name AS organization_name,
        o.billing_email, o.stripe_customer_id
      FROM users u
      JOIN memberships m ON m.user_id=u.id AND m.active=1
      JOIN organizations o ON o.id=m.organization_id
      WHERE u.email=? COLLATE NOCASE
      ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, m.id
      LIMIT 1
    `).bind(normalized).first();
  }
  return row;
}

export async function licensingContext(env, email, { includeMembers = true, touchLogin = false } = {}) {
  const normalized = normalizeEmail(email);
  if (!env?.NAVOFLO_DB || !normalized) return null;
  if (touchLogin) await ensureUser(env, { email: normalized, touch_login: true });

  const membership = await currentMembership(env, normalized);
  if (!membership) return null;

  const subscription = await organizationSubscription(env, membership.organization_id);
  const subscriptionActive = ACTIVE_SUBSCRIPTION_STATUSES.has(String(subscription?.status || ''));
  const assignment = await env.NAVOFLO_DB.prepare(`
    SELECT id, active, assigned_at, revoked_at
    FROM license_assignments
    WHERE organization_id=? AND user_id=? LIMIT 1
  `).bind(membership.organization_id, membership.user_id).first();
  const seatsUsedRow = await env.NAVOFLO_DB.prepare(`
    SELECT COUNT(*) AS count FROM license_assignments
    WHERE organization_id=? AND active=1
  `).bind(membership.organization_id).first();
  const seatsPurchased = Math.max(0, Number(subscription?.seats || 0));
  const seatsUsed = Number(seatsUsedRow?.count || 0);
  const licensed = Boolean(subscriptionActive && assignment?.active);
  const plan = subscription?.plan || null;

  let members = [];
  if (includeMembers && ['owner', 'admin'].includes(membership.role)) {
    const result = await env.NAVOFLO_DB.prepare(`
      SELECT
        u.id AS user_id, u.email, u.display_name,
        m.role, m.active AS membership_active, m.pending_license,
        COALESCE(la.active, 0) AS licensed,
        la.assigned_at, la.revoked_at
      FROM memberships m
      JOIN users u ON u.id=m.user_id
      LEFT JOIN license_assignments la
        ON la.organization_id=m.organization_id AND la.user_id=m.user_id
      WHERE m.organization_id=? AND m.active=1
      ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, u.email
    `).bind(membership.organization_id).all();
    members = result.results || [];
  }

  return {
    user: {
      id: membership.user_id,
      email: membership.email,
      display_name: membership.display_name || null,
      role: membership.role,
      licensed
    },
    organization: {
      id: membership.organization_id,
      name: membership.organization_name || membership.billing_email || 'NavoFlo',
      billing_email: membership.billing_email || null,
      stripe_customer_id: membership.stripe_customer_id
    },
    subscription: subscription ? {
      id: subscription.stripe_subscription_id,
      plan,
      status: subscription.status,
      active: subscriptionActive,
      seats: seatsPurchased,
      current_period_end: subscription.current_period_end,
      cancel_at_period_end: Boolean(subscription.cancel_at_period_end)
    } : null,
    seats: {
      purchased: seatsPurchased,
      used: seatsUsed,
      available: Math.max(0, seatsPurchased - seatsUsed),
      overallocated: seatsUsed > seatsPurchased
    },
    entitlements: licensed ? entitlementsForPlan(plan) : entitlementsForPlan(null),
    members
  };
}

function licensingError(message, status = 400, code = 'LICENSING_ERROR') {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

export async function requireLicensingContext(request, env, options = {}) {
  const email = accessEmail(request);
  if (!email) throw licensingError('Cloudflare Access identity is required.', 401, 'AUTH_REQUIRED');
  const context = await licensingContext(env, email, { includeMembers: options.includeMembers !== false, touchLogin: true });
  if (!context) throw licensingError('No NavoFlo organization is linked to this account.', 403, 'NO_ORGANIZATION');
  return context;
}

export function requireManager(context) {
  if (!context || !['owner', 'admin'].includes(context.user?.role)) {
    throw licensingError('Owner or administrator access is required.', 403, 'MANAGER_REQUIRED');
  }
}

export async function addMember(env, context, payload = {}) {
  requireManager(context);
  const email = normalizeEmail(payload.email);
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw licensingError('A valid email address is required.');

  const orgId = context.organization.id;
  const existingMembership = await env.NAVOFLO_DB.prepare(`
    SELECT m.id, m.role, m.active, u.id AS user_id
    FROM users u JOIN memberships m ON m.user_id=u.id
    WHERE u.email=? COLLATE NOCASE AND m.organization_id=? LIMIT 1
  `).bind(email, orgId).first();

  const existingView = (context.members || []).find(member => normalizeEmail(member.email) === email);
  if (!existingView?.licensed && context.seats.available <= 0) {
    throw licensingError('No license seat is available.', 409, 'NO_SEAT_AVAILABLE');
  }

  const user = await ensureUser(env, { email, display_name: payload.display_name || null });
  if (!user) throw licensingError('Unable to create user.', 500);

  if (!existingMembership) {
    await env.NAVOFLO_DB.prepare(`
      INSERT INTO memberships (organization_id, user_id, role, active, updated_at)
      VALUES (?, ?, 'member', 1, datetime('now'))
    `).bind(orgId, user.id).run();
  } else if (!existingMembership.active) {
    await env.NAVOFLO_DB.prepare(`
      UPDATE memberships SET active=1, pending_license=0, updated_at=datetime('now') WHERE id=?
    `).bind(existingMembership.id).run();
  }

  const fresh = await licensingContext(env, context.user.email, { includeMembers: true });
  const alreadyLicensed = fresh.members.find(member => Number(member.user_id) === Number(user.id))?.licensed;
  if (!alreadyLicensed) {
    if (!fresh.subscription?.active) throw licensingError('The organization does not have an active subscription.', 409, 'SUBSCRIPTION_INACTIVE');
    if (fresh.seats.available <= 0) throw licensingError('No license seat is available.', 409, 'NO_SEAT_AVAILABLE');
    await env.NAVOFLO_DB.prepare(`
      INSERT INTO license_assignments (
        organization_id, user_id, active, assigned_at, revoked_at, subscription_id
      ) VALUES (?, ?, 1, datetime('now'), NULL, ?)
      ON CONFLICT(organization_id, user_id) DO UPDATE SET
        active=1, assigned_at=datetime('now'), revoked_at=NULL,
        subscription_id=excluded.subscription_id
    `).bind(orgId, user.id, fresh.subscription.id).run();
    await env.NAVOFLO_DB.prepare(`
      UPDATE memberships SET pending_license=0, updated_at=datetime('now')
      WHERE organization_id=? AND user_id=?
    `).bind(orgId, user.id).run();
  }

  return licensingContext(env, context.user.email, { includeMembers: true });
}

export async function setMemberLicense(env, context, userId, active) {
  requireManager(context);
  const targetId = Number(userId);
  if (!Number.isInteger(targetId) || targetId <= 0) throw licensingError('Invalid user.');
  if (targetId === Number(context.user.id) && !active) {
    throw licensingError('The current owner cannot remove their own license.', 409, 'OWNER_LICENSE_REQUIRED');
  }

  const member = await env.NAVOFLO_DB.prepare(`
    SELECT m.id, m.role, m.active FROM memberships m
    WHERE m.organization_id=? AND m.user_id=? LIMIT 1
  `).bind(context.organization.id, targetId).first();
  if (!member || !member.active) throw licensingError('Member not found.', 404);
  if (member.role === 'owner' && !active) {
    throw licensingError('The organization owner must keep an active license.', 409, 'OWNER_LICENSE_REQUIRED');
  }

  if (active) {
    const fresh = await licensingContext(env, context.user.email, { includeMembers: true });
    const current = fresh.members.find(row => Number(row.user_id) === targetId);
    if (!current?.licensed && fresh.seats.available <= 0) throw licensingError('No license seat is available.', 409, 'NO_SEAT_AVAILABLE');
    await env.NAVOFLO_DB.prepare(`
      INSERT INTO license_assignments (organization_id, user_id, active, assigned_at, revoked_at, subscription_id)
      VALUES (?, ?, 1, datetime('now'), NULL, ?)
      ON CONFLICT(organization_id, user_id) DO UPDATE SET
        active=1, assigned_at=datetime('now'), revoked_at=NULL,
        subscription_id=excluded.subscription_id
    `).bind(context.organization.id, targetId, fresh.subscription?.id || null).run();
    await env.NAVOFLO_DB.prepare(`
      UPDATE memberships SET pending_license=0, updated_at=datetime('now')
      WHERE organization_id=? AND user_id=?
    `).bind(context.organization.id, targetId).run();
  } else {
    await env.NAVOFLO_DB.batch([
      env.NAVOFLO_DB.prepare(`
        UPDATE license_assignments SET active=0, revoked_at=datetime('now')
        WHERE organization_id=? AND user_id=?
      `).bind(context.organization.id, targetId),
      env.NAVOFLO_DB.prepare(`
        UPDATE memberships SET pending_license=0, updated_at=datetime('now')
        WHERE organization_id=? AND user_id=?
      `).bind(context.organization.id, targetId)
    ]);
  }
  return licensingContext(env, context.user.email, { includeMembers: true });
}

export async function removeMember(env, context, userId) {
  requireManager(context);
  const targetId = Number(userId);
  if (!Number.isInteger(targetId) || targetId <= 0) throw licensingError('Invalid user.');
  if (targetId === Number(context.user.id)) throw licensingError('You cannot remove yourself from the organization.', 409);

  const member = await env.NAVOFLO_DB.prepare(`
    SELECT role FROM memberships WHERE organization_id=? AND user_id=? AND active=1 LIMIT 1
  `).bind(context.organization.id, targetId).first();
  if (!member) throw licensingError('Member not found.', 404);
  if (member.role === 'owner') throw licensingError('The organization owner cannot be removed.', 409);

  await env.NAVOFLO_DB.batch([
    env.NAVOFLO_DB.prepare(`
      UPDATE license_assignments SET active=0, revoked_at=datetime('now')
      WHERE organization_id=? AND user_id=?
    `).bind(context.organization.id, targetId),
    env.NAVOFLO_DB.prepare(`
      UPDATE memberships SET active=0, pending_license=0, updated_at=datetime('now')
      WHERE organization_id=? AND user_id=?
    `).bind(context.organization.id, targetId)
  ]);
  return licensingContext(env, context.user.email, { includeMembers: true });
}


export async function assignPendingLicenses(env, organizationId, subscription = null) {
  if (!env?.NAVOFLO_DB || !organizationId) return 0;
  const sub = subscription || await organizationSubscription(env, organizationId);
  if (!sub || !ACTIVE_SUBSCRIPTION_STATUSES.has(String(sub.status || ''))) return 0;

  const purchased = Math.max(0, Number(sub.seats || 0));
  const usedRow = await env.NAVOFLO_DB.prepare(`
    SELECT COUNT(*) AS count FROM license_assignments
    WHERE organization_id=? AND active=1
  `).bind(organizationId).first();
  let available = Math.max(0, purchased - Number(usedRow?.count || 0));
  if (!available) return 0;

  const pending = await env.NAVOFLO_DB.prepare(`
    SELECT m.user_id
    FROM memberships m
    LEFT JOIN license_assignments la
      ON la.organization_id=m.organization_id AND la.user_id=m.user_id AND la.active=1
    WHERE m.organization_id=? AND m.active=1 AND m.pending_license=1 AND la.id IS NULL
    ORDER BY m.created_at, m.id
  `).bind(organizationId).all();

  let assigned = 0;
  for (const row of pending.results || []) {
    if (available <= 0) break;
    await env.NAVOFLO_DB.batch([
      env.NAVOFLO_DB.prepare(`
        INSERT INTO license_assignments (organization_id, user_id, active, assigned_at, revoked_at, subscription_id)
        VALUES (?, ?, 1, datetime('now'), NULL, ?)
        ON CONFLICT(organization_id, user_id) DO UPDATE SET
          active=1, assigned_at=datetime('now'), revoked_at=NULL,
          subscription_id=excluded.subscription_id
      `).bind(organizationId, row.user_id, sub.stripe_subscription_id || sub.id || null),
      env.NAVOFLO_DB.prepare(`
        UPDATE memberships SET pending_license=0, updated_at=datetime('now')
        WHERE organization_id=? AND user_id=?
      `).bind(organizationId, row.user_id)
    ]);
    available -= 1;
    assigned += 1;
  }
  return assigned;
}

function subscriptionItems(subscription) {
  return Array.isArray(subscription?.items?.data) ? subscription.items.data : [];
}

function itemPriceId(item) {
  return typeof item?.price === 'string' ? item.price : item?.price?.id || item?.plan?.id || null;
}

export async function purchaseSeatForMember(request, env, context, payload = {}) {
  requireManager(context);
  if (!context.subscription?.active) throw licensingError('The organization does not have an active subscription.', 409, 'SUBSCRIPTION_INACTIVE');

  const email = normalizeEmail(payload.email);
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw licensingError('A valid email address is required.');
  const orgId = context.organization.id;
  const user = await ensureUser(env, { email, display_name: payload.display_name || null });
  if (!user) throw licensingError('Unable to create user.', 500);

  const existingMembership = await env.NAVOFLO_DB.prepare(`
    SELECT id, active FROM memberships WHERE organization_id=? AND user_id=? LIMIT 1
  `).bind(orgId, user.id).first();
  if (!existingMembership) {
    await env.NAVOFLO_DB.prepare(`
      INSERT INTO memberships (organization_id, user_id, role, active, pending_license, updated_at)
      VALUES (?, ?, 'member', 1, 1, datetime('now'))
    `).bind(orgId, user.id).run();
  } else {
    await env.NAVOFLO_DB.prepare(`
      UPDATE memberships SET active=1, pending_license=1, updated_at=datetime('now') WHERE id=?
    `).bind(existingMembership.id).run();
  }

  const fresh = await licensingContext(env, context.user.email, { includeMembers: true });
  const member = fresh.members.find(row => Number(row.user_id) === Number(user.id));
  if (member?.licensed) {
    await env.NAVOFLO_DB.prepare(`
      UPDATE memberships SET pending_license=0, updated_at=datetime('now')
      WHERE organization_id=? AND user_id=?
    `).bind(orgId, user.id).run();
    return { state: await licensingContext(env, context.user.email, { includeMembers: true }), purchase: null };
  }

  if (fresh.seats.available > 0) {
    await setMemberLicense(env, fresh, user.id, true);
    return { state: await licensingContext(env, context.user.email, { includeMembers: true }), purchase: null };
  }

  const subId = fresh.subscription.id;
  const stripeSub = await stripeRequest(env, `/subscriptions/${encodeURIComponent(subId)}?expand[]=items.data.price&expand[]=latest_invoice`);
  const plan = planConfig(env, fresh.subscription.plan);
  const items = subscriptionItems(stripeSub);
  const seatItem = items.find(item => itemPriceId(item) === plan.seatPrice) || null;
  const currentExtraSeats = Math.max(0, Number(seatItem?.quantity || 0));
  const targetSeats = 1 + currentExtraSeats + 1;
  const province = String(stripeSub.metadata?.navoflo_tax_province || '').toUpperCase();

  const form = {
    payment_behavior: 'pending_if_incomplete',
    proration_behavior: 'always_invoice',
    'expand[0]': 'latest_invoice'
  };
  if (seatItem?.id) {
    form['items[0][id]'] = seatItem.id;
    form['items[0][quantity]'] = currentExtraSeats + 1;
  } else {
    form['items[0][price]'] = plan.seatPrice;
    form['items[0][quantity]'] = 1;
    if (province) {
      const taxRates = taxRatesForProvince(env, province);
      taxRates.forEach((rate, index) => { form[`items[0][tax_rates][${index}]`] = rate; });
    }
  }

  try {
    const updated = await stripeRequest(env, `/subscriptions/${encodeURIComponent(subId)}`, {
      method: 'POST',
      form,
      idempotencyKey: `navoflo-seat-fasttrack-${subId}-${user.id}-${targetSeats}`
    });
    const invoice = typeof updated.latest_invoice === 'object' ? updated.latest_invoice : null;
    const paid = invoice?.status === 'paid';
    const billingUrl = !paid ? (invoice?.hosted_invoice_url || null) : null;
    return {
      state: await licensingContext(env, context.user.email, { includeMembers: true }),
      purchase: {
        requested: true,
        target_seats: targetSeats,
        status: paid ? 'paid' : (updated.pending_update ? 'pending_payment' : 'processing'),
        billing_url: billingUrl
      }
    };
  } catch (error) {
    await env.NAVOFLO_DB.prepare(`
      UPDATE memberships SET pending_license=0, updated_at=datetime('now')
      WHERE organization_id=? AND user_id=?
    `).bind(orgId, user.id).run();
    throw error;
  }
}

export async function createLicensingPortal(request, env, context) {
  requireManager(context);
  const customer = context.organization.stripe_customer_id;
  if (!customer) throw licensingError('Stripe customer is not linked.', 404);
  const origin = safeOrigin(request, env);
  const portal = await stripeRequest(env, '/billing_portal/sessions', {
    method: 'POST',
    form: { customer, return_url: `${origin}/account/licenses/` }
  });
  return portal.url;
}

export async function featureAuthorized(request, env, feature) {
  const email = accessEmail(request);
  if (!email) return false;
  const context = await licensingContext(env, email, { includeMembers: false, touchLogin: true });
  return Boolean(context?.entitlements?.[feature]);
}

export function licensingJsonError(error) {
  return json({ error: error.message || 'Licensing request failed.', code: error.code || 'LICENSING_ERROR' }, error.status || 500);
}
