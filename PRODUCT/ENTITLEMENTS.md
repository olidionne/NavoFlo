# NavoFlo subscription entitlement model

## NavoBase

Purpose: license NavoFlo automation add-ins for SOLIDWORKS.

Suggested entitlement scope:

- `navobase.addins`

The server should return the exact products/versions/features enabled for the
customer. Mapping/configuration should be data-driven so the same signed add-in
binary can be used across customers where practical.

## NavoPro

NavoPro should inherit NavoBase and add:

- `navopro.navo2d`
- `navopro.navo3d`
- `navopro.analyzer` — disabled/unpublished until NavoAnalyzer is launched.

## License-token design

Recommended pattern:

1. User signs in to NavoFlo.
2. Server returns short-lived access token + signed entitlement lease.
3. Installed add-in caches a limited offline lease (duration disclosed in the
   service description/EULA).
4. Add-in periodically refreshes entitlement without transmitting CAD content.
5. Revocation/suspension affects future lease refreshes; do not silently erase
   customer files or CAD data.

Avoid collecting more than: account ID, organization ID, entitlement, add-in
version, supported SOLIDWORKS version, coarse device activation ID, timestamps
and security logs needed to prevent abuse.
