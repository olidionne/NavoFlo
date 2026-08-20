# NavoFlo commercial launch compliance pack

Draft date: 2026-08-20. This pack is an engineering/compliance starting point,
not a legal opinion. Final public terms should be reviewed by Québec counsel
before paid launch.

## Intended product model

- **NavoBase** — paid subscription entitlement for NavoFlo C#/.NET automation
  add-ins used with a customer's separately licensed SOLIDWORKS installation.
  Exact seat/device/concurrent-use rights are whatever the order/checkout says.
- **NavoPro** — includes NavoBase entitlements plus Navo2D and Navo3D online.
  NavoAnalyzer must be described as *coming soon* until it is actually launched;
  do not sell an unimplemented feature as a currently delivered entitlement.

## Before accepting the first paid subscription

1. Fill every `[[PLACEHOLDER]]` in the public legal documents.
2. Publish the French terms first/equally prominently. Québec adhesion contracts
   must be available in French before an adherent chooses another language.
3. Put Terms, Privacy, Subscription/Cancellation and Open-source notices in the
   website footer, checkout, account area and add-in installer/About dialog as
   appropriate.
4. Build checkout so it clearly shows merchant identity/contact, detailed plan
   description, price, taxes, total, billing interval, currency, activation,
   cancellation/refund terms and all restrictions before payment.
5. Give the buyer a chance to review/correct the order before payment and email
   or otherwise provide a storable/printable contract copy immediately after
   purchase (Québec's outside limit is 15 days for distance contracts).
6. Implement a conspicuous online cancellation button before **2026-09-12** for
   consumer subscriptions concluded online when cancellation without cause is
   available. Build it now rather than retrofitting it later.
7. If a promotional subscription price increases at the end of the promotion,
   schedule the required written reminder in the 2–10 day window before the
   promotional period ends (consumer regime effective 2026-09-12).
8. Appoint/publish the privacy officer's title/contact; create retention,
   deletion, incident-response and complaint procedures.
9. Complete a privacy impact assessment (EFVP/PIA) for the account/licensing
   system and before personal information is communicated outside Québec.
10. Do not enable analytics/profiling/location technology by default. Obtain the
    required consent before enabling non-essential identifying/profiling tech.
11. Self-host pinned third-party CAD libraries for production. In particular,
    provide the exact LGPL source/build information and a replacement path for
    occt-js/OCCT instead of relying only on a third-party CDN.
12. Keep `THIRD_PARTY_NOTICES.txt` and full license texts available to users.
13. For SOLIDWORKS add-ins, use documented public APIs and official
    redistributable interop assemblies from the user's SOLIDWORKS installation/
    API redist. Do not redistribute proprietary SOLIDWORKS binaries outside the
    rights granted by Dassault Systèmes.
14. Use NavoFlo branding. Do not use Autodesk/SOLIDWORKS logos or claim partner,
    certification or endorsement status without written authorization.
15. Have an accountant configure GST/QST and other sales-tax rules for the
    actual selling entity and customer locations.
16. Run a trademark clearance for NavoFlo, NavoBase and NavoPro before investing
    heavily in branding/registration.

## Architecture recommendation

Use one entitlement service and feature scopes rather than separate license
systems:

- `navobase.addins`
- `navopro.navo2d`
- `navopro.navo3d`
- `navopro.analyzer` (only after launch)

The add-in should send only the minimum data needed to validate entitlement.
Do not transmit CAD files, filenames, drawing contents or model geometry to the
licensing service. If a device fingerprint is used, document it as personal/
technical data, minimize it, hash/pseudonymize it, and define retention.

## Files in this pack

- `TERMS-OF-SERVICE-FR.md` / `EN`
- `EULA-NAVOBASE-ADDINS-FR.md` / `EN`
- `PRIVACY-POLICY-FR.md` / `EN`
- `SUBSCRIPTION-CHECKOUT-REQUIREMENTS.md`
- `SOLIDWORKS-ADDIN-COMPLIANCE.md`
- `OPEN-SOURCE-COMPLIANCE.md`
- `THIRD_PARTY_NOTICES.txt`
- full open-source license texts
- public HTML legal pages under `public/legal/`

## Important commercial source-code note

The NavoFlo GitHub repository was public when this compliance pack was prepared.
A public repository does not prevent commercial resale and does not waive
copyright by itself, but it exposes proprietary implementation details and makes
trade-secret protection impractical for code that has been published. If the
commercial model is intended to be proprietary, move private product/add-in
source to a private repository before adding licensing secrets, signing
infrastructure, customer mappings or unreleased automation logic. Never place
payment secrets, private signing keys or entitlement-service secrets in browser
JavaScript. Keep only the open-source source/offer material that must be made
available under applicable licenses publicly accessible.

Browser-delivered JavaScript is necessarily inspectable by users. Server-side
entitlement logic, customer mappings and sensitive automation services should be
kept server-side or in signed desktop binaries where appropriate.
17. For NavoBase installers/updates in Canada, use a user-initiated installation
    flow where practical. If NavoFlo causes software or background updates to be
    installed on another person's device, implement the CASL/LCAP software-
    installation consent/disclosure requirements and retain consent evidence.
18. Marketing email/SMS must have a valid CASL basis, identify NavoFlo, include
    contact information and a working unsubscribe mechanism; unsubscribe requests
    must be acted on within the applicable deadline.
