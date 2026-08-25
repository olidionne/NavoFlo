import { json } from '../lib/stripe.js';
import {
  addMember,
  createLicensingPortal,
  purchaseSeatForMember,
  licensingJsonError,
  removeMember,
  requireLicensingContext,
  setMemberLicense
} from '../lib/licensing.js';

export async function getLicensingMe({ request, env }) {
  try {
    const context = await requireLicensingContext(request, env, { includeMembers: true });
    return json(context, 200, { 'cache-control': 'no-store' });
  } catch (error) {
    return licensingJsonError(error);
  }
}

export async function createLicensingMember({ request, env }) {
  try {
    const context = await requireLicensingContext(request, env, { includeMembers: true });
    const body = await request.json().catch(() => ({}));
    return json(await addMember(env, context, body), 200, { 'cache-control': 'no-store' });
  } catch (error) {
    return licensingJsonError(error);
  }
}

export async function updateLicensingMemberLicense({ request, env, userId }) {
  try {
    const context = await requireLicensingContext(request, env, { includeMembers: true });
    const body = await request.json().catch(() => ({}));
    if (typeof body.active !== 'boolean') return json({ error: 'active must be true or false.' }, 400);
    return json(await setMemberLicense(env, context, userId, body.active), 200, { 'cache-control': 'no-store' });
  } catch (error) {
    return licensingJsonError(error);
  }
}

export async function deleteLicensingMember({ request, env, userId }) {
  try {
    const context = await requireLicensingContext(request, env, { includeMembers: true });
    return json(await removeMember(env, context, userId), 200, { 'cache-control': 'no-store' });
  } catch (error) {
    return licensingJsonError(error);
  }
}


export async function fastTrackLicensingSeat({ request, env }) {
  try {
    const context = await requireLicensingContext(request, env, { includeMembers: true });
    const body = await request.json().catch(() => ({}));
    return json(await purchaseSeatForMember(request, env, context, body), 200, { 'cache-control': 'no-store' });
  } catch (error) {
    return licensingJsonError(error);
  }
}

export async function createAccountPortal({ request, env }) {
  try {
    const context = await requireLicensingContext(request, env, { includeMembers: false });
    return json({ url: await createLicensingPortal(request, env, context) });
  } catch (error) {
    return licensingJsonError(error);
  }
}
