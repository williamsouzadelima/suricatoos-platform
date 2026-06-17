package providers

import (
	"strings"
	"testing"
	"unicode/utf8"
)

func TestClip(t *testing.T) {
	t.Run("short strings pass through, whitespace collapsed", func(t *testing.T) {
		if got := clip("  hello   world  ", 100); got != "hello world" {
			t.Fatalf("clip collapse: got %q", got)
		}
	})

	t.Run("ascii is truncated with an ellipsis", func(t *testing.T) {
		got := clip(strings.Repeat("a", 50), 10)
		if want := strings.Repeat("a", 10) + "…"; got != want {
			t.Fatalf("clip ascii: got %q want %q", got, want)
		}
	})

	// Regression: a raw byte slice (s[:max]) splits a multi-byte UTF-8 rune and corrupts the
	// tail — common with accented pt-BR text. The result must stay valid UTF-8 and hold exactly
	// `max` runes plus the ellipsis.
	t.Run("multibyte runes are not split", func(t *testing.T) {
		got := clip(strings.Repeat("ç", 20), 5)
		if !utf8.ValidString(got) {
			t.Fatalf("clip produced invalid UTF-8: %q", got)
		}
		if want := strings.Repeat("ç", 5) + "…"; got != want {
			t.Fatalf("clip multibyte: got %q want %q", got, want)
		}
		if n := utf8.RuneCountInString(got); n != 6 {
			t.Fatalf("clip multibyte rune count: got %d want 6", n)
		}
	})
}
