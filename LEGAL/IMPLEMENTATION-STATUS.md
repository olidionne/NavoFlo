# NavoFlo legal/compliance implementation status

Prepared: 2026-08-20

## Included in this repository overlay

- Third-party software inventory and license copies.
- Public open-source notice page and downloadable license texts.
- Draft French/English subscription Terms.
- Draft French/English Privacy Policy.
- Draft French/English NavoBase add-in EULA.
- NavoBase/NavoPro entitlement architecture.
- Québec distance-contract/online-subscription implementation checklist.
- Law 25 privacy/data-map checklist.
- SOLIDWORKS add-in and branding compliance checklist.
- Open-source/OCCT LGPL compliance checklist.
- Proprietary-source and trademark plan.

## Still required before accepting paid subscriptions

These are operational/legal facts that cannot be completed from source code alone:

1. Fill all `[[PLACEHOLDER]]` values with the real selling entity, address,
   support/contact information, privacy officer, cancellation URL, providers,
   retention periods and judicial district.
2. Decide whether sales are B2B only or also to consumers. The templates are
   intentionally drafted conservatively for consumer-facing online subscriptions.
3. Implement checkout disclosure, order review/correction, invoice/contract copy,
   renewal notices and online cancellation UX in the real billing/account system.
4. Configure GST/QST and any destination taxes with the accountant/payment stack.
5. Complete the Law 25 privacy impact assessment for identity, billing,
   entitlement, telemetry and hosting. Repeat/update it before a future cloud
   Analyzer uploads CAD content or derived geometry.
6. Document actual hosting/payment/email/analytics/subprocessor locations and
   cross-border data flows.
7. Self-host and pin the production third-party browser/WASM dependencies,
   especially occt-js/OCCT, and publish the exact corresponding LGPL source/build
   information and a compliant replacement/relink path. Obtain counsel review of
   the WebAssembly LGPL implementation, or arrange a commercial OCCT license if
   the chosen architecture cannot satisfy the LGPL requirements.
8. Have Québec software/privacy counsel review the final customer-facing Terms,
   Privacy Policy, EULA, checkout/cancellation flow and open-source notices.
9. Perform trademark clearance for NavoFlo, NavoBase and NavoPro in intended
   markets.
10. Keep SOLIDWORKS/Autodesk references descriptive; obtain written authorization
    before using partner/certification logos or claiming endorsement.
11. Move proprietary add-in/licensing/Analyzer source and secrets to private
    repositories before commercial launch if proprietary protection is intended.

This status document is a launch checklist, not a legal certification.
