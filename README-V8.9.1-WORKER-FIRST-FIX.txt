NavoFlo V8.9.1 — Navo3D Worker-First Licensing Fix
====================================================

Fixes a Cloudflare Static Assets routing bypass in V8.9.

Cause
-----
Cloudflare Workers Static Assets defaults to asset-first routing. If /navo3d/
exists as a static asset, it can be returned before src/index.js runs. V8.9
relied on the Worker to enforce access and inject license-lease-v89.js, so the
Navo3D page could load without the Worker gate.

Fix
---
- wrangler.jsonc adds assets.run_worker_first for API + Navo2D/Navo3D routes.
- featureAuthorized now explicitly requires context.user.licensed in addition
  to the plan entitlement.
- Existing V8.9 lease/takeover logic is preserved.
- NAVOFLO_ENFORCE_LICENSES remains true.
- No D1 migration required.

Expected test
-------------
1. User without a seat: /navo3d/ must not load.
2. Licensed user: Navo3D must acquire a lease.
3. Same license on another device/profile: takeover prompt must appear.
4. Navo2D + Navo3D on same device remain allowed simultaneously.
