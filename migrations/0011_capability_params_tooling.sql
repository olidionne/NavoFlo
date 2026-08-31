-- NavoFlo V8.26 — Parameterizable capabilities + bending tooling (dies & punches).
-- Run once after 0010_company_settings.sql.
-- All physical dimensions are stored in millimetres; the UI converts to inches.

-- Per-process technical parameters (bed size, per-material max thickness, bend length, tonnage...).
-- Stored as a JSON blob because the schema differs per process category.
ALTER TABLE organization_capabilities ADD COLUMN params_json TEXT;

-- Bending tooling owned by the organization: V-dies and punches.
-- The die V-opening drives achievable inside radius + required tonnage;
-- the punch radius/angle drives the bend geometry.
CREATE TABLE IF NOT EXISTS organization_tooling (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL,
  tool_type TEXT NOT NULL,           -- 'die' | 'punch'
  name TEXT,
  v_opening_mm REAL,                 -- die: V opening width
  die_angle_deg REAL,                -- die: included angle (e.g. 88, 90)
  punch_radius_mm REAL,              -- punch: tip radius
  punch_angle_deg REAL,              -- punch: included angle
  length_mm REAL,                    -- usable/segment length
  max_tonnage REAL,                  -- rated load (US ton)
  quantity INTEGER,
  notes TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by_user_id INTEGER,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_org_tooling_org
ON organization_tooling(organization_id, tool_type);
