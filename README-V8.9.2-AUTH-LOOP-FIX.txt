NavoFlo V8.9.2 — Auth redirect loop fix

Apply on top of V8.9.1.

Fix:
- Unauthenticated users visiting Navo2D/Navo3D are redirected to /login/?next=...
- Authenticated users without a compatible assigned license now receive a clear HTTP 403 "Licence requise" page instead of being redirected to login.
- Licensed users continue to enter the application and use the app lease/takeover system.
- Prevents the loop: app -> login -> app -> login for an already-authenticated but unlicensed account.

No D1 migration required.
NAVOFLO_ENFORCE_LICENSES remains true through the existing V8.9.1 wrangler configuration.
