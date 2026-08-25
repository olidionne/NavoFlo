import { json } from './lib/stripe.js';
import { createCheckout } from './handlers/create-checkout.js';
import { getSession } from './handlers/session.js';
import { createPortal } from './handlers/portal.js';
import { handleWebhook } from './handlers/webhook.js';
import {
  createAccountPortal,
  createLicensingMember,
  deleteLicensingMember,
  getLicensingMe,
  updateLicensingMemberLicense
} from './handlers/licensing.js';
import { featureAuthorized } from './lib/licensing.js';

const API = Object.freeze({
  '/api/stripe/create-checkout': { POST: createCheckout },
  '/api/stripe/session': { GET: getSession },
  '/api/stripe/portal': { POST: createPortal },
  '/api/stripe/webhook': { POST: handleWebhook },
  '/api/licensing/me': { GET: getLicensingMe },
  '/api/licensing/members': { POST: createLicensingMember },
  '/api/licensing/portal': { POST: createAccountPortal }
});

function methodNotAllowed(allowed) {
  return json({ error: 'Method not allowed.' }, 405, { Allow: allowed.join(', ') });
}

function featureForPath(pathname) {
  if (pathname === '/navo2d' || pathname.startsWith('/navo2d/')) return 'navo2d';
  if (pathname === '/navo3d' || pathname.startsWith('/navo3d/')) return 'navo3d';
  if (pathname === '/en/navo2d' || pathname.startsWith('/en/navo2d/')) return 'navo2d';
  if (pathname === '/en/navo3d' || pathname.startsWith('/en/navo3d/')) return 'navo3d';
  return null;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const route = API[url.pathname];

    if (route) {
      const handler = route[request.method];
      if (!handler) return methodNotAllowed(Object.keys(route));
      return handler({ request, env, ctx });
    }

    const memberMatch = url.pathname.match(/^\/api\/licensing\/members\/(\d+)(\/license)?$/);
    if (memberMatch) {
      const userId = memberMatch[1];
      if (memberMatch[2] === '/license') {
        if (request.method !== 'POST') return methodNotAllowed(['POST']);
        return updateLicensingMemberLicense({ request, env, ctx, userId });
      }
      if (request.method !== 'DELETE') return methodNotAllowed(['DELETE']);
      return deleteLicensingMember({ request, env, ctx, userId });
    }

    if (url.pathname.startsWith('/api/')) {
      return json({ error: 'API route not found.' }, 404);
    }

    if (String(env?.NAVOFLO_ENFORCE_LICENSES || '').toLowerCase() === 'true') {
      const feature = featureForPath(url.pathname);
      if (feature && !(await featureAuthorized(request, env, feature))) {
        const target = url.pathname.startsWith('/en/') ? '/en/account/licenses/?denied=1' : '/account/licenses/?denied=1';
        return Response.redirect(new URL(target, url.origin), 302);
      }
    }

    return env.ASSETS.fetch(request);
  }
};
