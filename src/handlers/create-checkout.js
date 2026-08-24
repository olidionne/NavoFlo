import { json, planConfig, provinceFromCanadianPostalCode, provinceLabel, safeOrigin, stripeRequest, taxRatesForProvince } from '../lib/stripe.js';

export async function createCheckout(context) {
  try {
    const { request, env } = context;
    const body = await request.json();
    const plan = planConfig(env, body.plan);
    const seats = Math.max(1, Math.min(250, Math.floor(Number(body.seats) || 1)));
    const locale = body.locale === 'en' ? 'en' : 'fr';
    const paymentMethod = body.paymentMethod === 'pad' ? 'pad' : 'card';
    const postalCode = String(body.postalCode || '').trim().toUpperCase();
    const province = provinceFromCanadianPostalCode(postalCode);
    const origin = safeOrigin(request, env);

    let taxRates;
    try {
      taxRates = taxRatesForProvince(env, province);
    } catch (error) {
      if (String(error.message || '').includes('Manual tax rates are not configured')) {
        const region = provinceLabel(province, locale);
        return json({
          error: locale === 'fr'
            ? `L’abonnement en ligne n’est pas encore configuré pour ${region}. Contactez NavoFlo pour cette province.`
            : `Online subscription is not yet configured for ${region}. Contact NavoFlo for this province.`
        }, 400);
      }
      throw error;
    }

    const metadata = {
      navoflo_plan: plan.code,
      navoflo_seats: seats,
      navoflo_tax_province: province,
      navoflo_postal_fsa: postalCode.replace(/\s+/g, '').slice(0, 3),
      navoflo_payment_method: paymentMethod,
      source: 'navoflo_web'
    };

    if (paymentMethod === 'pad') {
      // Stripe Checkout does not support acss_debit in subscription mode.
      // We therefore use Checkout setup mode to collect/verify the Canadian bank account
      // and annual PAD mandate, then create the recurring subscription from the
      // setup_intent.succeeded webhook.
      const form = {
        mode: 'setup',
        locale,
        customer_creation: 'always',
        'payment_method_types[0]': 'acss_debit',
        'payment_method_options[acss_debit][currency]': 'cad',
        // For a PAD method that will be reused by Stripe Billing, Stripe requires
        // default_for=[invoice,subscription]. In this Billing-specific setup flow,
        // payment_schedule / interval_description (and custom_mandate_url) must NOT
        // be sent alongside default_for.
        'payment_method_options[acss_debit][mandate_options][default_for][0]': 'invoice',
        'payment_method_options[acss_debit][mandate_options][default_for][1]': 'subscription',
        success_url: `${origin}/${locale === 'en' ? 'en/' : ''}billing/success/?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/${locale === 'en' ? 'en/' : ''}pricing/?canceled=1`,
        billing_address_collection: 'required',
        ...Object.fromEntries(Object.entries(metadata).map(([k, v]) => [`metadata[${k}]`, v])),
        ...Object.fromEntries(Object.entries(metadata).map(([k, v]) => [`setup_intent_data[metadata][${k}]`, v]))
      };

      const session = await stripeRequest(env, '/checkout/sessions', {
        method: 'POST', form,
        idempotencyKey: `navoflo-pad-setup-${crypto.randomUUID()}`
      });
      return json({ url: session.url, session_id: session.id, flow: 'pad_setup' });
    }

    const form = {
      mode: 'subscription',
      locale,
      'payment_method_types[0]': 'card',
      'line_items[0][price]': plan.mainPrice,
      'line_items[0][quantity]': 1,
      success_url: `${origin}/${locale === 'en' ? 'en/' : ''}billing/success/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/${locale === 'en' ? 'en/' : ''}pricing/?canceled=1`,
      billing_address_collection: 'required',
      'tax_id_collection[enabled]': 'true',
      'subscription_data[metadata][navoflo_plan]': plan.code,
      'subscription_data[metadata][navoflo_seats]': seats,
      'subscription_data[metadata][navoflo_tax_province]': province,
      'subscription_data[metadata][navoflo_postal_fsa]': metadata.navoflo_postal_fsa,
      'subscription_data[metadata][navoflo_payment_method]': 'card',
      ...Object.fromEntries(Object.entries(metadata).map(([k, v]) => [`metadata[${k}]`, v]))
    };

    taxRates.forEach((rate, index) => {
      form[`line_items[0][tax_rates][${index}]`] = rate;
    });

    if (seats > 1) {
      form['line_items[1][price]'] = plan.seatPrice;
      form['line_items[1][quantity]'] = seats - 1;
      taxRates.forEach((rate, index) => {
        form[`line_items[1][tax_rates][${index}]`] = rate;
      });
    }

    const session = await stripeRequest(env, '/checkout/sessions', {
      method: 'POST', form,
      idempotencyKey: `navoflo-card-${crypto.randomUUID()}`
    });

    return json({ url: session.url, session_id: session.id, flow: 'card_subscription' });
  } catch (error) {
    console.error('create-checkout', error);
    return json({ error: error.message || 'Unable to create checkout.' }, error.status || 500);
  }
}
