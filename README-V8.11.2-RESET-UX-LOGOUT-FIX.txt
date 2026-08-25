NavoFlo V8.11.2 — Password Reset UX + Orphaned Account Logout Fix

Changes:
- Fixes false password-reset error after successful Resend delivery.
  Cause: Event.currentTarget becomes null after an awaited event-handler continuation.
  The form reference is now captured before await and reset safely after success.
- Adds a Sign out / Déconnexion action to the account fallback shown when a signed-in user no longer belongs to an active NavoFlo organization.
- Keeps pricing available from that fallback and uses the correct FR/EN pricing URL.
- Non-organization account fallback now explicitly explains that the NavoFlo account is still signed in.
- No D1 migration. No licensing rules changed.
