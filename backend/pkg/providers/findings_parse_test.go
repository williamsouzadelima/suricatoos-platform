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
