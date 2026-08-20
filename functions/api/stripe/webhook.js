import { json, requireEnv, upsertSubscription, verifyStripeSignature } from '../../_lib/stripe.js';

export async function onRequestPost({ request, env }) {
  const raw = await request.text();
  const signature = request.headers.get('stripe-signature');
  const secret = requireEnv(env, 'STRIPE_WEBHOOK_SECRET');
  if (!(await verifyStripeSignature(raw, signature, secret))) return json({ error: 'Invalid signature.' }, 400);

  const event = JSON.parse(raw);
  try {
    if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const s = event.data.object;
      await upsertSubscription(env, {
        stripe_subscription_id: s.id,
        stripe_customer_id: typeof s.customer === 'string' ? s.customer : s.customer?.id,
        plan: s.metadata?.navoflo_plan || null,
        seats: Number(s.metadata?.navoflo_seats || 1),
        status: s.status,
        current_period_end: s.current_period_end || null,
        cancel_at_period_end: Boolean(s.cancel_at_period_end)
      });
    }

    if (event.type === 'checkout.session.completed') {
      const s = event.data.object;
      if (s.subscription) {
        await upsertSubscription(env, {
          stripe_subscription_id: typeof s.subscription === 'string' ? s.subscription : s.subscription?.id,
          stripe_customer_id: typeof s.customer === 'string' ? s.customer : s.customer?.id,
          customer_email: s.customer_details?.email || s.customer_email || null,
          plan: s.metadata?.navoflo_plan || null,
          seats: Number(s.metadata?.navoflo_seats || 1),
          status: s.payment_status === 'paid' ? 'active' : 'pending_payment'
        });
      }
    }

    if (event.type === 'invoice.paid' || event.type === 'invoice.payment_failed') {
      const invoice = event.data.object;
      const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
      if (subscriptionId && env?.NAVOFLO_DB) {
        await env.NAVOFLO_DB.prepare(`UPDATE subscriptions SET status=?, updated_at=datetime('now') WHERE stripe_subscription_id=?`)
          .bind(event.type === 'invoice.paid' ? 'active' : 'past_due', subscriptionId).run();
      }
    }

    return json({ received: true });
  } catch (error) {
    console.error('stripe-webhook-handler', event.type, error);
    return json({ error: 'Webhook handler failed.' }, 500);
  }
}
