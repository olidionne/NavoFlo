# NavoFlo Stripe + D1 V7.0 — Licensing

## Before deploying V7.0

Run `migrations/0003_licensing_v7.sql` once in:

Cloudflare → D1 → `navoflo-prod` → Console

This migration links subscriptions to organizations and adds the fields used by the licensing UI.

## Existing bindings and secrets

Keep the existing Stripe runtime variables/secrets unchanged.

Required D1 binding:
- Binding: `NAVOFLO_DB`
- Database: `navoflo-prod`

`wrangler.jsonc` already pins this binding.

PAD remains disabled unless `NAVOFLO_PAD_ENABLED=true` is explicitly added.

## Authentication during development

V7.0 uses Cloudflare Access as the identity provider. The Worker reads:

`cf-access-authenticated-user-email`

The first person signing in with the Stripe billing email is bootstrapped as the organization owner and receives the first available license seat.

## Licensing endpoints

- `GET /api/licensing/me` — current user, organization, subscription, seats and entitlements
- `POST /api/licensing/members` — owner/admin adds a user and assigns an available seat
- `POST /api/licensing/members/:userId/license` — assign/revoke a seat
- `DELETE /api/licensing/members/:userId` — remove a non-owner member
- `POST /api/licensing/portal` — open Stripe Billing Portal for the organization

## Account page

FR: `/account/licenses/`
EN: `/en/account/licenses/`

NavoBase entitlements:
- automation: yes
- Navo2D: no
- Navo3D: no

NavoPro entitlements:
- automation: yes
- Navo2D: yes
- Navo3D: yes

NavoAnalyzer remains disabled until launch.

## Optional enforcement

By default V7.0 only reports entitlements. To make the Worker redirect unlicensed users away from Navo2D/Navo3D, add runtime variable:

`NAVOFLO_ENFORCE_LICENSES=true`

Keep it unset during development until the account/licensing flow has been validated.

## Test with the existing Stripe subscription

No new payment is required.

1. Deploy V7.0 after migration 0003.
2. Sign in to `navoflo.com` through Cloudflare Access with the same email used for the successful Stripe test subscription.
3. Open `/account/licenses/`.
4. The page lazily creates the owner/membership/license assignment from the existing organization + subscription rows.
5. Verify D1:

```sql
SELECT * FROM users;
SELECT * FROM memberships;
SELECT * FROM license_assignments;
SELECT stripe_subscription_id, organization_id, plan, seats, status, current_period_end
FROM subscriptions;
```

If the current subscription has only one seat, seeing `1 / 1` with the Add User button disabled is expected.

## V7.1 — Fast Track licence additionnelle

Avant le premier test V7.1, exécuter dans `navoflo-prod` :

```sql
ALTER TABLE memberships ADD COLUMN pending_license INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_memberships_pending_license
ON memberships(organization_id, pending_license, active);
```

La page `/account/licenses/` garde maintenant le bouton **Ajouter un utilisateur**
actif même lorsque 0 siège est disponible. Elle affiche une confirmation d'achat,
puis NavoFlo met à jour l'abonnement Stripe existant avec `proration_behavior=always_invoice`
et `payment_behavior=pending_if_incomplete`. Si une authentification carte est requise,
le client est envoyé vers la facture Stripe hébergée. Le siège est attribué dans D1
uniquement après que Stripe confirme l'augmentation de l'abonnement.
