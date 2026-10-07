package markdown

import "testing"

func TestExtractTitle(t *testing.T) {
	for _, tt := range []struct{ name, path, content, want string }{
		{"first heading", "notes/fallback.md", "intro\n# 标题\n# Other", "标题"},
		{"trim heading", "note.md", "  # Title  \r\n", "Title"},
		{"filename fallback", "notes/my.note.md", "## Not level one", "my.note"},
		{"empty content", "note.md", "", "note"},
	} {
		t.Run(tt.name, func(t *testing.T) {
			if got := ExtractTitle(tt.path, tt.content); got != tt.want {
				t.Fatalf("ExtractTitle() = %q, want %q", got, tt.want)
			}
		})
	}
}
