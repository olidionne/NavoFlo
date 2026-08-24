NavoFlo Stripe Integration V3
=============================

Purpose
-------
Cloudflare Pages integration for NavoBase / NavoPro subscriptions.

V3 changes
----------
- Province dropdown removed from pricing page.
- Annual total renamed to annual subtotal (before applicable taxes).
- Cleaner customer-facing payment note.
- On Subscribe, a compact billing-postal-code dialog appears.
- Province is derived server-side from the Canadian postal code.
- Manual Stripe tax rates are selected before Checkout creation.
- Stripe Checkout still collects the complete billing address.
- Quebec is supported immediately when STRIPE_TAX_RATES_QC is configured.
- Other provinces fail safely until their manual tax-rate IDs are configured.

Security
--------
Never commit Stripe secret keys or webhook signing secrets.
If a key has appeared in a screenshot or chat, rotate it before use.

See STRIPE-SETUP.md for installation and Cloudflare variables.
