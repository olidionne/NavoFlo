import { json, stripeRequest } from '../lib/stripe.js';

export async function getSession({ request, env }) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('session_id');
    if (!id || !id.startsWith('cs_')) return json({ error: 'Invalid session.' }, 400);
    const s = await stripeRequest(env, `/checkout/sessions/${encodeURIComponent(id)}?expand[]=subscription`);
    const subscription = typeof s.subscription === 'object' ? s.subscription : null;
    const customerEmail = s.customer_details?.email || s.customer_email || null;
    let accountStatus = 'provisioning';
    if (env?.NAVOFLO_DB && customerEmail) {
      const account = await env.NAVOFLO_DB.prepare(`
        SELECT password_hash, status FROM users WHERE email=? COLLATE NOCASE LIMIT 1
      `).bind(customerEmail).first();
      if (account?.password_hash && account.status === 'active') accountStatus = 'ready';
      else if (account && !account.password_hash) accountStatus = 'pending_activation';
    }
    return json({
      customer_name: s.customer_details?.name || null,
      customer_email: customerEmail,
      account_status: accountStatus,
      payment_status: s.payment_status,
      status: s.status,
      mode: s.mode || null,
      payment_flow: s.metadata?.navoflo_payment_method || subscription?.metadata?.navoflo_payment_method || null,
      subscription_status: subscription?.status || null,
      plan: s.metadata?.navoflo_plan || subscription?.metadata?.navoflo_plan || null,
      seats: Number(s.metadata?.navoflo_seats || subscription?.metadata?.navoflo_seats || 1),
      customer_id: typeof s.customer === 'string' ? s.customer : s.customer?.id || null
    });
  } catch (error) {
    return json({ error: error.message || 'Unable to retrieve session.' }, error.status || 500);
  }
}
