import {
  ensureOrganization,
  json,
  markWebhookEventProcessed,
  padEnabled,
  planConfig,
  requireEnv,
  stripeRequest,
  subscriptionPeriodEnd,
  taxRatesForProvince,
  upsertSubscription,
  verifyStripeSignature,
  webhookEventAlreadyProcessed
} from '../lib/stripe.js';
import { assignPendingLicenses, ensureBillingOwnerLicense } from '../lib/licensing.js';

function objectId(value) {
  return typeof value === 'string' ? value : value?.id || null;
}

function subscriptionItemPriceId(item) {
  return typeof item?.price === 'string' ? item.price : item?.price?.id || item?.plan?.id || null;
}

function seatsFromSubscription(env, subscription, planCode, fallback = 1) {
  try {
    if (!planCode || !Array.isArray(subscription?.items?.data)) return Number(fallback || 1);
    const plan = planConfig(env, planCode);
    let main = 0;
    let extras = 0;
    for (const item of subscription.items.data) {
      const priceId = subscriptionItemPriceId(item);
      const quantity = Math.max(0, Number(item?.quantity || 0));
      if (priceId === plan.mainPrice) main += quantity;
      if (priceId === plan.seatPrice) extras += quantity;
    }
    if (main > 0) return Math.max(1, main + extras);
    return Math.max(1, extras + Number(fallback || 1));
  } catch {
    return Number(fallback || 1);
  }
}

async function organizationForCustomer(env, customerId, hints = {}) {
  if (!customerId || !env?.NAVOFLO_DB) return null;

  let customer = null;
  if (!hints.name || !hints.billing_email) {
    try {
      customer = await stripeRequest(env, `/customers/${encodeURIComponent(customerId)}`);
    } catch (error) {
      console.warn('stripe-customer-fetch', customerId, error?.message || error);
    }
  }

  return ensureOrganization(env, {
    stripe_customer_id: customerId,
    name: hints.name || customer?.name || null,
    billing_email: hints.billing_email || customer?.email || null
  });
}

async function syncSubscription(env, subscription, hints = {}) {
  if (!subscription?.id) return;

  const customerId = objectId(subscription.customer) || hints.stripe_customer_id || null;
  const organization = customerId
    ? await organizationForCustomer(env, customerId, {
        name: hints.organization_name || null,
        billing_email: hints.customer_email || null
      })
    : null;

  const planCode = subscription.metadata?.navoflo_plan || hints.plan || null;
  const fallbackSeats = Number(subscription.metadata?.navoflo_seats || hints.seats || 1);
  const row = {
    stripe_subscription_id: subscription.id,
    stripe_customer_id: customerId,
    customer_email: hints.customer_email || organization?.billing_email || null,
    plan: planCode,
    seats: seatsFromSubscription(env, subscription, planCode, fallbackSeats),
    status: subscription.status || hints.status || 'unknown',
    current_period_end: subscriptionPeriodEnd(subscription),
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    organization_id: organization?.id || null
  };
  await upsertSubscription(env, row);

  if (organization?.id && row.customer_email) {
    await ensureBillingOwnerLicense(env, {
      organization,
      email: row.customer_email,
      display_name: hints.customer_name || null,
      subscription: row
    });
  }
  if (organization?.id) {
    await assignPendingLicenses(env, organization.id, row);
  }
}

async function payPadInitialInvoice(env, setupIntent, subscription, paymentMethod) {
  const latest = subscription?.latest_invoice;
  const invoiceId = objectId(latest);
  if (!invoiceId) throw new Error('PAD subscription is missing the first invoice.');

  return stripeRequest(env, `/invoices/${encodeURIComponent(invoiceId)}/pay`, {
    method: 'POST',
    form: { payment_method: paymentMethod },
    idempotencyKey: `navoflo-pad-initial-invoice-pay-${setupIntent.id}`
  });
}

async function createPadSubscriptionFromSetupIntent(env, setupIntent) {
  if (!padEnabled(env)) return null;

  const meta = setupIntent?.metadata || {};
  if (meta.navoflo_payment_method !== 'pad') return null;

  const customer = objectId(setupIntent.customer);
  const paymentMethod = objectId(setupIntent.payment_method);
  if (!customer || !paymentMethod) throw new Error('PAD setup is missing customer or payment method.');

  const plan = planConfig(env, meta.navoflo_plan);
  const seats = Math.max(1, Math.min(250, Math.floor(Number(meta.navoflo_seats) || 1)));
  const province = String(meta.navoflo_tax_province || '').toUpperCase();
  const taxRates = taxRatesForProvince(env, province);

  await stripeRequest(env, `/customers/${encodeURIComponent(customer)}`, {
    method: 'POST',
    form: { 'invoice_settings[default_payment_method]': paymentMethod },
    idempotencyKey: `navoflo-pad-customer-${setupIntent.id}`
  });

  const form = {
    customer,
    default_payment_method: paymentMethod,
    payment_behavior: 'default_incomplete',
    'expand[0]': 'latest_invoice.payment_intent',
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

  let subscription = await stripeRequest(env, '/subscriptions', {
    method: 'POST',
    form,
    idempotencyKey: `navoflo-pad-subscription-${setupIntent.id}`
  });

  await payPadInitialInvoice(env, setupIntent, subscription, paymentMethod);
  subscription = await stripeRequest(env, `/subscriptions/${encodeURIComponent(subscription.id)}`);
  await syncSubscription(env, subscription);
  return subscription;
}

export async function handleWebhook({ request, env }) {
  const raw = await request.text();
  const signature = request.headers.get('stripe-signature');
  const secret = requireEnv(env, 'STRIPE_WEBHOOK_SECRET');
  if (!(await verifyStripeSignature(raw, signature, secret))) {
    return json({ error: 'Invalid signature.' }, 400);
  }

  const event = JSON.parse(raw);

  try {
    if (await webhookEventAlreadyProcessed(env, event.id)) {
      return json({ received: true, duplicate: true });
    }

    if (event.type === 'setup_intent.succeeded') {
      await createPadSubscriptionFromSetupIntent(env, event.data.object);
    }

    if (
      event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.deleted'
    ) {
      await syncSubscription(env, event.data.object);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const customerId = objectId(session.customer);
      const email = session.customer_details?.email || session.customer_email || null;
      const organizationName =
        session.customer_details?.business_name ||
        session.collected_information?.business_name ||
        session.customer_details?.name ||
        null;

      if (customerId) {
        await organizationForCustomer(env, customerId, {
          name: organizationName,
          billing_email: email
        });
      }

      // Card Checkout creates the Subscription itself. Retrieve the full object so
      // we store the real Stripe status and the billing period from subscription items.
      const subscriptionId = objectId(session.subscription);
      if (subscriptionId) {
        const subscription = await stripeRequest(env, `/subscriptions/${encodeURIComponent(subscriptionId)}`);
        await syncSubscription(env, subscription, {
          stripe_customer_id: customerId,
          customer_email: email,
          customer_name: session.customer_details?.name || null,
          organization_name: organizationName,
          plan: session.metadata?.navoflo_plan || null,
          seats: Number(session.metadata?.navoflo_seats || 1)
        });
      }

      // Keep legacy PAD setup events harmless while PAD is disabled.
      if (!subscriptionId && session.mode === 'setup' && session.setup_intent && padEnabled(env)) {
        const setupIntentId = objectId(session.setup_intent);
        const setupIntent = await stripeRequest(env, `/setup_intents/${encodeURIComponent(setupIntentId)}`);
        if (setupIntent.status === 'succeeded') {
          await createPadSubscriptionFromSetupIntent(env, setupIntent);
        }
      }
    }

    if (event.type === 'invoice.paid' || event.type === 'invoice.payment_failed') {
      const invoice = event.data.object;
      const subscriptionId = objectId(invoice.subscription);
      if (subscriptionId) {
        // Fetch the subscription because in current Stripe API versions the billing
        // period is stored on subscription items rather than on the subscription root.
        const subscription = await stripeRequest(env, `/subscriptions/${encodeURIComponent(subscriptionId)}`);
        await syncSubscription(env, subscription, {
          customer_email: invoice.customer_email || null,
          status: event.type === 'invoice.paid' ? 'active' : 'past_due'
        });

        if (event.type === 'invoice.payment_failed' && env?.NAVOFLO_DB) {
          await env.NAVOFLO_DB.prepare(
            `UPDATE subscriptions SET status='past_due', updated_at=datetime('now') WHERE stripe_subscription_id=?`
          ).bind(subscriptionId).run();
        }
      }
    }

    await markWebhookEventProcessed(env, event);
    return json({ received: true });
  } catch (error) {
    console.error('stripe-webhook-handler', event.type, error);
    return json({ error: 'Webhook handler failed.' }, 500);
  }
}
