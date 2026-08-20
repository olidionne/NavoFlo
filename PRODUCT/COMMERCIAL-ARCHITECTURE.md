# NavoFlo commercial architecture — NavoBase / NavoPro

Draft: 2026-08-20.

## Plans

### NavoBase

Subscription entitlement for NavoFlo C#/.NET automation add-ins that operate
with a customer's separately licensed SOLIDWORKS installation.

Target design:
- one universal signed add-in where practical;
- behavior driven by signed server/customer mappings rather than per-customer
  binaries;
- documented supported SOLIDWORKS versions;
- mapping/version rollback and audit trail;
- minimal offline entitlement lease if offered and disclosed.

### NavoPro

Includes NavoBase plus online access to:
- Navo2D;
- Navo3D;
- NavoAnalyzer only after it has actually launched.

Until NavoAnalyzer is production-ready, label it “À venir / Coming soon” and do
not include it in the list of presently delivered paid entitlements.

## Authorization scopes

Suggested scopes:
- `navobase.addins`
- `navopro.navo2d`
- `navopro.navo3d`
- `navopro.analyzer` (disabled until launch)

Entitlements should be resolved server-side from the active subscription. The
browser and add-in must not decide paid access merely from local UI state.

## Account / licensing data minimization

A license check should need only data such as account/org ID, entitlement,
application/add-in version, supported SOLIDWORKS version, pseudonymous activation
ID, timestamps and security/audit fields. It should not transmit CAD file
contents, filenames, local paths or geometry.

## CAD privacy boundary

Navo2D/Navo3D currently process CAD files locally in the browser. Preserve this
as a product promise only while technically true. If NavoAnalyzer later uploads
models or derived geometry to a server, present an explicit upload disclosure,
update the privacy policy/data map, determine retention/deletion, secure the
transfer/storage, and complete the required privacy impact assessment before
launch.
