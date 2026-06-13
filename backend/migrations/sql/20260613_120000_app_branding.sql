-- +goose Up
-- +goose StatementBegin
-- Installation-wide whitelabel branding. Singleton row (id = 1) holds the
-- active brand identity used across the app UI and the generated reports.
CREATE TABLE app_branding (
  id                BIGINT       PRIMARY KEY,
  app_name          TEXT         NOT NULL DEFAULT 'Suricatoos',
  primary_color     TEXT         NOT NULL DEFAULT '#194FE3',
  accent_color      TEXT         NOT NULL DEFAULT '#FF7678',
  app_logo          TEXT         NULL,   -- data URI (light backgrounds)
  app_logo_on_dark  TEXT         NULL,   -- data URI (dark-background variant)
  client_name       TEXT         NULL,   -- default co-branding client name
  client_logo       TEXT         NULL,   -- data URI (default client logo)
  created_at        TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT app_branding_singleton CHECK (id = 1)
);

-- Seed the singleton with the default Suricatoos identity.
INSERT INTO app_branding (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TRIGGER update_app_branding_modified
  BEFORE UPDATE ON app_branding
  FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- Add privileges for Admin role (role_id = 1)
INSERT INTO privileges (role_id, name) VALUES
    (1, 'settings.branding.admin'),
    (1, 'settings.branding.view'),
    (1, 'settings.branding.edit')
    ON CONFLICT DO NOTHING;

-- Add privileges for User role (role_id = 2) — view only, so the app UI and
-- reports render the active brand for every authenticated user.
INSERT INTO privileges (role_id, name) VALUES
    (2, 'settings.branding.view')
    ON CONFLICT DO NOTHING;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DELETE FROM privileges WHERE name IN (
  'settings.branding.admin',
  'settings.branding.view',
  'settings.branding.edit'
);

DROP TABLE IF EXISTS app_branding;
-- +goose StatementEnd
