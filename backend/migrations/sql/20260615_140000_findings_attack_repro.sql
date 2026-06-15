-- +goose Up
-- +goose StatementBegin
ALTER TABLE findings
  ADD COLUMN attack_path JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN repro_steps JSONB NOT NULL DEFAULT '[]'::jsonb;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE findings
  DROP COLUMN attack_path,
  DROP COLUMN repro_steps;
-- +goose StatementEnd
