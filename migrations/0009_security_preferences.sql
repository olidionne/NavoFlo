-- NavoFlo V8.14 — production security hardening + per-user module preferences.
-- Run once after 0008_audit_log_indexes.sql.

CREATE TABLE IF NOT EXISTS user_preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  module TEXT NOT NULL,
  preferences_json TEXT NOT NULL DEFAULT '{}',
  revision INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, module),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user_updated
ON user_preferences(user_id, updated_at);

CREATE TABLE IF NOT EXISTS security_rate_limits (
  bucket TEXT PRIMARY KEY,
  hit_count INTEGER NOT NULL DEFAULT 0,
  window_started_at TEXT NOT NULL,
  blocked_until TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_security_rate_limits_updated
ON security_rate_limits(updated_at);

-- Cleanup / active-session indexes used by the V8.14 maintenance job.
CREATE INDEX IF NOT EXISTS idx_auth_sessions_cleanup
ON auth_sessions(expires_at, revoked_at, last_seen_at);

CREATE INDEX IF NOT EXISTS idx_app_leases_cleanup
ON app_leases(expires_at, revoked_at, last_seen_at);

CREATE INDEX IF NOT EXISTS idx_password_reset_cleanup
ON password_reset_tokens(expires_at, consumed_at, revoked_at);

CREATE INDEX IF NOT EXISTS idx_account_activation_cleanup
ON account_activation_tokens(expires_at, consumed_at, revoked_at);

CREATE INDEX IF NOT EXISTS idx_invitations_cleanup
ON invitations(expires_at, accepted_at);
