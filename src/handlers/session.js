import { json, stripeRequest } from '../lib/stripe.js';

export async function getSession({ request, env }) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('session_id');
    if (!id || !id.startsWith('cs_')) return json({ error: 'Invalid session.' }, 400);
    const s = await stripeRequest(env, `/checkout/sessions/${encodeURIComponent(id)}?expand[]=subscription`);
    const subscription = typeof s.subscription === 'object' ? s.subscription : null;
    return json({
      customer_name: s.customer_details?.name || null,
      customer_email: s.customer_details?.email || s.customer_email || null,
      payment_status: s.payment_status,
      status: s.status,
      subscription_status: subscription?.status || null,
      plan: s.metadata?.navoflo_plan || subscription?.metadata?.navoflo_plan || null,
      seats: Number(s.metadata?.navoflo_seats || subscription?.metadata?.navoflo_seats || 1),
      customer_id: typeof s.customer === 'string' ? s.customer : s.customer?.id || null
    });
  } catch (error) {
    return json({ error: error.message || 'Unable to retrieve session.' }, error.status || 500);
  }
}
