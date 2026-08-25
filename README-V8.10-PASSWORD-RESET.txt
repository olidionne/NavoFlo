NavoFlo V8.10 — PASSWORD RESET BY EMAIL

Base:
- V8.9.2 FULL DEPLOY
- Existing NavoFlo auth / D1 / Resend integration preserved.

WHAT WAS ADDED
1. Forgot-password flow
   - FR: /forgot-password/
   - EN: /en/forgot-password/
   - POST /api/auth/forgot-password

2. Password-reset flow
   - FR: /reset-password/?token=...
   - EN: /en/reset-password/?token=...
   - GET /api/auth/reset-password?token=... validates the reset link.
   - POST /api/auth/reset-password consumes the link and updates the password.

3. D1 password reset tokens
   - New migration: migrations/0006_password_reset.sql
   - 32-byte cryptographically random token.
   - Only SHA-256 token hashes are stored in D1.
   - 60 minute expiry.
   - Single-use token.
   - A new request revokes older unused tokens.
   - 60 second per-account cooldown prevents repeated email sends.

4. Security behavior
   - Forgot-password returns the same public success response whether the email exists or not.
   - Resetting a password clears failed-login lock state.
   - All existing web auth sessions are revoked after a successful reset.
   - All active Navo2D/Navo3D app leases are revoked after a successful reset.
   - Current session cookie is cleared.
   - Password reset request/completion/failure events are recorded in audit_log with the organization when available.
   - Reset validation and auth error responses are Cache-Control: no-store.
   - Reset pages use no-referrer and remove the token from the address bar after loading.

5. Email delivery
   - Reuses the existing Resend integration.
   - Required production configuration:
       RESEND_API_KEY       secret
       NAVOFLO_FROM_EMAIL   variable or secret, e.g. NavoFlo <noreply@navoflo.com>
       PUBLIC_APP_URL       recommended, e.g. https://navoflo.com
   - Invitation emails now reuse the same shared transport helper and include FR + EN text.

DEPLOYMENT ORDER
A. Apply D1 migration 0006 to the production D1 database.
B. Confirm the sending domain is verified in Resend, then confirm RESEND_API_KEY and NAVOFLO_FROM_EMAIL are configured in the Worker.
C. Recommended: confirm PUBLIC_APP_URL=https://navoflo.com.
D. Deploy the Worker/assets.
E. Test with one real NavoFlo account:
   1. Open /forgot-password/.
   2. Submit the account email.
   3. Open the email link.
   4. Choose a new password of at least 12 characters.
   5. Confirm old sessions are logged out.
   6. Confirm old password fails and new password succeeds.
   7. Confirm the same reset link cannot be used again.

IMPORTANT
- Do not deploy the Worker code before applying migration 0006, because the forgot-password endpoint expects password_reset_tokens to exist.
- This update does not alter the Admin/User floating-license assignment rules.
- NAVOFLO_ENFORCE_LICENSES=true remains unchanged.
