-- NavoFlo V8 — native authentication + invitations + floating user licences.
-- Run once after 0004_fast_track_seats.sql.

ALTER TABLE users ADD COLUMN password_hash TEXT;
ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'pending_setup';
ALTER TABLE users ADD COLUMN email_verified_at TEXT;
ALTER TABLE users ADD COLUMN activated_at TEXT;
ALTER TABLE users ADD COLUMN failed_login_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN locked_until TEXT;

ALTER TABLE license_assignments ADD COLUMN license_type TEXT NOT NULL DEFAULT 'user';

-- The billing owner owns the fixed, non-transferable Admin licence.
UPDATE license_assignments
SET license_type='admin'
WHERE user_id IN (
  SELECT m.user_id
  FROM memberships m
  WHERE m.organization_id=license_assignments.organization_id
    AND m.role='owner'
    AND m.active=1
);

CREATE TABLE IF NOT EXISTS invitations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  email TEXT NOT NULL COLLATE NOCASE,
  token_hash TEXT NOT NULL UNIQUE,
  created_by_user_id INTEGER,
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_invitations_org_email
ON invitations(organization_id, email, accepted_at);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  ip_hash TEXT,
  user_agent TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user
ON auth_sessions(user_id, revoked_at, expires_at);

CREATE TABLE IF NOT EXISTS devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  device_identifier TEXT NOT NULL,
  name TEXT,
  first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at TEXT,
  UNIQUE(user_id, device_identifier),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_devices_user
ON devices(user_id, revoked_at);

CREATE TABLE IF NOT EXISTS app_leases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  license_assignment_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  device_id INTEGER NOT NULL,
  product TEXT NOT NULL,
  lease_token_hash TEXT NOT NULL UNIQUE,
  acquired_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  FOREIGN KEY (license_assignment_id) REFERENCES license_assignments(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_app_leases_assignment
ON app_leases(license_assignment_id, revoked_at, expires_at);
CREATE INDEX IF NOT EXISTS idx_app_leases_user
ON app_leases(user_id, revoked_at, expires_at);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER,
  actor_user_id INTEGER,
  action TEXT NOT NULL,
  target_user_id INTEGER,
  details_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL,
  FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_log_org
ON audit_log(organization_id, created_at);
