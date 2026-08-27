NavoFlo V8.20.0 PATCH from V8.19.2

Copy/overwrite the files contained in this patch at the repository root, then
deploy normally. The optional `mfr-service/` directory does not alter the main
Cloudflare deployment until `NAVOFLO_MFR_URL` is explicitly configured.

Important: analysis cache version changes once; STEP tabs are reanalysed under
V8.20 rules and then persist normally.
