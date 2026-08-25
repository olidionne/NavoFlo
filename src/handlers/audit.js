import { json } from '../lib/stripe.js';
import { organizationAudit } from '../lib/audit.js';
import { licensingJsonError } from '../lib/licensing.js';

export async function getOrganizationAudit({ request, env }) {
  try {
    return json(await organizationAudit(request, env), 200, { 'cache-control':'no-store' });
  } catch (error) {
    return licensingJsonError(error);
  }
}
