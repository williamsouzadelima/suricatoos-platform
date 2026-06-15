package converter

import (
	"database/sql"
	"encoding/json"

	"suricatoos/pkg/database"
	"suricatoos/pkg/graph/model"
)

// ConvertFinding maps a persisted finding row to the GraphQL model. JSONB columns are passed
// through as JSON strings (references/provenance) or decoded into typed lists (affected,
// sourceTaskIds); the report layer parses the JSON strings.
func ConvertFinding(f database.Finding) *model.Finding {
	return &model.Finding{
		ID:             f.ID,
		FlowID:         f.FlowID,
		Title:          f.Title,
		Severity:       f.Severity,
		CvssScore:      nullFloatPtr(f.CvssScore),
		CvssVector:     nullStrPtr(f.CvssVector),
		Cwe:            nullStrPtr(f.Cwe),
		Category:       nullStrPtr(f.Category),
		Affected:       jsonStrSlice(f.Affected),
		Description:    f.Description,
		BusinessImpact: nullStrPtr(f.BusinessImpact),
		Likelihood:     nullInt16Ptr(f.Likelihood),
		Impact:         nullInt16Ptr(f.Impact),
		Remediation:    nullStrPtr(f.Remediation),
		References:     rawJSONPtr(f.References),
		AttackPath:     rawJSONPtr(f.AttackPath),
		ReproSteps:     rawJSONPtr(f.ReproSteps),
		Evidence:       nullStrPtr(f.Evidence),
		SourceTaskIds:  jsonInt64Slice(f.SourceTaskIds),
		Provenance:     rawJSONPtr(f.Provenance),
		CreatedAt:      f.CreatedAt.Time,
		UpdatedAt:      f.UpdatedAt.Time,
	}
}

func ConvertFindings(rows []database.Finding) []*model.Finding {
	out := make([]*model.Finding, 0, len(rows))
	for _, f := range rows {
		out = append(out, ConvertFinding(f))
	}
	return out
}

func ConvertFindingDerivation(d database.FindingDerivation) *model.FindingDerivation {
	return &model.FindingDerivation{
		ID:        d.ID,
		FlowID:    d.FlowID,
		Status:    model.StatusType(d.Status),
		Summary:   nullStrPtr(d.Summary),
		Error:     nullStrPtr(d.Error),
		CreatedAt: d.CreatedAt.Time,
		UpdatedAt: d.UpdatedAt.Time,
	}
}

// ── null/json helpers ─────────────────────────────────────────────────────────

func nullStrPtr(ns sql.NullString) *string {
	if !ns.Valid {
		return nil
	}
	s := ns.String
	return &s
}

func nullFloatPtr(nf sql.NullFloat64) *float64 {
	if !nf.Valid {
		return nil
	}
	v := nf.Float64
	return &v
}

func nullInt16Ptr(ni sql.NullInt16) *int {
	if !ni.Valid {
		return nil
	}
	v := int(ni.Int16)
	return &v
}

func jsonStrSlice(raw json.RawMessage) []string {
	out := []string{}
	if len(raw) > 0 {
		_ = json.Unmarshal(raw, &out)
	}
	if out == nil {
		out = []string{}
	}
	return out
}

func jsonInt64Slice(raw json.RawMessage) []int64 {
	out := []int64{}
	if len(raw) > 0 {
		_ = json.Unmarshal(raw, &out)
	}
	if out == nil {
		out = []int64{}
	}
	return out
}

// rawJSONPtr returns the JSON text as a *string for the GraphQL String field, or nil when empty.
func rawJSONPtr(raw json.RawMessage) *string {
	if len(raw) == 0 {
		return nil
	}
	s := string(raw)
	if s == "" || s == "null" {
		return nil
	}
	return &s
}
