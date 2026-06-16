-- +goose Up
-- +goose StatementBegin
ALTER TABLE findings
  ADD COLUMN retest_status TEXT NOT NULL DEFAULT 'open'
    CHECK (retest_status IN ('open','fixed','not_fixed','accepted'));
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE findings DROP COLUMN retest_status;
-- +goose StatementEnd
