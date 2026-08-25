NavoFlo V8.12 — ADMIN EMAIL ACTIVATION
=======================================

Goal
----
Stripe Subscribe remains the only entry point for a new ADMIN account.
An ADMIN then remains the entry point for USER accounts through invitations.
There is NO public signup.

New ADMIN flow
--------------
1. Customer subscribes through Stripe Checkout.
2. Stripe webhook provisions/updates the organization, owner membership and fixed ADMIN license.
3. If the billing email does not already have a NavoFlo password, NavoFlo sends an activation email through Resend.
4. The activation link is valid for 24 hours and can be used once.
5. The ADMIN chooses a password and is signed in immediately.
6. The ADMIN can then invite USER accounts from the portal.

Security
--------
- 32-byte random activation token.
- Only SHA-256 token hash stored in D1.
- One-time token.
- 24-hour expiration.
- New token revokes older unused tokens.
- 60-second resend cooldown.
- Generic resend response to prevent account enumeration.
- Activation is only resendable for an existing pending OWNER account; it cannot create an account.
- Activation proves control of the billing email and sets email_verified_at.
- Cloudflare Access is no longer required for initial ADMIN password creation.

Routes
------
GET  /api/auth/activation?token=...
POST /api/auth/activation
POST /api/auth/resend-activation

UI
--
/auth/setup/ and /en/auth/setup/ now handle email-based ADMIN activation/resend.
Login pages include an ADMIN activation link.
Billing success tells new owners to check their activation email and offers a resend button.

Audit events
------------
auth.activation_email_sent
auth.activation_email_failed
auth.activation_completed

D1 migration
------------
0007_account_activation.sql MUST be applied before deploying V8.12.

Unchanged
---------
- ADMIN license remains fixed/non-transferable.
- USER licenses remain floating/transferable.
- Navo2D/Navo3D lease enforcement unchanged.
- Password reset unchanged.
- USER invitation flow unchanged.
- Stripe Fast Track unchanged.
