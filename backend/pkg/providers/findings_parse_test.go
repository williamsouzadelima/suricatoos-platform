package providers

import "testing"

// Reproduces the production failure: DeepSeek returned tool-call args with a trailing '}' (and,
// in other runs, a ```json fence / prose preamble). json.Unmarshal rejected all of these; the
// tolerant parseFindingsReport must accept them and yield the findings.
func TestParseFindingsReport_Tolerant(t *testing.T) {
	valid := `{"findings":[{"title":"SQLi","severity":"critical","description":"x"}],"summary":"s"}`

	cases := map[string]string{
		"clean":           valid,
		"trailing brace":  valid + "}",       // the exact prod error: "'}' after top-level value"
		"trailing prose":  valid + "\nDone.", // model appended an explanation
		"fenced":          "```json\n" + valid + "\n```",
		"prose preamble":  "Here are the findings:\n" + valid,
		"leading spaces":  "   " + valid + "  ",
	}

	for name, in := range cases {
		report, err := parseFindingsReport(in)
		if err != nil {
			t.Errorf("%s: unexpected error: %v", name, err)
			continue
		}
		if len(report.Findings) != 1 || report.Findings[0].Title != "SQLi" {
			t.Errorf("%s: bad parse: %+v", name, report)
		}
	}

	if _, err := parseFindingsReport("not json at all"); err == nil {
		t.Error("expected error for non-JSON input")
	}
}

// Reproduces the production failure modes that strict decoding rejected ("invalid character 't'
// after object key:value pair"): a finding with an internal glitch, and a truncated final object.
// salvageFindings (via parseFindingsReport) must recover every well-formed finding.
func TestParseFindingsReport_Salvage(t *testing.T) {
	cases := map[string]struct {
		in        string
		wantCount int
		wantFirst string
	}{
		"missing comma in one finding skips only that one": {
			in:        `{"findings":[{"title":"SQLi","severity":"critical","description":"x"},{"title":"XSS" "severity":"high","description":"y"},{"title":"IDOR","severity":"high","description":"z"}]}`,
			wantCount: 2, // the middle one (missing comma) is dropped, the other two survive
			wantFirst: "SQLi",
		},
		"truncated final object keeps the complete ones": {
			in:        `{"findings":[{"title":"SQLi","severity":"critical","description":"x"},{"title":"XSS","severity":"high","desc`,
			wantCount: 1,
			wantFirst: "SQLi",
		},
		"fenced + trailing prose still salvages": {
			in:        "```json\n{\"findings\":[{\"title\":\"SQLi\",\"severity\":\"critical\",\"description\":\"x\" \"bad\":1}]}\n```\ndone",
			wantCount: 0, // single malformed finding, nothing well-formed -> error path (count 0 via err)
			wantFirst: "",
		},
	}
	for name, c := range cases {
		report, err := parseFindingsReport(c.in)
		if c.wantCount == 0 {
			if err == nil {
				t.Errorf("%s: expected error (no salvageable findings), got %d", name, len(report.Findings))
			}
			continue
		}
		if err != nil {
			t.Errorf("%s: unexpected error: %v", name, err)
			continue
		}
		if len(report.Findings) != c.wantCount {
			t.Errorf("%s: got %d findings, want %d", name, len(report.Findings), c.wantCount)
		}
		if len(report.Findings) > 0 && report.Findings[0].Title != c.wantFirst {
			t.Errorf("%s: first title %q, want %q", name, report.Findings[0].Title, c.wantFirst)
		}
	}
}
