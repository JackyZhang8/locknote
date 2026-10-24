package main

import (
	"strings"
	"testing"
)

func TestSanitizeFileName(t *testing.T) {
	tests := []struct {
		name string
		want string
	}{
		{"bad/name\\file:?.md", "bad_name_file__.md"},
		{" .hidden. ", "hidden"},
		{"\x00\x1f", "__"},
		{"...", "note"},
	}
	for _, test := range tests {
		if got := sanitizeFileName(test.name); got != test.want {
			t.Errorf("sanitizeFileName(%q) = %q, want %q", test.name, got, test.want)
		}
	}
	if got := len([]rune(sanitizeFileName(strings.Repeat("x", 101)))); got != 100 {
		t.Fatalf("sanitized filename length = %d, want 100", got)
	}
}
