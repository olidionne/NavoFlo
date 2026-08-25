NavoFlo V8.5 — Lease watchdog fix

Changes:
- License API timeout now covers fetch + full response body parsing.
- Hard 12-second watchdog: the validation spinner can no longer remain forever.
- Only one lease acquisition request may run at a time per page.
- Duplicate/racing acquire calls are ignored.
- License API calls use no-store and same-origin credentials.
- Navo2D loads license-lease.js?v=8.5 to force browser/CDN cache refresh.
- No D1 migration required.
