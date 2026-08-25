NavoFlo V8.1 — Auth & Floating Licenses Foundation
==================================================

Baseline: V7.2 Fast Track Tax Fix

WHAT V8 ADDS
------------
1. Native NavoFlo authentication
   - email + password
   - PBKDF2-SHA256 password hashing (100,000 iterations; Cloudflare Workers WebCrypto compatible)
   - secure HttpOnly/SameSite session cookies
   - logout
   - temporary lock after repeated bad passwords

2. First owner activation while the site remains private behind Cloudflare Access
   - /auth/setup/
   - Cloudflare Access is used only to bootstrap the pre-existing Owner account.
   - After activation, normal NavoFlo sessions are used.

3. Invitations
   - New users receive a one-use invitation token, valid for 7 days.
   - /invite/accept/?token=...
   - If email sending is not configured, the Owner gets a Copy invitation link modal.
   - Optional automatic email delivery with RESEND_API_KEY + NAVOFLO_FROM_EMAIL.

4. License policy
   - The primary included license is ADMIN.
   - ADMIN is fixed to the organization Owner and cannot be transferred.
   - Additional USER licenses are floating.
   - USER licenses can only be transferred from the NavoFlo web portal.
   - Transferring a USER license immediately revokes the previous user's active app leases.
   - Users can exist in the organization without a license.

5. Single-active-workstation lease API
   - POST /api/licensing/lease/acquire
   - POST /api/licensing/lease/refresh
   - POST /api/licensing/lease/release
   - Lease TTL: 180 seconds, heartbeat recommended every 60 seconds.
   - Same license can run multiple NavoFlo products on the SAME workstation.
   - Another workstation is rejected unless the user explicitly takes over the lease.
   - public/js/license-lease.js is included as the browser integration helper.

IMPORTANT
---------
Do NOT enable NAVOFLO_ENFORCE_LICENSES yet for production access control.
The lease API is ready, but Navo2D/Navo3D must be wired to license-lease.js at app startup before hard enforcement is enabled.

INSTALLATION
------------
1. D1 -> navoflo-prod -> Console
2. Execute migrations/0005_auth_floating_licenses.sql ONCE.
3. Deploy this V8 package.
4. While Cloudflare Access still protects navoflo.com, visit:
      https://navoflo.com/auth/setup/
   Set the Owner NavoFlo password (12+ chars).
5. Then test:
      https://navoflo.com/account/licenses/
      Logout -> Login -> account/licenses.
6. Invite a test user. If email delivery is not configured, copy the generated invitation URL.
7. Open the invitation in a private/incognito browser and create that user's password.
8. Create/invite an unlicensed user and transfer a USER license to validate floating transfer.

OPTIONAL EMAIL DELIVERY
-----------------------
Cloudflare Worker secrets/variables:
  RESEND_API_KEY       Secret
  NAVOFLO_FROM_EMAIL   Text, e.g. NavoFlo <noreply@navoflo.com>

Without these variables, invitations still work; the Owner receives a copyable invitation URL.

DEVELOPMENT FALLBACK
--------------------
NAVOFLO_DEV_ACCESS_FALLBACK=true can temporarily allow Cloudflare Access identity to be used by licensing APIs.
Prefer leaving it unset once the Owner password has been bootstrapped.

PASSWORD RESET
--------------
Not included in V8.1 yet. This is the next auth increment after login/invitation validation.
