NavoFlo V8.4 — Lease takeover UX stabilization

- Keeps V8.3 one-seat / one-active-workstation enforcement.
- Adds a 12-second timeout to license API calls so the validation overlay cannot spin forever.
- When a lease is revoked by another workstation, the old workstation shows an explicit “Licence déplacée vers un autre poste” screen.
- “Reprendre sur ce poste” performs an intentional force takeover.
- Re-acquiring on the same workstation revokes older same-device lease tokens before issuing the new token, reducing stale/racing leases.
- No D1 migration required.
