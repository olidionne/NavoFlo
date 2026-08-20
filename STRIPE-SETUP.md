# NavoFlo — Stripe Billing setup (Card + Canadian PAD)

This package is designed for Cloudflare Pages + Pages Functions.
No Stripe secret key is ever exposed in browser JavaScript.

## 1. Stripe account
Create/activate the NavoFlo Stripe account in Canada.
Enable Card and ACSS Debit / Canadian pre-authorized debit (PAD) in Payment methods.
Enable the Stripe Customer Portal.

## 2. Create four recurring annual Prices in Stripe
All prices should be CAD / yearly recurring:

- NavoBase Main: 1995 CAD/year
- NavoBase Additional Seat: 495 CAD/year
- NavoPro Main: 3495 CAD/year
- NavoPro Additional Seat: 895 CAD/year

Copy each `price_...` ID.

## 3. Cloudflare Pages environment variables
In Cloudflare > Pages > NavoFlo > Settings > Environment variables / Secrets:

STRIPE_SECRET_KEY=sk_test_...   (then sk_live_... at launch)
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_NAVOBASE_MAIN=price_...
STRIPE_PRICE_NAVOBASE_SEAT=price_...
STRIPE_PRICE_NAVOPRO_MAIN=price_...
STRIPE_PRICE_NAVOPRO_SEAT=price_...
PUBLIC_APP_URL=https://navoflo.com
STRIPE_AUTOMATIC_TAX=false

Use secrets for STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET.
Never commit secret values into GitHub.

## 4. Webhook
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

## 5. Optional Cloudflare D1 subscription database
Create a D1 database, bind it to the Pages project as `NAVOFLO_DB`, then run:

migrations/0001_billing.sql

The checkout works without D1, but D1 is strongly recommended before access-control goes live.

## 6. Stripe Tax
The code supports Stripe Automatic Tax when STRIPE_AUTOMATIC_TAX=true.
Do not enable it until the Stripe tax registrations/settings have been reviewed for NavoFlo.

## 7. PAD behavior
PAD can remain pending for days. Do NOT grant permanent NavoBase/NavoPro access solely because the browser returned from Checkout.
Access should be based on the server-side subscription state updated by Stripe webhooks, particularly `invoice.paid`.

## 8. Current scope
Implemented now:
- NavoBase / NavoPro annual Checkout
- Main license + additional-seat quantities
- Card + Canadian PAD
- Stripe Customer Portal after Checkout
- Webhook signature verification
- Subscription state persistence hook for Cloudflare D1
- FR/EN pricing and success pages

Next product step:
- NavoFlo account login / organizations
- seat assignment per user
- device activation for installable applications
- protect Navo2D/Navo3D based on NavoPro entitlement
