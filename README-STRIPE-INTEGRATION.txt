NavoFlo Stripe V4 — Cloudflare Workers native
==============================================

This version is for the current NavoFlo deployment architecture:
Cloudflare Workers + Static Assets + `npx wrangler deploy`.

IMPORTANT CHANGE FROM V3
------------------------
V3 used a /functions directory (Cloudflare Pages Functions routing).
The current NavoFlo project is a Workers Static Assets deployment, not Pages.
V4 replaces /functions with a real Worker entrypoint:

  src/index.js

and adds:

  wrangler.jsonc

The Worker handles /api/stripe/* and delegates the rest of the site to
Cloudflare Static Assets through env.ASSETS.

Expected webhook browser test after deployment:
  GET https://navoflo.com/api/stripe/webhook
  -> HTTP 405 Method Not Allowed

That is intentional: Stripe sends POST requests, not GET requests.

## V5 - PAD mandate fix
Canadian ACSS Debit (PAD) Checkout now sends the full Stripe mandate terms required for an annual business subscription:
- `payment_schedule=interval`
- localized annual `interval_description`
- `transaction_type=business`

This fixes Stripe error: `acss_debit requires payment_method_options[acss_debit][mandate_options] to be set`.

IMPORTANT V5.1: `keep_vars: true` is enabled in `wrangler.jsonc` so Git/Wrangler code deployments preserve Runtime Variables configured in the Cloudflare dashboard. Secrets remain protected.


V6.5: Card and Canadian PAD are now separate Stripe flows. PAD is collected in Checkout setup mode and the annual subscription is created from the setup_intent.succeeded webhook because Stripe Checkout subscription mode does not support acss_debit. Add setup_intent.succeeded to the Stripe webhook destination.

V6.5: PAD Setup Checkout now follows Stripe Billing's ACSS Debit mandate shape: mandate_options only sets default_for=[invoice, subscription]. payment_schedule and interval_description are intentionally omitted because Stripe rejects them when default_for is provided.
V6.5: Canadian PAD mandates are explicitly marked `transaction_type=business` in both Checkout setup and the Billing subscription payment settings. This makes Stripe display the service/transaction type as business instead of the default personal value.


V6.5 PAD initial payment: after the reusable PAD mandate succeeds and the subscription is created with `default_incomplete`, NavoFlo explicitly confirms the first invoice PaymentIntent using the saved PaymentMethod + Mandate. This starts the actual debit and prevents the subscription from remaining `incomplete` solely because the PaymentIntent was never confirmed.
