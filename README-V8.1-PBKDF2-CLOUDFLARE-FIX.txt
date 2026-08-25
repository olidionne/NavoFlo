NavoFlo V8.1 — Cloudflare PBKDF2 compatibility fix

Changes from V8.0:
- PBKDF2-SHA256 iteration count reduced from 310,000 to 100,000.
- Cloudflare Workers WebCrypto rejects PBKDF2 deriveBits iteration counts above 100,000.
- Password verification now accepts the V8.1 iteration count explicitly, preventing an unsupported deriveBits request.
- No D1 migration is required for this patch.

Deployment:
1. Replace/deploy the V8.1 Worker/static files.
2. Keep the V8 database migration already applied.
3. Retry /auth/setup/ and create the Owner password.
