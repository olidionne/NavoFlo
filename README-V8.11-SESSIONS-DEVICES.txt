NavoFlo V8.11 — SESSIONS & DEVICES PORTAL

Goal
----
Add user-visible session/device management to the existing NavoFlo account portal without changing V8.9.2 licensing rules.

Added
-----
1. Web sessions
   - Lists every active NavoFlo browser session for the signed-in user.
   - Identifies the current browser session.
   - Shows creation date, last activity and expiry.
   - Allows revoking one session.
   - Allows revoking all other web sessions.
   - Revoking the current session signs the browser out.

2. NavoFlo devices
   - Lists up to 20 recent Navo2D/Navo3D devices for the signed-in user.
   - Shows active/inactive/disconnected state.
   - Shows active products (Navo2D/Navo3D), last activity and current lease expiry.
   - Identifies the current browser/device when the existing navoflo_device_id is available.
   - Disconnecting a device immediately revokes all of that device's active app leases.
   - A disconnected device is not permanently banned; reopening Navo2D/Navo3D can acquire a new lease normally if the account/license is still valid.

3. Audit events already written for the later audit-log UI
   - auth.session_revoked
   - auth.other_sessions_revoked
   - license.device_disconnected

API
---
GET  /api/auth/sessions
POST /api/auth/sessions/{id}/revoke
POST /api/auth/sessions/revoke-others
GET  /api/licensing/devices?current_device_id=...
POST /api/licensing/devices/{id}/disconnect

Database
--------
No new migration is required for V8.11.
The feature reuses auth_sessions, devices, app_leases and audit_log from migration 0005.
Migration 0006 remains required for the V8.10 password-reset feature.

Compatibility
-------------
- Existing Admin fixed-license behavior unchanged.
- Existing floating USER transfer behavior unchanged.
- Existing single-workstation lease/takeover behavior unchanged.
- Existing Navo2D/Navo3D enforcement unchanged.
- V8.10 password reset remains included.

Validation
----------
- JS syntax validation passes for modified Worker/frontend files.
- Password-reset integration test still passes.
- Sessions/devices integration test passes:
  * current session detection
  * individual session revoke
  * revoke all other sessions
  * active device listing
  * current device detection
  * device disconnect
  * immediate app lease revoke
  * audit events
