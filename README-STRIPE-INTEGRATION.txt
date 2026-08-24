NavoFlo Stripe V4 — Cloudflare Workers native
==============================================

This version is for the current NavoFlo deployment architecture:
Cloudflare Workers + Static Assets + `npx wrangler deploy`.

IMPORTANT CHANGE FROM V3
------------------------
V3 used a /functions directory (Cloudflare Pages Functions routing).
The current NavoFlo project is a Workers Static Assets deployment, not Pages.
V4 replaces /functions with a real Worker entrypoint:

  src/index.js

and adds:

  wrangler.jsonc

The Worker handles /api/stripe/* and delegates the rest of the site to
Cloudflare Static Assets through env.ASSETS.

Expected webhook browser test after deployment:
  GET https://navoflo.com/api/stripe/webhook
  -> HTTP 405 Method Not Allowed

That is intentional: Stripe sends POST requests, not GET requests.
