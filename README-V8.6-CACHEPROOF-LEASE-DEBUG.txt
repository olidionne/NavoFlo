NavoFlo V8.6 — Cache-proof lease loader

- Renames the lease client to /js/license-lease-v86.js instead of relying on a query-string cache buster.
- Displays build 8.6 directly in the license validation UI.
- Adds a 15-second UI watchdog independent of the fetch timeout.
- Adds diagnostic stage reporting if validation does not complete.
- No D1 migration required.
