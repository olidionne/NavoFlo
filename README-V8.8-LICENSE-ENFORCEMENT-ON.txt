NavoFlo V8.8 — LICENSE ENFORCEMENT ON

Baseline: V8.7 License Gate Fix (validated).

Change in this build:
- wrangler.jsonc now defines NAVOFLO_ENFORCE_LICENSES="true".
- Server-side access enforcement is therefore enabled for /navo2d/ and /navo3d/ routes.
- Navo2D still uses the validated lease/takeover mechanism from V8.7.
- ADMIN licence remains fixed/non-transferable.
- USER licences remain floating and transferable only through the NavoFlo portal.
- No D1 migration is required.

Expected checks after deploy:
1. ADMIN with active licence -> /navo2d/ allowed.
2. USER with assigned licence -> /navo2d/ allowed.
3. USER without assigned licence -> redirected to login/access denied flow.
4. Same USER on a second workstation -> takeover prompt; only one active lease.

Important:
- keep_vars=true remains enabled, so existing Cloudflare secrets/runtime variables are preserved.
