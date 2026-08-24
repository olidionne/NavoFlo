import { json } from './lib/stripe.js';
import { createCheckout } from './handlers/create-checkout.js';
import { getSession } from './handlers/session.js';
import { createPortal } from './handlers/portal.js';
import { handleWebhook } from './handlers/webhook.js';

const API = Object.freeze({
  '/api/stripe/create-checkout': { POST: createCheckout },
  '/api/stripe/session': { GET: getSession },
  '/api/stripe/portal': { POST: createPortal },
  '/api/stripe/webhook': { POST: handleWebhook }
});

function methodNotAllowed(allowed) {
  return json(
    { error: 'Method not allowed.' },
    405,
    { Allow: allowed.join(', ') }
  );
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

    if (url.pathname.startsWith('/api/')) {
      return json({ error: 'API route not found.' }, 404);
    }

    return env.ASSETS.fetch(request);
  }
};
