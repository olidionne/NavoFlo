-- NavoFlo V8.25 — Company settings: manufacturing capabilities + K-factor / bend params.
-- Run once after 0009_security_preferences.sql.

-- Manufacturing capabilities declared by the organization.
-- Each row = one process (laser, plasma, milling, etc.) with enabled flag.
CREATE TABLE IF NOT EXISTS organization_capabilities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL,
  process TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by_user_id INTEGER,
  UNIQUE(organization_id, process),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_org_capabilities_org
ON organization_capabilities(organization_id);

-- Per-company K-factor / bend allowance rules.
-- Rows are matched by material_class + thickness + inner radius range.
-- Use material_class='all' for now; future material detection will narrow it down.
CREATE TABLE IF NOT EXISTS organization_bend_params (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL,
  material_class TEXT NOT NULL DEFAULT 'all',
  thickness_min_mm REAL,
  thickness_max_mm REAL,
  inner_radius_min_mm REAL,
  inner_radius_max_mm REAL,
  k_factor REAL NOT NULL,
  notes TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by_user_id INTEGER,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_org_bend_params_org
ON organization_bend_params(organization_id, material_class);
