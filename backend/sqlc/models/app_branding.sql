-- name: GetAppBranding :one
SELECT * FROM app_branding
WHERE id = 1;

-- name: UpsertAppBranding :one
INSERT INTO app_branding (
  id,
  app_name,
  primary_color,
  accent_color,
  app_logo,
  app_logo_on_dark,
  client_name,
  client_logo
) VALUES (
  1,
  $1,
  $2,
  $3,
  $4,
  $5,
  $6,
  $7
)
ON CONFLICT (id) DO UPDATE
SET app_name         = EXCLUDED.app_name,
    primary_color    = EXCLUDED.primary_color,
    accent_color     = EXCLUDED.accent_color,
    app_logo         = EXCLUDED.app_logo,
    app_logo_on_dark = EXCLUDED.app_logo_on_dark,
    client_name      = EXCLUDED.client_name,
    client_logo      = EXCLUDED.client_logo
RETURNING *;
