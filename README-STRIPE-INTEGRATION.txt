NavoFlo Stripe Workers V6.9 — Licensing Foundation

Changes from V6.8:
- PAD remains disabled by default for both NavoBase and NavoPro.
- Cloudflare D1 binding NAVOFLO_DB is pinned in wrangler.jsonc to navoflo-prod.
- Adds organizations, users, memberships, license_assignments and webhook_events tables (migration 0002_licensing.sql).
- checkout.session.completed now creates/updates the Stripe customer organization in D1.
- Subscription events are synchronized into D1 with plan, seats and status.
- Fixes current_period_end for modern Stripe API versions by reading subscription item current_period_end.
- Old PAD setup events are ignored cleanly while NAVOFLO_PAD_ENABLED is not true.
- Stripe webhook event IDs are recorded to avoid duplicate processing.

Deployment order:
1. Run migrations/0002_licensing.sql in Cloudflare D1 navoflo-prod Console.
2. Deploy this Worker version.
3. In Stripe Workbench, resend the latest successful CARD checkout.session.completed event.
4. Run in D1:
   SELECT * FROM organizations;
   SELECT * FROM subscriptions;
   SELECT * FROM webhook_events ORDER BY processed_at DESC LIMIT 20;

The users/memberships/license_assignments tables are intentionally empty until customer authentication and seat assignment UI are implemented.
