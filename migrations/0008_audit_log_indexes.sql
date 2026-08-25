-- NavoFlo V8.13 — audit log portal indexes.
-- The audit_log table already exists; these indexes keep organization history filters responsive.

CREATE INDEX IF NOT EXISTS idx_audit_log_org_action_created
ON audit_log(organization_id, action, created_at);

CREATE INDEX IF NOT EXISTS idx_audit_log_org_actor_created
ON audit_log(organization_id, actor_user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_audit_log_org_target_created
ON audit_log(organization_id, target_user_id, created_at);
