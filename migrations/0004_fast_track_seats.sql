ALTER TABLE memberships ADD COLUMN pending_license INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_memberships_pending_license
ON memberships(organization_id, pending_license, active);
