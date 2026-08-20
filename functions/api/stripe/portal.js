import { json, safeOrigin, stripeRequest } from '../../_lib/stripe.js';

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const sessionId = String(body.session_id || '');
    if (!sessionId.startsWith('cs_')) return json({ error: 'Invalid session.' }, 400);
    const checkout = await stripeRequest(env, `/checkout/sessions/${encodeURIComponent(sessionId)}`);
    const customer = typeof checkout.customer === 'string' ? checkout.customer : checkout.customer?.id;
    if (!customer) return json({ error: 'Customer not found.' }, 404);
    const origin = safeOrigin(request, env);
    const portal = await stripeRequest(env, '/billing_portal/sessions', {
      method: 'POST',
      form: { customer, return_url: `${origin}/pricing/` }
    });
    return json({ url: portal.url });
  } catch (error) {
    return json({ error: error.message || 'Unable to open customer portal.' }, error.status || 500);
  }
}
