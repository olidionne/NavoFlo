NavoFlo Stripe Workers V7.0 — Licensing

Changes from V6.9:
- Adds the real NavoFlo licensing account page at /account/licenses/ (+ English version).
- Uses Cloudflare Access authenticated email as the current development identity.
- Automatically bootstraps the Stripe billing email as organization owner.
- Automatically assigns the owner's first license seat when an active subscription has capacity.
- Adds GET /api/licensing/me.
- Adds owner/admin member + seat management APIs.
- Adds Stripe Billing Portal access from the licensing page.
- Returns Base/Pro entitlements from the server.
- Adds optional server-side Navo2D/Navo3D enforcement with NAVOFLO_ENFORCE_LICENSES=true.
- Adds subscriptions.organization_id and stores it during Stripe synchronization.
- Keeps PAD disabled by default.
- Pricing page is card-only while PAD is disabled.

Required deployment order:
1. Run migrations/0003_licensing_v7.sql ONCE in D1 navoflo-prod.
2. Deploy V7.0.
3. Open /account/licenses/ while signed in through Cloudflare Access using the Stripe billing email.
4. Query D1 users, memberships and license_assignments to verify bootstrap.

Validation performed before packaging:
- 0001 + 0002 + 0003 migrations applied successfully to SQLite 3.46.
- JS syntax validation passed for all Worker/public JS files.
- Licensing integration test passed with a D1-compatible SQLite mock:
  owner bootstrap, Pro entitlements, 2-seat cap, add member, revoke seat, reuse released seat.
