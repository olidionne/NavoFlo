import { json, planConfig, safeOrigin, stripeRequest, taxRatesForProvince } from './stripe.js';
import { createInvitation, identityEmail, randomToken, sessionUser, sha256 } from './auth.js';

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing']);
const LEASE_SECONDS = 90;

export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
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
  `).bind(normalized, display_name || null, touch_login ? new Date().toISOString() : null).run();
  return env.NAVOFLO_DB.prepare(`
    SELECT id, email, display_name, last_login_at, password_hash, status, email_verified_at
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

async function logAudit(env, { organizationId, actorUserId, action, targetUserId = null, details = null } = {}) {
  if (!env?.NAVOFLO_DB) return;
  await env.NAVOFLO_DB.prepare(`
    INSERT INTO audit_log (organization_id, actor_user_id, action, target_user_id, details_json)
    VALUES (?, ?, ?, ?, ?)
  `).bind(organizationId || null, actorUserId || null, action, targetUserId, details ? JSON.stringify(details) : null).run();
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

  const isOwner = !existingOwner || Number(existingOwner.user_id) === Number(user.id);
  await env.NAVOFLO_DB.prepare(`
    INSERT INTO memberships (organization_id, user_id, role, active, updated_at)
    VALUES (?, ?, ?, 1, datetime('now'))
    ON CONFLICT(organization_id, user_id) DO UPDATE SET
      role=CASE WHEN excluded.role='owner' THEN 'owner' ELSE memberships.role END,
      active=1, updated_at=datetime('now')
  `).bind(organization.id, user.id, isOwner ? 'owner' : 'member').run();

  const sub = subscription || await organizationSubscription(env, organization.id);
  const seats = Math.max(0, Number(sub?.seats || 0));
  if (seats > 0 && ACTIVE_SUBSCRIPTION_STATUSES.has(String(sub?.status || ''))) {
    const assignmentCount = await env.NAVOFLO_DB.prepare(`
      SELECT COUNT(*) AS count FROM license_assignments WHERE organization_id=? AND active=1
    `).bind(organization.id).first();
    const alreadyAssigned = await env.NAVOFLO_DB.prepare(`
      SELECT id FROM license_assignments WHERE organization_id=? AND user_id=? AND active=1 LIMIT 1
    `).bind(organization.id, user.id).first();
    if (alreadyAssigned || Number(assignmentCount?.count || 0) < seats) {
      await env.NAVOFLO_DB.prepare(`
        INSERT INTO license_assignments (
          organization_id, user_id, active, assigned_at, revoked_at, subscription_id, license_type
        ) VALUES (?, ?, 1, datetime('now'), NULL, ?, ?)
        ON CONFLICT(organization_id, user_id) DO UPDATE SET
          active=1, assigned_at=datetime('now'), revoked_at=NULL,
          subscription_id=COALESCE(excluded.subscription_id, license_assignments.subscription_id),
          license_type=CASE WHEN excluded.license_type='admin' THEN 'admin' ELSE license_assignments.license_type END
      `).bind(organization.id, user.id, sub?.stripe_subscription_id || null, isOwner ? 'admin' : 'user').run();
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
  await ensureBillingOwnerLicense(env, { organization, email:normalized, subscription });
  return organization;
}

async function currentMembership(env, email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const query = `
    SELECT u.id AS user_id, u.email, u.display_name, u.status AS user_status,
      m.id AS membership_id, m.role,
      o.id AS organization_id, o.name AS organization_name,
      o.billing_email, o.stripe_customer_id
    FROM users u
    JOIN memberships m ON m.user_id=u.id AND m.active=1
    JOIN organizations o ON o.id=m.organization_id
    WHERE u.email=? COLLATE NOCASE
    ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, m.id
    LIMIT 1`;
  let row = await env.NAVOFLO_DB.prepare(query).bind(normalized).first();
  if (!row) {
    await bootstrapFromBillingEmail(env, normalized);
    row = await env.NAVOFLO_DB.prepare(query).bind(normalized).first();
  }
  return row;
}

export async function licensingContext(env, email, { includeMembers = true, touchLogin = false } = {}) {
  const normalized = normalizeEmail(email);
  if (!env?.NAVOFLO_DB || !normalized) return null;
  if (touchLogin) await ensureUser(env, { email:normalized, touch_login:true });
  const membership = await currentMembership(env, normalized);
  if (!membership) return null;

  const subscription = await organizationSubscription(env, membership.organization_id);
  const subscriptionActive = ACTIVE_SUBSCRIPTION_STATUSES.has(String(subscription?.status || ''));
  const assignment = await env.NAVOFLO_DB.prepare(`
    SELECT id, active, assigned_at, revoked_at, license_type
    FROM license_assignments WHERE organization_id=? AND user_id=? LIMIT 1
  `).bind(membership.organization_id, membership.user_id).first();
  const seatsUsedRow = await env.NAVOFLO_DB.prepare(`
    SELECT COUNT(*) AS count FROM license_assignments WHERE organization_id=? AND active=1
  `).bind(membership.organization_id).first();
  const seatsPurchased = Math.max(0, Number(subscription?.seats || 0));
  const seatsUsed = Number(seatsUsedRow?.count || 0);
  const licensed = Boolean(subscriptionActive && assignment?.active);
  const plan = subscription?.plan || null;

  let members = [];
  if (includeMembers && ['owner','admin'].includes(membership.role)) {
    const result = await env.NAVOFLO_DB.prepare(`
      SELECT u.id AS user_id, u.email, u.display_name, u.status AS user_status,
        u.email_verified_at, m.role, m.active AS membership_active, m.pending_license,
        COALESCE(la.active,0) AS licensed, la.id AS assignment_id,
        la.license_type, la.assigned_at, la.revoked_at
      FROM memberships m
      JOIN users u ON u.id=m.user_id
      LEFT JOIN license_assignments la ON la.organization_id=m.organization_id AND la.user_id=m.user_id
      WHERE m.organization_id=? AND m.active=1
      ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, u.email
    `).bind(membership.organization_id).all();
    members = result.results || [];
  }

  return {
    user:{ id:membership.user_id, email:membership.email, display_name:membership.display_name || null,
      role:membership.role, status:membership.user_status, licensed, license_type:assignment?.license_type || null,
      assignment_id:assignment?.id || null },
    organization:{ id:membership.organization_id, name:membership.organization_name || membership.billing_email || 'NavoFlo',
      billing_email:membership.billing_email || null, stripe_customer_id:membership.stripe_customer_id },
    subscription:subscription ? { id:subscription.stripe_subscription_id, plan, status:subscription.status,
      active:subscriptionActive, seats:seatsPurchased, current_period_end:subscription.current_period_end,
      cancel_at_period_end:Boolean(subscription.cancel_at_period_end) } : null,
    seats:{ purchased:seatsPurchased, used:seatsUsed, available:Math.max(0,seatsPurchased-seatsUsed), overallocated:seatsUsed>seatsPurchased },
    entitlements:licensed ? entitlementsForPlan(plan) : entitlementsForPlan(null),
    members
  };
}

function licensingError(message, status = 400, code = 'LICENSING_ERROR') {
  const error = new Error(message); error.status=status; error.code=code; return error;
}

export async function requireLicensingContext(request, env, options = {}) {
  const session = await sessionUser(request, env);
  let email = session?.email || '';
  if (!email && String(env?.NAVOFLO_DEV_ACCESS_FALLBACK || '').toLowerCase() === 'true') email = await identityEmail(request, env);
  if (!email) throw licensingError('NavoFlo authentication is required.', 401, 'AUTH_REQUIRED');
  const context = await licensingContext(env, email, { includeMembers:options.includeMembers !== false, touchLogin:true });
  if (!context) throw licensingError('No NavoFlo organization is linked to this account.', 403, 'NO_ORGANIZATION');
  return context;
}

export function requireManager(context) {
  if (!context || !['owner','admin'].includes(context.user?.role)) throw licensingError('Owner or administrator access is required.', 403, 'MANAGER_REQUIRED');
}

async function ensureMemberRecord(env, context, payload = {}, pendingLicense = 0) {
  const email = normalizeEmail(payload.email);
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw licensingError('A valid email address is required.');
  const user = await ensureUser(env, { email, display_name:payload.display_name || null });
  if (!user) throw licensingError('Unable to create user.', 500);
  const existing = await env.NAVOFLO_DB.prepare(`
    SELECT id FROM memberships WHERE organization_id=? AND user_id=? LIMIT 1
  `).bind(context.organization.id, user.id).first();
  if (!existing) {
    await env.NAVOFLO_DB.prepare(`
      INSERT INTO memberships (organization_id,user_id,role,active,pending_license,updated_at)
      VALUES (?,?,'member',1,?,datetime('now'))
    `).bind(context.organization.id, user.id, pendingLicense ? 1 : 0).run();
  } else {
    await env.NAVOFLO_DB.prepare(`
      UPDATE memberships SET active=1,pending_license=?,updated_at=datetime('now') WHERE id=?
    `).bind(pendingLicense ? 1 : 0, existing.id).run();
  }
  return user;
}

export async function addMember(request, env, context, payload = {}) {
  requireManager(context);
  const email = normalizeEmail(payload.email);
  const assignLicense = payload.assign_license !== false;
  const existingView = (context.members || []).find(member => normalizeEmail(member.email) === email);
  if (assignLicense && !existingView?.licensed && context.seats.available <= 0) throw licensingError('No license seat is available.', 409, 'NO_SEAT_AVAILABLE');
  const user = await ensureMemberRecord(env, context, payload, 0);
  const fresh = await licensingContext(env, context.user.email, { includeMembers:true });
  const alreadyLicensed = fresh.members.find(m => Number(m.user_id)===Number(user.id))?.licensed;
  if (assignLicense && !alreadyLicensed) {
    if (!fresh.subscription?.active) throw licensingError('The organization does not have an active subscription.',409,'SUBSCRIPTION_INACTIVE');
    if (fresh.seats.available<=0) throw licensingError('No license seat is available.',409,'NO_SEAT_AVAILABLE');
    await env.NAVOFLO_DB.prepare(`
      INSERT INTO license_assignments (organization_id,user_id,active,assigned_at,revoked_at,subscription_id,license_type)
      VALUES (?,?,1,datetime('now'),NULL,?,'user')
      ON CONFLICT(organization_id,user_id) DO UPDATE SET active=1,assigned_at=datetime('now'),revoked_at=NULL,
        subscription_id=excluded.subscription_id,license_type='user'
    `).bind(context.organization.id,user.id,fresh.subscription.id).run();
  }
  const invitation = await createInvitation(env, { organizationId:context.organization.id, userId:user.id, email:user.email,
    createdByUserId:context.user.id, request });
  return { state:await licensingContext(env,context.user.email,{includeMembers:true}), invitation };
}

export async function resendMemberInvitation(request, env, context, userId) {
  requireManager(context);
  const targetId=Number(userId);
  const member=await env.NAVOFLO_DB.prepare(`
    SELECT u.id,u.email,u.status FROM memberships m JOIN users u ON u.id=m.user_id
    WHERE m.organization_id=? AND u.id=? AND m.active=1 LIMIT 1
  `).bind(context.organization.id,targetId).first();
  if(!member) throw licensingError('Member not found.',404);
  const invitation=await createInvitation(env,{organizationId:context.organization.id,userId:member.id,email:member.email,createdByUserId:context.user.id,request});
  return { state:await licensingContext(env,context.user.email,{includeMembers:true}), invitation };
}

export async function setMemberLicense(env, context, userId, active) {
  requireManager(context);
  const targetId=Number(userId);
  if(!Number.isInteger(targetId)||targetId<=0) throw licensingError('Invalid user.');
  const member=await env.NAVOFLO_DB.prepare(`SELECT id,role,active FROM memberships WHERE organization_id=? AND user_id=? LIMIT 1`).bind(context.organization.id,targetId).first();
  if(!member||!member.active) throw licensingError('Member not found.',404);
  if(member.role==='owner') throw licensingError('The Admin license is fixed to the organization owner and cannot be transferred.',409,'ADMIN_LICENSE_FIXED');
  if(active){
    const fresh=await licensingContext(env,context.user.email,{includeMembers:true});
    const current=fresh.members.find(row=>Number(row.user_id)===targetId);
    if(!current?.licensed&&fresh.seats.available<=0) throw licensingError('No license seat is available.',409,'NO_SEAT_AVAILABLE');
    await env.NAVOFLO_DB.prepare(`
      INSERT INTO license_assignments (organization_id,user_id,active,assigned_at,revoked_at,subscription_id,license_type)
      VALUES (?,?,1,datetime('now'),NULL,?,'user')
      ON CONFLICT(organization_id,user_id) DO UPDATE SET active=1,assigned_at=datetime('now'),revoked_at=NULL,
        subscription_id=excluded.subscription_id,license_type='user'
    `).bind(context.organization.id,targetId,fresh.subscription?.id||null).run();
    await env.NAVOFLO_DB.prepare(`UPDATE memberships SET pending_license=0,updated_at=datetime('now') WHERE organization_id=? AND user_id=?`).bind(context.organization.id,targetId).run();
  }else{
    await revokeUserLeases(env,targetId);
    await env.NAVOFLO_DB.batch([
      env.NAVOFLO_DB.prepare(`UPDATE license_assignments SET active=0,revoked_at=datetime('now') WHERE organization_id=? AND user_id=? AND license_type='user'`).bind(context.organization.id,targetId),
      env.NAVOFLO_DB.prepare(`UPDATE memberships SET pending_license=0,updated_at=datetime('now') WHERE organization_id=? AND user_id=?`).bind(context.organization.id,targetId)
    ]);
  }
  return licensingContext(env,context.user.email,{includeMembers:true});
}

async function revokeUserLeases(env,userId){
  if(!env?.NAVOFLO_DB)return;
  await env.NAVOFLO_DB.prepare(`UPDATE app_leases SET revoked_at=datetime('now') WHERE user_id=? AND revoked_at IS NULL`).bind(userId).run();
}

export async function transferMemberLicense(env, context, sourceUserId, targetUserId) {
  requireManager(context);
  const sourceId=Number(sourceUserId), targetId=Number(targetUserId);
  if(!Number.isInteger(sourceId)||!Number.isInteger(targetId)||sourceId<=0||targetId<=0||sourceId===targetId) throw licensingError('Invalid license transfer.');
  const source=await env.NAVOFLO_DB.prepare(`
    SELECT la.id,la.license_type,m.role FROM license_assignments la
    JOIN memberships m ON m.organization_id=la.organization_id AND m.user_id=la.user_id
    WHERE la.organization_id=? AND la.user_id=? AND la.active=1 LIMIT 1
  `).bind(context.organization.id,sourceId).first();
  if(!source) throw licensingError('The source user does not have an active license.',404,'SOURCE_LICENSE_NOT_FOUND');
  if(source.license_type==='admin'||source.role==='owner') throw licensingError('The Admin license cannot be transferred.',409,'ADMIN_LICENSE_FIXED');
  const target=await env.NAVOFLO_DB.prepare(`SELECT role,active FROM memberships WHERE organization_id=? AND user_id=? LIMIT 1`).bind(context.organization.id,targetId).first();
  if(!target||!target.active) throw licensingError('The target user is not an active member.',404,'TARGET_MEMBER_NOT_FOUND');
  if(target.role==='owner') throw licensingError('The owner already has the fixed Admin license.',409,'OWNER_HAS_ADMIN_LICENSE');
  const targetAssignment=await env.NAVOFLO_DB.prepare(`SELECT active FROM license_assignments WHERE organization_id=? AND user_id=? LIMIT 1`).bind(context.organization.id,targetId).first();
  if(Number(targetAssignment?.active)) throw licensingError('The target user already has a license.',409,'TARGET_ALREADY_LICENSED');
  await revokeUserLeases(env,sourceId);
  const sub=context.subscription?.id||null;
  await env.NAVOFLO_DB.batch([
    env.NAVOFLO_DB.prepare(`UPDATE license_assignments SET active=0,revoked_at=datetime('now') WHERE organization_id=? AND user_id=?`).bind(context.organization.id,sourceId),
    env.NAVOFLO_DB.prepare(`
      INSERT INTO license_assignments (organization_id,user_id,active,assigned_at,revoked_at,subscription_id,license_type)
      VALUES (?,?,1,datetime('now'),NULL,?,'user')
      ON CONFLICT(organization_id,user_id) DO UPDATE SET active=1,assigned_at=datetime('now'),revoked_at=NULL,
        subscription_id=excluded.subscription_id,license_type='user'
    `).bind(context.organization.id,targetId,sub)
  ]);
  await logAudit(env,{organizationId:context.organization.id,actorUserId:context.user.id,action:'license.transferred',targetUserId:targetId,details:{from_user_id:sourceId}});
  return licensingContext(env,context.user.email,{includeMembers:true});
}

export async function removeMember(env,context,userId){
  requireManager(context);
  const targetId=Number(userId);
  if(!Number.isInteger(targetId)||targetId<=0) throw licensingError('Invalid user.');
  if(targetId===Number(context.user.id)) throw licensingError('You cannot remove yourself from the organization.',409);
  const member=await env.NAVOFLO_DB.prepare(`SELECT role FROM memberships WHERE organization_id=? AND user_id=? AND active=1 LIMIT 1`).bind(context.organization.id,targetId).first();
  if(!member) throw licensingError('Member not found.',404);
  if(member.role==='owner') throw licensingError('The organization owner cannot be removed.',409);
  await revokeUserLeases(env,targetId);
  await env.NAVOFLO_DB.batch([
    env.NAVOFLO_DB.prepare(`UPDATE license_assignments SET active=0,revoked_at=datetime('now') WHERE organization_id=? AND user_id=?`).bind(context.organization.id,targetId),
    env.NAVOFLO_DB.prepare(`UPDATE memberships SET active=0,pending_license=0,updated_at=datetime('now') WHERE organization_id=? AND user_id=?`).bind(context.organization.id,targetId)
  ]);
  await logAudit(env,{organizationId:context.organization.id,actorUserId:context.user.id,action:'member.removed',targetUserId:targetId});
  return licensingContext(env,context.user.email,{includeMembers:true});
}

export async function assignPendingLicenses(env,organizationId,subscription=null){
  if(!env?.NAVOFLO_DB||!organizationId)return 0;
  const sub=subscription||await organizationSubscription(env,organizationId);
  if(!sub||!ACTIVE_SUBSCRIPTION_STATUSES.has(String(sub.status||'')))return 0;
  const purchased=Math.max(0,Number(sub.seats||0));
  const usedRow=await env.NAVOFLO_DB.prepare(`SELECT COUNT(*) AS count FROM license_assignments WHERE organization_id=? AND active=1`).bind(organizationId).first();
  let available=Math.max(0,purchased-Number(usedRow?.count||0));
  if(!available)return 0;
  const pending=await env.NAVOFLO_DB.prepare(`
    SELECT m.user_id FROM memberships m LEFT JOIN license_assignments la
      ON la.organization_id=m.organization_id AND la.user_id=m.user_id AND la.active=1
    WHERE m.organization_id=? AND m.active=1 AND m.pending_license=1 AND la.id IS NULL
    ORDER BY m.created_at,m.id
  `).bind(organizationId).all();
  let assigned=0;
  for(const row of pending.results||[]){
    if(available<=0)break;
    await env.NAVOFLO_DB.batch([
      env.NAVOFLO_DB.prepare(`
        INSERT INTO license_assignments (organization_id,user_id,active,assigned_at,revoked_at,subscription_id,license_type)
        VALUES (?,?,1,datetime('now'),NULL,?,'user')
        ON CONFLICT(organization_id,user_id) DO UPDATE SET active=1,assigned_at=datetime('now'),revoked_at=NULL,
          subscription_id=excluded.subscription_id,license_type='user'
      `).bind(organizationId,row.user_id,sub.stripe_subscription_id||sub.id||null),
      env.NAVOFLO_DB.prepare(`UPDATE memberships SET pending_license=0,updated_at=datetime('now') WHERE organization_id=? AND user_id=?`).bind(organizationId,row.user_id)
    ]);
    available--; assigned++;
  }
  return assigned;
}

function subscriptionItems(subscription){ return Array.isArray(subscription?.items?.data)?subscription.items.data:[]; }
function itemPriceId(item){ return typeof item?.price==='string'?item.price:item?.price?.id||item?.plan?.id||null; }

export async function purchaseSeatForMember(request,env,context,payload={}){
  requireManager(context);
  if(!context.subscription?.active) throw licensingError('The organization does not have an active subscription.',409,'SUBSCRIPTION_INACTIVE');
  const user=await ensureMemberRecord(env,context,payload,1);
  const invitation=await createInvitation(env,{organizationId:context.organization.id,userId:user.id,email:user.email,createdByUserId:context.user.id,request});
  const fresh=await licensingContext(env,context.user.email,{includeMembers:true});
  const member=fresh.members.find(row=>Number(row.user_id)===Number(user.id));
  if(member?.licensed){
    await env.NAVOFLO_DB.prepare(`UPDATE memberships SET pending_license=0,updated_at=datetime('now') WHERE organization_id=? AND user_id=?`).bind(context.organization.id,user.id).run();
    return {state:await licensingContext(env,context.user.email,{includeMembers:true}),purchase:null,invitation};
  }
  if(fresh.seats.available>0){
    await setMemberLicense(env,fresh,user.id,true);
    return {state:await licensingContext(env,context.user.email,{includeMembers:true}),purchase:null,invitation};
  }

  const subId=fresh.subscription.id;
  const stripeSub=await stripeRequest(env,`/subscriptions/${encodeURIComponent(subId)}?expand[]=items.data.price&expand[]=latest_invoice`);
  const plan=planConfig(env,fresh.subscription.plan);
  const items=subscriptionItems(stripeSub);
  const seatItem=items.find(item=>itemPriceId(item)===plan.seatPrice)||null;
  const currentExtraSeats=Math.max(0,Number(seatItem?.quantity||0));
  const targetSeats=1+currentExtraSeats+1;
  const province=String(stripeSub.metadata?.navoflo_tax_province||'').toUpperCase();
  if(province){
    const taxRates=taxRatesForProvince(env,province); const taxForm={};
    taxRates.forEach((rate,index)=>{taxForm[`default_tax_rates[${index}]`]=rate;});
    await stripeRequest(env,`/subscriptions/${encodeURIComponent(subId)}`,{method:'POST',form:taxForm,idempotencyKey:`navoflo-seat-default-taxes-${subId}-${taxRates.join('-')}`});
  }
  const form={payment_behavior:'pending_if_incomplete',proration_behavior:'always_invoice','expand[0]':'latest_invoice'};
  if(seatItem?.id){ form['items[0][id]']=seatItem.id; form['items[0][quantity]']=currentExtraSeats+1; }
  else { form['items[0][price]']=plan.seatPrice; form['items[0][quantity]']=1; }
  try{
    const updated=await stripeRequest(env,`/subscriptions/${encodeURIComponent(subId)}`,{method:'POST',form,idempotencyKey:`navoflo-seat-fasttrack-${subId}-${user.id}-${targetSeats}`});
    const invoice=typeof updated.latest_invoice==='object'?updated.latest_invoice:null;
    const paid=invoice?.status==='paid';
    return {state:await licensingContext(env,context.user.email,{includeMembers:true}),purchase:{requested:true,target_seats:targetSeats,status:paid?'paid':(updated.pending_update?'pending_payment':'processing'),billing_url:!paid?(invoice?.hosted_invoice_url||null):null},invitation};
  }catch(error){
    await env.NAVOFLO_DB.prepare(`UPDATE memberships SET pending_license=0,updated_at=datetime('now') WHERE organization_id=? AND user_id=?`).bind(context.organization.id,user.id).run();
    throw error;
  }
}

export async function createLicensingPortal(request,env,context){
  requireManager(context); const customer=context.organization.stripe_customer_id;
  if(!customer) throw licensingError('Stripe customer is not linked.',404);
  const origin=safeOrigin(request,env);
  const portal=await stripeRequest(env,'/billing_portal/sessions',{method:'POST',form:{customer,return_url:`${origin}/account/licenses/`}});
  return portal.url;
}

function productFeature(product){
  const key=String(product||'').toLowerCase();
  if(['navo2d','2d'].includes(key))return 'navo2d';
  if(['navo3d','3d'].includes(key))return 'navo3d';
  if(['automation','automatisation'].includes(key))return 'automation';
  return null;
}

export async function acquireAppLease(request,env,context,payload={}){
  const feature=productFeature(payload.product);
  if(!feature||!context.entitlements?.[feature]) throw licensingError('This license does not include the requested product.',403,'FEATURE_NOT_LICENSED');
  const deviceIdentifier=String(payload.device_id||'').trim();
  if(deviceIdentifier.length<8||deviceIdentifier.length>200) throw licensingError('A stable device identifier is required.',400,'DEVICE_ID_REQUIRED');
  const assignment=await env.NAVOFLO_DB.prepare(`SELECT id,license_type FROM license_assignments WHERE organization_id=? AND user_id=? AND active=1 LIMIT 1`).bind(context.organization.id,context.user.id).first();
  if(!assignment) throw licensingError('No active license is assigned to this user.',403,'LICENSE_REQUIRED');

  await env.NAVOFLO_DB.prepare(`
    INSERT INTO devices (user_id,device_identifier,name,last_seen_at) VALUES (?,?,?,datetime('now'))
    ON CONFLICT(user_id,device_identifier) DO UPDATE SET name=COALESCE(excluded.name,devices.name),last_seen_at=datetime('now'),revoked_at=NULL
  `).bind(context.user.id,deviceIdentifier,String(payload.device_name||'').trim().slice(0,100)||null).run();
  const device=await env.NAVOFLO_DB.prepare(`SELECT id,device_identifier,name FROM devices WHERE user_id=? AND device_identifier=? LIMIT 1`).bind(context.user.id,deviceIdentifier).first();

  // Opportunistically close expired leases for this seat. Multiple tabs on the SAME
  // workstation are allowed; a different workstation is the actual conflict.
  await env.NAVOFLO_DB.prepare(`
    UPDATE app_leases SET revoked_at=datetime('now')
    WHERE license_assignment_id=? AND revoked_at IS NULL AND datetime(expires_at)<=datetime('now')
  `).bind(assignment.id).run();

  const conflicting=await env.NAVOFLO_DB.prepare(`
    SELECT l.id,d.name,d.device_identifier,l.expires_at,l.product
    FROM app_leases l JOIN devices d ON d.id=l.device_id
    WHERE l.license_assignment_id=?
      AND l.revoked_at IS NULL
      AND datetime(l.expires_at)>datetime('now')
      AND l.device_id<>?
    ORDER BY l.last_seen_at DESC LIMIT 1
  `).bind(assignment.id,device.id).first();
  if(conflicting&&!payload.force) {
    const error=licensingError('This license is already active on another device.',409,'LICENSE_IN_USE');
    error.details={device_name:conflicting.name||'Other device',device_id:conflicting.device_identifier,expires_at:conflicting.expires_at,product:conflicting.product};
    throw error;
  }
  if(conflicting&&payload.force){
    await env.NAVOFLO_DB.prepare(`
      UPDATE app_leases SET revoked_at=datetime('now')
      WHERE license_assignment_id=? AND revoked_at IS NULL AND device_id<>?
    `).bind(assignment.id,device.id).run();
    await logAudit(env,{organizationId:context.organization.id,actorUserId:context.user.id,action:'license.device_takeover',targetUserId:context.user.id,details:{from_device:conflicting.device_identifier,to_device:deviceIdentifier}});
  }

  const rawToken=randomToken(32), tokenHash=await sha256(rawToken), expiresAt=new Date(Date.now()+LEASE_SECONDS*1000).toISOString();
  await env.NAVOFLO_DB.prepare(`
    INSERT INTO app_leases (license_assignment_id,user_id,device_id,product,lease_token_hash,expires_at)
    VALUES (?,?,?,?,?,?)
  `).bind(assignment.id,context.user.id,device.id,feature,tokenHash,expiresAt).run();
  return {lease_token:rawToken,expires_at:expiresAt,ttl_seconds:LEASE_SECONDS,heartbeat_seconds:20,device:{id:deviceIdentifier,name:device.name||null},license_type:assignment.license_type,product:feature};
}

export async function refreshAppLease(request,env,context,payload={}){
  const token=String(payload.lease_token||'');
  if(!token) throw licensingError('Lease token is required.',400,'LEASE_TOKEN_REQUIRED');
  const hash=await sha256(token);
  const lease=await env.NAVOFLO_DB.prepare(`
    SELECT id,user_id,license_assignment_id,product,revoked_at,expires_at
    FROM app_leases WHERE lease_token_hash=? LIMIT 1
  `).bind(hash).first();

  const valid=Boolean(
    lease && !lease.revoked_at &&
    Number(lease.user_id)===Number(context.user.id) &&
    Number(lease.license_assignment_id)===Number(context.user.assignment_id) &&
    context.user.licensed && context.entitlements?.[lease.product] &&
    new Date(lease.expires_at).getTime()>Date.now()
  );
  if(!valid){
    if(lease?.id) await env.NAVOFLO_DB.prepare(`UPDATE app_leases SET revoked_at=COALESCE(revoked_at,datetime('now')) WHERE id=?`).bind(lease.id).run();
    throw licensingError('The application lease is no longer valid.',409,'LEASE_INVALID');
  }
  const expiresAt=new Date(Date.now()+LEASE_SECONDS*1000).toISOString();
  await env.NAVOFLO_DB.prepare(`UPDATE app_leases SET last_seen_at=datetime('now'),expires_at=? WHERE id=?`).bind(expiresAt,lease.id).run();
  return {ok:true,expires_at:expiresAt,ttl_seconds:LEASE_SECONDS,heartbeat_seconds:20};
}

export async function releaseAppLease(env,context,payload={}){
  const token=String(payload.lease_token||''); if(!token) return {ok:true};
  const hash=await sha256(token);
  await env.NAVOFLO_DB.prepare(`UPDATE app_leases SET revoked_at=datetime('now') WHERE lease_token_hash=? AND user_id=? AND revoked_at IS NULL`).bind(hash,context.user.id).run();
  return {ok:true};
}

export async function featureAuthorized(request,env,feature){
  const email=await identityEmail(request,env); if(!email)return false;
  const context=await licensingContext(env,email,{includeMembers:false,touchLogin:true});
  return Boolean(context?.entitlements?.[feature]);
}

export function licensingJsonError(error){
  const payload={error:error.message||'Licensing request failed.',code:error.code||'LICENSING_ERROR'};
  if(error.details)payload.details=error.details;
  return json(payload,error.status||500);
}
