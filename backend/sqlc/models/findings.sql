-- name: GetFlowFindings :many
SELECT * FROM findings WHERE flow_id = $1
ORDER BY (CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1
  WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END), created_at DESC;

-- name: GetFinding :one
SELECT * FROM findings WHERE id = $1;

-- name: CreateFinding :one
INSERT INTO findings (
  flow_id, derive_run_id, title, severity, cvss_score, cvss_vector, cwe, category,
  affected, description, business_impact, likelihood, impact, remediation,
  "references", attack_path, repro_steps, evidence, source_task_ids, evidence_refs, provenance
) VALUES (
  $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21
) RETURNING *;

-- name: DeleteFlowFindings :exec
DELETE FROM findings WHERE flow_id = $1;

-- name: CreateFindingDerivation :one
INSERT INTO finding_derivations (flow_id, status, model, provider)
VALUES ($1, $2, $3, $4) RETURNING *;

-- name: UpdateFindingDerivationStatus :one
UPDATE finding_derivations SET status = $1, summary = $2, error = $3 WHERE id = $4 RETURNING *;

-- name: GetLatestFlowDerivation :one
SELECT * FROM finding_derivations WHERE flow_id = $1 ORDER BY created_at DESC LIMIT 1;
