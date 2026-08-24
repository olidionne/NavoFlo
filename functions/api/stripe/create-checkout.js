import { json, planConfig, provinceFromCanadianPostalCode, provinceLabel, safeOrigin, stripeRequest, taxRatesForProvince } from '../../_lib/stripe.js';

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const body = await request.json();
    const plan = planConfig(env, body.plan);
    const seats = Math.max(1, Math.min(250, Math.floor(Number(body.seats) || 1)));
    const locale = body.locale === 'en' ? 'en' : 'fr';
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

    const form = {
      mode: 'subscription',
      locale,
      'payment_method_types[0]': 'card',
      'payment_method_types[1]': 'acss_debit',
      'payment_method_options[acss_debit][mandate_options][transaction_type]': 'business',
      'line_items[0][price]': plan.mainPrice,
      'line_items[0][quantity]': 1,
      success_url: `${origin}/${locale === 'en' ? 'en/' : ''}billing/success/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/${locale === 'en' ? 'en/' : ''}pricing/?canceled=1`,
      billing_address_collection: 'required',
      'tax_id_collection[enabled]': 'true',
      'subscription_data[metadata][navoflo_plan]': plan.code,
      'subscription_data[metadata][navoflo_seats]': seats,
      'subscription_data[metadata][navoflo_tax_province]': province,
      'subscription_data[metadata][navoflo_postal_fsa]': postalCode.replace(/\s+/g, '').slice(0, 3),
      'metadata[navoflo_plan]': plan.code,
      'metadata[navoflo_seats]': seats,
      'metadata[navoflo_tax_province]': province,
      'metadata[navoflo_postal_fsa]': postalCode.replace(/\s+/g, '').slice(0, 3),
      'metadata[source]': 'navoflo_web'
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
      idempotencyKey: `navoflo-${crypto.randomUUID()}`
    });

    return json({ url: session.url, session_id: session.id });
  } catch (error) {
    console.error('create-checkout', error);
    return json({ error: error.message || 'Unable to create checkout.' }, error.status || 500);
  }
}
