-- +goose Up
-- +goose StatementBegin
-- LLM-derived report findings. Each derivation is one snapshot run over a flow's immutable
-- execution; findings are re-derivable artifacts (hard-deleted + recreated on re-derive),
-- so they intentionally skip the soft-delete pattern used by flows/tasks.
CREATE TABLE finding_derivations (
  id           BIGINT      PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  flow_id      BIGINT      NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  status       TEXT        NOT NULL DEFAULT 'created',  -- created|running|finished|failed
  model        TEXT,
  provider     TEXT,
  summary      TEXT,
  error        TEXT,
  created_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_finding_derivations_flow ON finding_derivations(flow_id);

CREATE TABLE findings (
  id              BIGINT      PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  flow_id         BIGINT      NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  derive_run_id   BIGINT      REFERENCES finding_derivations(id) ON DELETE CASCADE,
  title           TEXT        NOT NULL,
  severity        TEXT        NOT NULL DEFAULT 'info'
                     CHECK (severity IN ('critical','high','medium','low','info')),
  cvss_score      NUMERIC,
  cvss_vector     TEXT,
  cwe             TEXT,
  category        TEXT,
  affected        JSONB       NOT NULL DEFAULT '[]'::jsonb,
  description     TEXT        NOT NULL DEFAULT '',
  business_impact TEXT,
  likelihood      SMALLINT,
  impact          SMALLINT,
  remediation     TEXT,
  "references"    JSONB       NOT NULL DEFAULT '[]'::jsonb,
  evidence        TEXT,
  source_task_ids JSONB       NOT NULL DEFAULT '[]'::jsonb,
  evidence_refs   JSONB       NOT NULL DEFAULT '[]'::jsonb,
  provenance      JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_findings_flow ON findings(flow_id);
CREATE INDEX idx_findings_severity ON findings(severity);

CREATE TRIGGER update_findings_modified
  BEFORE UPDATE ON findings
  FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_finding_derivations_modified
  BEFORE UPDATE ON finding_derivations
  FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- Permissions: all pentesters (role 2) + admin (role 1) may view and derive.
INSERT INTO privileges (role_id, name) VALUES
  (1, 'findings.admin'), (1, 'findings.view'), (1, 'findings.derive'),
  (2, 'findings.view'), (2, 'findings.derive')
  ON CONFLICT (role_id, name) DO NOTHING;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DELETE FROM privileges WHERE name IN ('findings.admin','findings.view','findings.derive');
DROP TABLE IF EXISTS findings;
DROP TABLE IF EXISTS finding_derivations;
-- +goose StatementEnd
