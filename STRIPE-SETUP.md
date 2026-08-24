# NavoFlo — Stripe Billing setup V4
## Native Cloudflare Workers + Static Assets

V4 matches the current NavoFlo deployment: **Cloudflare Workers + Static Assets**, deployed with `npx wrangler deploy`.

## 0. Why V4 exists
V3 used a `/functions` directory, which is file-based routing for **Cloudflare Pages Functions**. The current NavoFlo deployment is a Worker whose existing site is served as Static Assets. V4 adds a real Worker entry point (`src/index.js`) and an `ASSETS` binding, so `/api/stripe/*` executes server-side while the existing `public/` site remains static.

## 1. Files that matter
- `wrangler.jsonc`
- `src/index.js`
- `src/lib/stripe.js`
- `src/handlers/*.js`
- `public/...`
- `migrations/0001_billing.sql`

The old `/functions` folder is intentionally removed.

## 2. Stripe products / annual prices
Create/copy the sandbox `price_...` IDs for:
- NavoBase Main — 1995 CAD/year
- NavoBase Additional Seat — 495 CAD/year
- NavoPro Main — 3495 CAD/year
- NavoPro Additional Seat — 895 CAD/year

Prices must be tax-exclusive.

## 3. Payment methods
Enable:
- Card
- Canadian pre-authorized debit / ACSS Debit (PAD)

## 4. Manual tax rates
Automatic Stripe Tax is not used by Checkout.
For Quebec configure:
- TPS/GST 5% — exclusive
- TVQ/QST 9.975% — exclusive

Copy both `txr_...` IDs.

## 5. Cloudflare Worker runtime variables / secrets
Once V4 is deployed, the Worker is no longer assets-only, so Runtime Variables/Secrets become available in Cloudflare.

Configure:

Secrets:
- `STRIPE_SECRET_KEY=sk_test_...`
- `STRIPE_WEBHOOK_SECRET=whsec_...`

Variables:
- `STRIPE_PRICE_NAVOBASE_MAIN=price_...`
- `STRIPE_PRICE_NAVOBASE_SEAT=price_...`
- `STRIPE_PRICE_NAVOPRO_MAIN=price_...`
- `STRIPE_PRICE_NAVOPRO_SEAT=price_...`
- `STRIPE_TAX_RATES_QC=txr_GST_ID,txr_QST_ID`
- `PUBLIC_APP_URL=https://navoflo.com`

Never commit `sk_...` or `whsec_...` values to GitHub.
If a secret key appeared in a screenshot or chat, rotate it before use.

## 6. Webhook + Cloudflare Access
Webhook URL:
`https://navoflo.com/api/stripe/webhook`

Cloudflare Access configuration already planned:
- `navoflo.com/*` -> Allow only development user(s)
- `/api/stripe/webhook` -> Bypass / Everyone

The webhook is still protected by Stripe signature verification.

Stripe webhook events:
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`
- `setup_intent.succeeded`

After deployment, opening the webhook URL in a browser should return **405 Method Not Allowed** instead of Cloudflare Access or a static 404.

## 7. Optional D1
The code works without D1, but persistent subscription state is strongly recommended before licence activation goes live.
Create a D1 database and bind it to this Worker as `NAVOFLO_DB`, then run:
`migrations/0001_billing.sql`

## 8. Checkout flow
Pricing page -> postal code + payment choice -> province derived server-side -> manual tax-rate IDs chosen. Card uses Stripe Checkout subscription mode. Canadian PAD uses Stripe Checkout setup mode to collect/verify the bank account and annual mandate; `setup_intent.succeeded` then creates the recurring subscription server-side. Webhooks remain the source of truth for entitlement state.

Quebec is enabled when `STRIPE_TAX_RATES_QC` exists. Other provinces fail closed with a friendly message until their manual tax treatment is configured.

## 9. PAD
PAD is delayed-notification. Do not grant a permanent licence simply because Checkout returned successfully. Final entitlement should come from webhook-backed server-side subscription/payment state, especially `invoice.paid`.

## 10. Customer Portal note
The current portal endpoint can be opened using the recent Checkout Session ID. This is acceptable during the private development phase behind Cloudflare Access. Before the public launch, replace this with authenticated NavoFlo organization/user authorization.

## V5 - PAD mandate fix
Canadian ACSS Debit (PAD) Checkout now sends the full Stripe mandate terms required for an annual business subscription:
- `payment_schedule=interval`
- localized annual `interval_description`
- `transaction_type=business`

This fixes Stripe error: `acss_debit requires payment_method_options[acss_debit][mandate_options] to be set`.

IMPORTANT V5.1: `keep_vars: true` is enabled in `wrangler.jsonc` so Git/Wrangler code deployments preserve Runtime Variables configured in the Cloudflare dashboard. Secrets remain protected.


## V6 PAD architecture note
Stripe currently does **not** support `acss_debit` in Checkout `subscription` mode. NavoFlo therefore splits the flow: card -> Checkout subscription; PAD -> Checkout setup + `setup_intent.succeeded` -> server-side Subscription creation. Do not grant permanent access until the invoice payment is confirmed.

V6.1: PAD Setup Checkout now follows Stripe Billing's ACSS Debit mandate shape: mandate_options only sets default_for=[invoice, subscription]. payment_schedule and interval_description are intentionally omitted because Stripe rejects them when default_for is provided.
V6.2: Canadian PAD mandates are explicitly marked `transaction_type=business` in both Checkout setup and the Billing subscription payment settings. This makes Stripe display the service/transaction type as business instead of the default personal value.


## V6.5 PAD webhook hardening
PAD subscription creation now runs from both `setup_intent.succeeded` and a setup-mode `checkout.session.completed` fallback. Stripe idempotency uses the SetupIntent ID, so duplicate webhook delivery cannot create duplicate subscriptions. Subscription creation uses `payment_behavior=default_incomplete`, matching Stripe's ACSS Debit Billing guidance.


## V6.5 PAD subscription creation
When the PAD SetupIntent was created with `default_for=[invoice,subscription]`, the mandate is already authorized for Stripe Billing. Subscription creation therefore reuses the customer's verified default ACSS Debit payment method and no longer sends a second `mandate_options[transaction_type]` block on `/v1/subscriptions`. This matches Stripe's saved-PAD-for-Billing flow and avoids re-declaring mandate options on an already-authorized payment method.


V6.5 PAD initial payment: after the reusable PAD mandate succeeds and the subscription is created with `default_incomplete`, NavoFlo explicitly confirms the first invoice PaymentIntent using the saved PaymentMethod + Mandate. This starts the actual debit and prevents the subscription from remaining `incomplete` solely because the PaymentIntent was never confirmed.
