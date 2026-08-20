import { json, planConfig, safeOrigin, stripeRequest } from '../../_lib/stripe.js';

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const body = await request.json();
    const plan = planConfig(env, body.plan);
    const seats = Math.max(1, Math.min(250, Math.floor(Number(body.seats) || 1)));
    const locale = body.locale === 'en' ? 'en' : 'fr';
    const origin = safeOrigin(request, env);

    const form = {
      mode: 'subscription',
      locale,
      'payment_method_types[0]': 'card',
      'payment_method_types[1]': 'acss_debit',
      'line_items[0][price]': plan.mainPrice,
      'line_items[0][quantity]': 1,
      success_url: `${origin}/${locale === 'en' ? 'en/' : ''}billing/success/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/${locale === 'en' ? 'en/' : ''}pricing/?canceled=1`,
      billing_address_collection: 'required',
      'tax_id_collection[enabled]': 'true',
      'subscription_data[metadata][navoflo_plan]': plan.code,
      'subscription_data[metadata][navoflo_seats]': seats,
      'metadata[navoflo_plan]': plan.code,
      'metadata[navoflo_seats]': seats,
      'metadata[source]': 'navoflo_web'
    };

    if (seats > 1) {
      form['line_items[1][price]'] = plan.seatPrice;
      form['line_items[1][quantity]'] = seats - 1;
    }

    if (String(env.STRIPE_AUTOMATIC_TAX || '').toLowerCase() === 'true') {
      form['automatic_tax[enabled]'] = 'true';
    }

    const session = await stripeRequest(env, '/checkout/sessions', {
      method: 'POST', form,
      idempotencyKey: `navoflo-${crypto.randomUUID()}`
    });

    return json({ url: session.url, session_id: session.id });
  } catch (error) {
    console.error('create-checkout', error);
    return json({ error: error.message || 'Unable to create checkout.' }, error.status || 500);
  }
}
