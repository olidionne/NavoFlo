NavoFlo V8.11.1 — Email runtime configuration hardening

- NAVOFLO_FROM_EMAIL is now a committed Worker runtime variable in wrangler.jsonc.
- RESEND_API_KEY is declared as a required Cloudflare Worker secret.
- A deployment will fail clearly if RESEND_API_KEY is not configured on the Worker.
- No licensing logic, D1 schema, session logic, or application lease logic changed.

Cloudflare runtime secret required:
  RESEND_API_KEY

Sender configured by wrangler.jsonc:
  NAVOFLO_FROM_EMAIL = NavoFlo <noreply@navoflo.com>
