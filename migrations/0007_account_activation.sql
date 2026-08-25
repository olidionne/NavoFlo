-- NavoFlo V8.12 — ADMIN account activation after Stripe subscription.
-- Run once after 0006_password_reset.sql.

CREATE TABLE IF NOT EXISTS account_activation_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  revoked_at TEXT,
  requested_ip_hash TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_account_activation_tokens_user
ON account_activation_tokens(user_id, consumed_at, revoked_at, expires_at);

CREATE INDEX IF NOT EXISTS idx_account_activation_tokens_expiry
ON account_activation_tokens(expires_at, consumed_at, revoked_at);
