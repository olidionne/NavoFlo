# NavoBase / NavoPro checkout and recurring-subscription requirements

This is a product implementation checklist, not a substitute for legal review.

## Checkout summary shown before payment

Display clearly and make printable/saveable:

- seller legal name, business address, phone, support email;
- plan name (NavoBase or NavoPro);
- detailed current features and technical restrictions;
- SOLIDWORKS requirement for NavoBase add-ins;
- each price/fee, applicable taxes, total due now;
- recurring amount and billing frequency;
- billing currency if not CAD;
- activation/start date and duration/renewal model;
- cancellation, termination, refund and trial/promo rules;
- all seat/device/concurrent-use restrictions;
- link to French Terms, EULA, Privacy, open-source notices;
- explicit statement that the subscription auto-renews if that is the model.

Give the customer a review screen that can be accepted, corrected or refused
before payment.

## Contract record

Record the exact Terms/EULA version accepted, language, timestamp and account.
Provide a storable/printable contract copy immediately after checkout. For a
Québec consumer distance contract, do not rely on a dashboard-only copy; email
or provide a downloadable permanent copy.

## Cancellation

Account → Subscription must contain a conspicuous `Cancel subscription` /
`Annuler l'abonnement` action. Design this now to satisfy the Québec online
cancellation requirement effective 2026-09-12 for covered consumer successive
contracts.

Cancellation confirmation should state the effective date and access end date
and be emailed to the customer.

## Promotions

If a trial or promotional price automatically becomes a higher contractual
price, build a written reminder scheduler. For the Québec consumer rule taking
effect 2026-09-12, send the reminder 2–10 days before the promotion ends.

## Pricing changes

Do not silently change a current paid period. Notify customers before a future
renewal price change and respect all mandatory notice/cancellation rights.

## Taxes

Configure taxes from the selling entity/customer jurisdiction. In Québec,
GST/QST generally apply to online services; the actual registration/collection
obligation must be confirmed for the seller with an accountant.
