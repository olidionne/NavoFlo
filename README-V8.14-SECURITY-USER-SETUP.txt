NavoFlo V8.14 — SECURITY HARDENING + SETUP PER USER
===================================================

BASE
----
Built from V8.13.2. Core ADMIN fixed-license / USER floating-license behavior is unchanged.

1) SETUP PER USER / CLOUD PREFERENCES
-------------------------------------
A generic user_preferences store is now attached to the authenticated NavoFlo user account,
not to a workstation. Each module stores an independent JSON preference object.

Current module keys:
- navo2d
- navo3d

Navo2D currently synchronizes user-facing drafting/interface setup including grid, snaps,
ORTHO/POLAR/OTRACK/DYN, OSNAP modes, polar increment, fillet/chamfer/offset defaults,
text defaults and dimension style settings.

Navo3D currently synchronizes grid/edge visibility, selection mode, properties panel state,
and sheet-metal material class.

The design is generic so NavoAnalyzer and future modules can reuse /api/preferences without
creating a separate preferences database per product.

Limits/security:
- authenticated user only
- users can only read/write their own preferences
- module names are validated
- JSON object only, sanitized recursively
- 32 KB maximum per user/module
- revision counter + updated timestamp

2) PRODUCTION SECURITY HARDENING
--------------------------------
Sessions:
- absolute session lifetime: 30 days by default
- idle timeout: 168 hours / 7 days by default
- configurable with NAVOFLO_SESSION_DAYS and NAVOFLO_SESSION_IDLE_HOURS
- Account > Web Sessions exposes last activity, idle expiration and maximum expiration

Rate limiting (D1-backed, hashed client buckets):
- login: per IP + per IP/email
- forgot password and activation resend: per IP + per IP/email
- password reset/activation completion
- invitation acceptance
- ADMIN invitation/resend
- Fast Track seat purchase
- forced device takeover

Login hardening:
- existing failed-login lock remains active
- unknown accounts perform dummy PBKDF2 work before returning the same generic login error

Mutation protection:
- API POST/PUT/PATCH/DELETE requests reject mismatched Origin
- Sec-Fetch-Site=cross-site is rejected
- Stripe webhook is excluded because Stripe is an external trusted sender
- oversized API requests with Content-Length > 64 KB are rejected (webhook excluded)

Security headers on Worker-handled responses:
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- Referrer-Policy: strict-origin-when-cross-origin when not already set
- Permissions-Policy disables camera, microphone, geolocation and browser payment API
- Cross-Origin-Opener-Policy: same-origin-allow-popups
- HSTS on HTTPS

Maintenance:
- daily Worker Cron: 04:17 UTC
- cleans sessions that are expired/revoked/idle beyond the configured timeout + grace
- cleans stale app leases
- cleans old password reset / account activation tokens
- cleans old accepted/expired invitations
- cleans stale rate-limit buckets
- opportunistic maintenance fallback also runs on a small percentage of API requests

3) ENGLISH NAVO2D LICENSE PARITY
--------------------------------
The English Navo2D page now loads the same license-lease bootstrap as the French page.
This closes a parity gap without changing the license rules themselves.

4) DATABASE MIGRATION
---------------------
Apply migrations/0009_security_preferences.sql to navoflo-prod before deploying V8.14.
It creates user_preferences, security_rate_limits and cleanup/performance indexes.

5) DEPLOYMENT
-------------
No new secret is required. Existing RESEND_API_KEY remains required.
NAVOFLO_FROM_EMAIL remains unchanged.

wrangler.jsonc adds:
- NAVOFLO_SESSION_DAYS=30
- NAVOFLO_SESSION_IDLE_HOURS=168
- daily cron trigger
- Worker-first routing for auth/account/billing/pricing pages so hardening headers and
  runtime protections are applied consistently.

6) RECOMMENDED PRODUCTION VALIDATION
------------------------------------
A. Sign in and confirm Account > Web Sessions still loads.
B. Navo2D: change a drafting setting (for example POLAR increment or OSNAP), reload,
   then sign in as the same user in another browser/device and confirm it follows the user.
C. Sign in as a different NavoFlo USER and confirm that user's setup is independent.
D. Navo3D: toggle grid/edges or selection mode and confirm persistence for the same user.
E. Confirm forgot-password email/reset still succeeds.
F. Confirm an ADMIN invitation still succeeds.
G. Confirm Audit Log still loads and remains organization-isolated.
H. Confirm Navo2D/Navo3D license enforcement and takeover still behave as before.

Do not deliberately hammer production login/reset endpoints to test rate limits; automated
smoke tests validate limiter behavior without risking a temporary production block.
