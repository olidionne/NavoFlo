NavoFlo V8.9.2 — FULL DEPLOY PACKAGE

Base: V8.9 Navo3D Lease
Includes: V8.9.1 Worker-first fix + V8.9.2 auth-loop fix

Important:
- NAVOFLO_ENFORCE_LICENSES=true is enabled in wrangler.jsonc.
- Worker-first routing is enabled for /navo2d/* and /navo3d/* so static assets cannot bypass licensing middleware.
- Logged-out users are redirected to /login/?next=...
- Logged-in users without a required license receive a 403 License required page instead of a login redirect loop.
- No new D1 migration is required beyond migrations 0001 through 0005 already applied.

DEPLOYMENT:
Copy/overwrite this package into the existing NavoFlo repository and commit once.
Do NOT delete existing application assets that are not present in this package (notably an existing public/navo3d implementation, if it lives separately in your repository).
