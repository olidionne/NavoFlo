# NavoBase universal/mappable SOLIDWORKS add-in architecture

Draft: 2026-08-20

Goal: ship one signed C#/.NET add-in binary where practical, while changing
customer behavior through versioned mappings and entitlements rather than
building a different DLL for every customer.

## Recommended components

1. **NavoBase Add-in** — signed C#/.NET SOLIDWORKS add-in using documented APIs.
2. **Navo Mapping Engine** — validates and executes a restricted mapping schema
   (commands, property mappings, export rules, paths/templates selected by the
   customer, feature flags). Do not execute arbitrary server-supplied C#.
3. **Entitlement API** — authenticates the user/organization and returns only the
   subscribed scopes/features.
4. **Signed Mapping API** — returns a versioned mapping payload signed by NavoFlo.
5. **Local secure cache** — caches a short-lived entitlement lease and last known
   valid mapping where offline use is part of the purchased plan.
6. **Admin portal** — maps organizations/users/seats to approved configurations.

## Security boundaries

- Never put entitlement signing private keys or payment/API secrets in the add-in.
- Verify mapping signatures before execution.
- Prefer an allow-listed declarative schema over arbitrary remote code execution.
- Do not upload CAD contents, filenames, local paths or geometry during routine
  license checks.
- Log mapping version, add-in version, entitlement ID and outcome, not customer
  drawing contents.
- Code-sign installer and add-in binaries; maintain release hashes and rollback.

## Entitlement inheritance

- NavoBase: `navobase.addins`
- NavoPro: inherits NavoBase + `navopro.navo2d` + `navopro.navo3d`
- `navopro.analyzer`: do not issue until Analyzer is actually launched.

## Customer mapping lifecycle

Draft → validation/test tenant → approved → signed/versioned → production →
optional rollback. A customer should be able to identify the active mapping
version from the add-in About/Diagnostics view.
