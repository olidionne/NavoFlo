ALTER TABLE subscriptions ADD COLUMN organization_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_subscriptions_org ON subscriptions(organization_id);

ALTER TABLE users ADD COLUMN last_login_at TEXT;

ALTER TABLE license_assignments ADD COLUMN subscription_id TEXT;
CREATE INDEX IF NOT EXISTS idx_license_assignments_subscription
ON license_assignments(subscription_id);
