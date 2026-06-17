package providers

import (
	"encoding/json"
	"testing"
)

// balancedObjectEnd must find the matching close brace, honoring strings + escapes, and return -1
// on a truncated object (the LLM hitting the token cap mid-object is the case salvageFindings relies on).
func TestBalancedObjectEnd(t *testing.T) {
	cases := []struct {
		name  string
		s     string
		start int
		want  int
	}{
		{"simple", `{"a":1}`, 0, 7},
		{"nested", `{"a":{"b":2}}`, 0, 13},
		{"brace inside string", `{"a":"}"}`, 0, 9},
		{"escaped quote then brace in string", `{"a":"x\"}"}`, 0, 12},
		{"truncated returns -1", `{"a":1`, 0, -1},
		{"offset start", `xx{"a":1}`, 2, 9},
	}
	for _, c := range cases {
		if got := balancedObjectEnd(c.s, c.start); got != c.want {
			t.Errorf("%s: balancedObjectEnd(%q,%d)=%d want %d", c.name, c.s, c.start, got, c.want)
		}
	}
}

// llmFindingToParams normalizes severity, defaults the title, clamps likelihood/impact to [1,5]
// (NULL otherwise), and enforces honesty on provenance (no 'measured'/'parsed'; missing
// severity/cvss/cwe default to 'inferred').
func TestLLMFindingToParams_NormalizationAndHonesty(t *testing.T) {
	p := llmFindingToParams(7, 9, LLMFinding{
		Title:      "",
		Severity:   "BOGUS",
		Likelihood: 9, // out of range -> NULL
		Impact:     3, // valid
		Provenance: map[string]string{"severity": "measured", "extra": "parsed"},
	})
	if p.FlowID != 7 {
		t.Errorf("FlowID=%d want 7", p.FlowID)
	}
	if !p.DeriveRunID.Valid || p.DeriveRunID.Int64 != 9 {
		t.Errorf("DeriveRunID=%+v want valid 9", p.DeriveRunID)
	}
	if p.Severity != "info" {
		t.Errorf("invalid severity should default to info, got %q", p.Severity)
	}
	if p.Title != "Untitled finding" {
		t.Errorf("empty title should default, got %q", p.Title)
	}
	if p.Likelihood.Valid {
		t.Errorf("likelihood 9 (out of [1,5]) should be NULL, got %+v", p.Likelihood)
	}
	if !p.Impact.Valid || p.Impact.Int16 != 3 {
		t.Errorf("impact 3 should be valid, got %+v", p.Impact)
	}
	var prov map[string]string
	if err := json.Unmarshal(p.Provenance, &prov); err != nil {
		t.Fatalf("provenance not valid JSON: %v", err)
	}
	for k, want := range map[string]string{"severity": "inferred", "extra": "inferred", "cvss": "inferred", "cwe": "inferred"} {
		if prov[k] != want {
			t.Errorf("provenance[%q]=%q want %q (downgrade/default to inferred); full=%v", k, prov[k], want, prov)
		}
	}
}

func TestLLMFindingToParams_ValidSeverityLowercased(t *testing.T) {
	p := llmFindingToParams(1, 2, LLMFinding{Title: "Real finding", Severity: "HIGH", Likelihood: 4})
	if p.Severity != "high" {
		t.Errorf("HIGH should normalize to high, got %q", p.Severity)
	}
	if !p.Likelihood.Valid || p.Likelihood.Int16 != 4 {
		t.Errorf("likelihood 4 should be valid, got %+v", p.Likelihood)
	}
}
