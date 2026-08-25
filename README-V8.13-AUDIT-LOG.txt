NavoFlo V8.13 — AUDIT LOG
==========================

Base: V8.12 — ADMIN EMAIL ACTIVATION (validated in production)

New portal feature
------------------
The organization owner/admin can now view an audit log directly in the NavoFlo account portal.

Visible categories:
- Sign-in & security
- Team & invitations
- Licenses & devices
- Billing / Fast Track seats

Filters:
- category
- user
- start date
- end date
- pagination (50 events per request)

Events now surfaced include:
- auth.login / auth.logout
- auth.password_reset_requested / completed / email_failed
- auth.activation_email_sent / email_failed / completed
- auth.session_revoked / auth.other_sessions_revoked
- member.invited / member.invitation_accepted / member.removed
- license.assigned / license.revoked / license.transferred
- license.device_takeover / license.device_disconnected
- billing.seat_fast_track_requested

Security
--------
- /api/audit requires an authenticated organization OWNER/ADMIN.
- The query is always scoped to the current organization_id.
- Stable workstation identifiers stored in old audit details are NOT returned by the API.
- Unknown future details_json metadata is not exposed by default.
- Responses use cache-control: no-store.

Database migration
------------------
0008_audit_log_indexes.sql adds indexes only. It does not alter audit_log data or licensing behavior.
The application remains functional without the indexes, but apply the migration for production performance.

Cloudflare D1 console SQL:

CREATE INDEX IF NOT EXISTS idx_audit_log_org_action_created
ON audit_log(organization_id, action, created_at);

CREATE INDEX IF NOT EXISTS idx_audit_log_org_actor_created
ON audit_log(organization_id, actor_user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_audit_log_org_target_created
ON audit_log(organization_id, target_user_id, created_at);

Notes
-----
- No licensing rules were changed.
- ADMIN license remains fixed/non-transferable.
- USER licenses remain floating/transferable.
- Existing V8.12 activation, password reset, Resend, sessions/devices, Stripe and D1 flows remain intact.
