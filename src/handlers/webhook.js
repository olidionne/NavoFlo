import {
  json,
  planConfig,
  requireEnv,
  stripeRequest,
  taxRatesForProvince,
  upsertSubscription,
  verifyStripeSignature
} from '../lib/stripe.js';

async function createPadSubscriptionFromSetupIntent(env, setupIntent) {
  const meta = setupIntent?.metadata || {};
  if (meta.navoflo_payment_method !== 'pad') return null;

  const customer = typeof setupIntent.customer === 'string' ? setupIntent.customer : setupIntent.customer?.id;
  const paymentMethod = typeof setupIntent.payment_method === 'string' ? setupIntent.payment_method : setupIntent.payment_method?.id;
  if (!customer || !paymentMethod) throw new Error('PAD setup is missing customer or payment method.');

  const plan = planConfig(env, meta.navoflo_plan);
  const seats = Math.max(1, Math.min(250, Math.floor(Number(meta.navoflo_seats) || 1)));
  const province = String(meta.navoflo_tax_province || '').toUpperCase();
  const taxRates = taxRatesForProvince(env, province);

  // Make the verified PAD method the default for future invoice/subscription debits.
  await stripeRequest(env, `/customers/${encodeURIComponent(customer)}`, {
    method: 'POST',
    form: { 'invoice_settings[default_payment_method]': paymentMethod },
    idempotencyKey: `navoflo-pad-customer-${setupIntent.id}`
  });

  const form = {
    customer,
    default_payment_method: paymentMethod,
    payment_behavior: 'default_incomplete',
    'payment_settings[payment_method_types][0]': 'acss_debit',
    'payment_settings[save_default_payment_method]': 'on_subscription',
    'items[0][price]': plan.mainPrice,
    'items[0][quantity]': 1,
    'metadata[navoflo_plan]': plan.code,
    'metadata[navoflo_seats]': seats,
    'metadata[navoflo_tax_province]': province,
    'metadata[navoflo_postal_fsa]': meta.navoflo_postal_fsa || '',
    'metadata[navoflo_payment_method]': 'pad',
    'metadata[navoflo_setup_intent]': setupIntent.id
  };

  taxRates.forEach((rate, index) => {
    form[`items[0][tax_rates][${index}]`] = rate;
  });

  if (seats > 1) {
    form['items[1][price]'] = plan.seatPrice;
    form['items[1][quantity]'] = seats - 1;
    taxRates.forEach((rate, index) => {
      form[`items[1][tax_rates][${index}]`] = rate;
    });
  }

  const subscription = await stripeRequest(env, '/subscriptions', {
    method: 'POST', form,
    idempotencyKey: `navoflo-pad-subscription-${setupIntent.id}`
  });

  await upsertSubscription(env, {
    stripe_subscription_id: subscription.id,
    stripe_customer_id: customer,
    plan: plan.code,
    seats,
    status: subscription.status,
    current_period_end: subscription.current_period_end || null,
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end)
  });

  return subscription;
}

export async function handleWebhook({ request, env }) {
  const raw = await request.text();
  const signature = request.headers.get('stripe-signature');
  const secret = requireEnv(env, 'STRIPE_WEBHOOK_SECRET');
  if (!(await verifyStripeSignature(raw, signature, secret))) return json({ error: 'Invalid signature.' }, 400);

  const event = JSON.parse(raw);
  try {
    if (event.type === 'setup_intent.succeeded') {
      await createPadSubscriptionFromSetupIntent(env, event.data.object);
    }

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

      // Card Checkout already created the subscription for us.
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

      // PAD Checkout runs in setup mode. Some Stripe webhook destinations may not
      // subscribe to setup_intent.succeeded, so also finish the PAD subscription
      // from checkout.session.completed. The subscription creation uses an
      // idempotency key based on the SetupIntent, so receiving both events is safe.
      if (!s.subscription && s.mode === 'setup' && s.setup_intent) {
        const setupIntentId = typeof s.setup_intent === 'string' ? s.setup_intent : s.setup_intent?.id;
        if (setupIntentId) {
          const setupIntent = await stripeRequest(env, `/setup_intents/${encodeURIComponent(setupIntentId)}`);
          if (setupIntent.status === 'succeeded') {
            await createPadSubscriptionFromSetupIntent(env, setupIntent);
          }
        }
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
