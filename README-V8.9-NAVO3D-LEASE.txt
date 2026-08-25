NavoFlo V8.9 — Navo3D Lease Enforcement
========================================

Base: V8.8 (NAVOFLO_ENFORCE_LICENSES=true)
No D1 migration required.

Changes
-------
1. Navo3D now receives the same live license gate as Navo2D.
   - The Worker injects /js/license-lease-v89.js into HTML responses under
     /navo3d/ and /en/navo3d/.
   - No edit to the existing Navo3D page source is required.

2. One paid license remains limited to ONE DEVICE at a time across the suite.
   - If the same license is active on another device, Navo2D/Navo3D shows
     "Licence déjà utilisée" and can take over the seat.
   - Taking over revokes all active leases on the old device.

3. Multiple NavoFlo apps/tabs are now allowed on the SAME DEVICE.
   - Navo2D + Navo3D may remain open together on one workstation.
   - Multiple tabs on the same workstation do not consume extra seats.
   - Each app/tab receives its own short-lived heartbeat token.

4. Navo2D is upgraded to license-lease-v89.js.

Deployment
----------
Overlay this package on the existing repository. Do not delete an existing
public/navo3d directory if it exists in your repository; V8.9 intentionally
integrates Navo3D at the Worker layer so the current Navo3D implementation is
preserved unchanged.

NAVOFLO_ENFORCE_LICENSES remains true in wrangler.jsonc.

Suggested tests
---------------
A. Same device:
   - Open Navo2D and Navo3D with the same licensed user.
   - Both should remain usable simultaneously.

B. Different device/browser profile:
   - Open Navo3D using the same licensed user from another device/profile.
   - It should show "Licence déjà utilisée".
   - Click "Utiliser ce poste".
   - The old device should be locked on its next heartbeat.

C. User without license:
   - /navo3d/ must remain inaccessible.
