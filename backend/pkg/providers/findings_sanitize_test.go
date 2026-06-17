package providers

import (
	"strings"
	"testing"
)

// sanitizeForLLM must strip ANSI color codes but keep the real bytes — the raw termlogs (e.g. the
// juice-shop runs) are full of \x1b[..m sequences that otherwise eat the evidence budget.
func TestSanitizeForLLM_StripsAnsiKeepsContent(t *testing.T) {
	in := "\x1b[92m200 OK\x1b[0m\nUNION SELECT password FROM users--"
	out := sanitizeForLLM(in)
	if strings.ContainsRune(out, '\x1b') {
		t.Fatalf("ANSI escape not stripped: %q", out)
	}
	for _, want := range []string{"200 OK", "UNION SELECT password FROM users--"} {
		if !strings.Contains(out, want) {
			t.Errorf("sanitized output should contain %q, got %q", want, out)
		}
	}
}

// Control chars (NUL/BEL/lone ESC) are removed; tab and newline are preserved so the proof keeps
// its line/column structure.
func TestSanitizeForLLM_StripsControlCharsKeepsTabNewline(t *testing.T) {
	if got := sanitizeForLLM("a\x00b\x07c\x1bd"); got != "abcd" {
		t.Errorf("control chars not stripped: got %q want %q", got, "abcd")
	}
	keep := "col1\tcol2\nrow"
	if got := sanitizeForLLM(keep); got != keep {
		t.Errorf("tab/newline must survive: got %q want %q", got, keep)
	}
}

// Runs of 3+ blank lines collapse to a single blank line; a single blank line is left alone.
func TestSanitizeForLLM_CollapsesBlankRuns(t *testing.T) {
	if got := sanitizeForLLM("line1\n\n\n\n\nline2"); got != "line1\n\nline2" {
		t.Errorf("blank-run collapse: got %q want %q", got, "line1\n\nline2")
	}
	single := "a\n\nb"
	if got := sanitizeForLLM(single); got != single {
		t.Errorf("single blank line must be preserved: got %q want %q", got, single)
	}
}

// Already-clean tool output must pass through unchanged (no spurious mutation).
func TestSanitizeForLLM_CleanTextUnchanged(t *testing.T) {
	in := "GET /api HTTP/1.1\nHost: target\n\nHTTP/1.1 200 OK"
	if got := sanitizeForLLM(in); got != in {
		t.Errorf("clean text should be unchanged: got %q want %q", got, in)
	}
}
