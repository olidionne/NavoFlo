# NavoFeatureEngine V8.20.0 (optional AAGNet second opinion)

This sidecar is **not required** for local Navo3D analysis. NavoFlo's OpenCascade/MRE + Critical Arbitrator remains authoritative and works when this service is disabled.

The sidecar pins AAGNet to commit `e0e36b7a12a7f01a29d7be36efc22730d293a1bd` and uses its published MFInstSeg weights. AAGNet is MIT licensed.

## Contract

- `GET /health` -> service status
- `POST /analyze` with raw STEP body (`application/step`) -> AAGNet semantic/instance predictions
- optional `Authorization: Bearer <MFR_SERVICE_TOKEN>`
- response feature face IDs are marked **advisory** because PythonOCC face iteration order is not assumed to be identical to the browser OCCT-js retained-face IDs. V8.20 uses the class/instance semantics as a second opinion; an exact geometric face mapper is planned before face-level ML highlighting is enabled.

## NavoFlo Worker integration

Set Worker secrets/vars:

- `NAVOFLO_MFR_URL=https://<your-private-or-proxied-service-origin>/`
- `NAVOFLO_MFR_TOKEN=<same secret as MFR_SERVICE_TOKEN>`

`/api/mfr/status` stays disabled when `NAVOFLO_MFR_URL` is absent. The browser therefore never sends STEP files anywhere unless the operator explicitly configures the service.

## Container validation sequence

1. Build locally: `docker build -t navoflo-mfr:8.20.0 .`
2. Run: `docker run --rm -p 8080:8080 -e MFR_SERVICE_TOKEN=test navoflo-mfr:8.20.0`
3. Health: `curl -H 'Authorization: Bearer test' http://localhost:8080/health`
4. Analyze a regression STEP with raw body.
5. Only after the regression corpus passes, expose the service to the NavoFlo Worker.

For Cloudflare Containers, deploy this image/service separately and point `NAVOFLO_MFR_URL` at its authenticated ingress. Keep the main NavoFlo worker deploy independent so a feature-engine outage cannot block CAD viewing, measuring, DXF export, or unfolding.
