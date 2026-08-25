# NavoFlo V8.0 — Stripe + D1 + Auth

The Stripe billing flow remains the V7.2 flow: card subscriptions, manual provincial tax rates, Fast Track seat additions, D1 subscription sync. PAD stays disabled by default.

## Required existing bindings / variables

- `NAVOFLO_DB` -> D1 `navoflo-prod`
- `PUBLIC_APP_URL=https://navoflo.com`
- Stripe price variables and tax rate variables already configured
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

## New migration

Run `migrations/0005_auth_floating_licenses.sql` once in D1 Console before using V8 auth.

## First Owner activation

Because the development site is still protected by Cloudflare Access, visit `/auth/setup/` after deploying V8. The endpoint reads the authenticated Cloudflare Access email, finds the existing NavoFlo user, hashes the new password, activates the account, and creates the first NavoFlo session.

## Invitation email delivery (optional)

V8 can send invitation emails through Resend if these are configured:

- Secret: `RESEND_API_KEY`
- Text: `NAVOFLO_FROM_EMAIL` (example: `NavoFlo <noreply@navoflo.com>`)

If they are absent, the Owner receives the invitation URL in the portal and can copy it manually.

## Floating USER licenses

The primary Owner assignment is migrated to `license_type=admin` and is non-transferable. Additional assignments are `license_type=user` and can be transferred only through the NavoFlo account portal.

## Workstation concurrency

V8 includes a 180-second application lease API. `public/js/license-lease.js` refreshes every 60 seconds. A second workstation receives `LICENSE_IN_USE` and can take over only after explicit confirmation; takeover revokes the prior workstation lease.

`NAVOFLO_ENFORCE_LICENSES` is enabled in this V8.8 deployment package. Navo2D lease enforcement has been validated; Navo3D route protection is prepared for its integration.
