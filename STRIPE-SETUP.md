# NavoFlo — Stripe Billing setup V2 (Card + Canadian PAD + manual taxes)

This package is designed for Cloudflare Pages + Pages Functions.
No Stripe secret key is ever exposed in browser JavaScript.

## IMPORTANT SECURITY FIRST
If a Stripe secret key has ever appeared in a screenshot, chat, ticket, email, or source file, rotate it in Stripe before using this integration. Never commit `sk_test_...`, `sk_live_...` or `whsec_...` values to GitHub.

## 1. Stripe products / annual prices
Create the following CAD yearly recurring prices and copy each `price_...` ID:

- NavoBase Main: 1995 CAD/year
- NavoBase Additional Seat: 495 CAD/year
- NavoPro Main: 3495 CAD/year
- NavoPro Additional Seat: 895 CAD/year

All product prices must be **tax exclusive / taxes added on top**.

## 2. Payment methods
Enable:
- Card
- Canadian pre-authorized debit / ACSS Debit (PAD)

The Checkout code requests a business PAD mandate.

## 3. Manual tax rates
Stripe Automatic Tax must NOT be enabled by this integration.
For Quebec, create two active **exclusive** manual tax rates:
- GST / TPS: 5%
- QST / TVQ: 9.975%

Copy both `txr_...` IDs.

The integration intentionally does not guess Canadian interprovincial tax rules. It uses a province-to-tax-rate environment variable. At launch you can enable Quebec only, then add other provinces after their tax treatment has been confirmed.

## 4. Cloudflare Pages environment variables / secrets
In Cloudflare > Pages > NavoFlo > Settings > Environment variables / Secrets:

STRIPE_SECRET_KEY=sk_test_...   (secret; use sk_live_... only at production launch)
STRIPE_WEBHOOK_SECRET=whsec_... (secret)
STRIPE_PRICE_NAVOBASE_MAIN=price_...
STRIPE_PRICE_NAVOBASE_SEAT=price_...
STRIPE_PRICE_NAVOPRO_MAIN=price_...
STRIPE_PRICE_NAVOPRO_SEAT=price_...
STRIPE_TAX_RATES_QC=txr_GST_ID,txr_QST_ID
PUBLIC_APP_URL=https://navoflo.com

Use Cloudflare **Secrets** for STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET.

Do NOT define STRIPE_AUTOMATIC_TAX in V2. Manual tax rates are applied directly to every subscription line item.

## 5. Webhook
In Stripe Developers > Webhooks, add:
https://navoflo.com/api/stripe/webhook

Subscribe at minimum to:
- checkout.session.completed
- customer.subscription.created
- customer.subscription.updated
- customer.subscription.deleted
- invoice.paid
- invoice.payment_failed

Copy the signing secret into STRIPE_WEBHOOK_SECRET.

## 6. Optional Cloudflare D1 subscription database
Create a D1 database, bind it to the Pages project as `NAVOFLO_DB`, then run:

migrations/0001_billing.sql

The Checkout can open without D1, but D1 is strongly recommended before access-control goes live.

## 7. PAD behavior
PAD is delayed-notification. Do NOT grant permanent NavoBase/NavoPro access solely because the browser returned from Checkout. Access must be based on the server-side subscription/payment state updated by Stripe webhooks, especially `invoice.paid`.

## 8. Current scope
Implemented:
- NavoBase / NavoPro annual Checkout
- Main licence + additional-seat quantities
- Card + Canadian PAD
- Manual Stripe tax rates by configured province
- Quebec GST 5% + QST 9.975% ready through `STRIPE_TAX_RATES_QC`
- Stripe Customer Portal endpoint
- Webhook signature verification
- D1 subscription-state persistence hook
- FR/EN pricing and success pages

Next product layer:
- NavoFlo login / organizations
- seat assignment per user
- device activation for installable Windows applications
- NavoBase/NavoPro entitlements
- protect Navo2D/Navo3D based on NavoPro entitlement
