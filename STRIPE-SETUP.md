# NavoFlo Stripe + D1 V6.9

## Required Cloudflare runtime values

Existing Stripe price/tax variables and secrets remain unchanged.

D1 binding:
- Binding: `NAVOFLO_DB`
- Database: `navoflo-prod`

PAD is disabled unless runtime variable `NAVOFLO_PAD_ENABLED=true` is explicitly added.

## D1 migrations

`0001_billing.sql` creates `subscriptions`.

`0002_licensing.sql` creates:
- `organizations` — one billing/customer organization per Stripe customer
- `users` — future NavoFlo login identities
- `memberships` — user ↔ organization membership and role
- `license_assignments` — assigned seats
- `webhook_events` — processed Stripe webhook IDs

Run migration 0002 before deploying V6.9 because the webhook now writes to these tables.

## Stripe renewal date

With modern Stripe API versions, the billing period is stored on subscription items. V6.9 reads the maximum `items.data[].current_period_end`, which fixes the previously null `subscriptions.current_period_end` value.

## Test after deployment

Rather than create another paid test, resend the most recent successful **card** `checkout.session.completed` event from Stripe Workbench.

Then query D1:

```sql
SELECT * FROM organizations;
SELECT * FROM subscriptions;
SELECT * FROM webhook_events ORDER BY processed_at DESC LIMIT 20;
```

Expected:
- organization row contains Stripe `cus_...`, company/name and billing email
- subscription row contains `sub_...`, plan, seats, `active`, and non-null `current_period_end`
- webhook event is recorded once
