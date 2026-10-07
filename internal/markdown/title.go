package markdown

import (
	"path/filepath"
	"strings"
)

// ExtractTitle returns the first level-one heading, or the file name without its extension.
func ExtractTitle(filePath, content string) string {
	lines := strings.Split(content, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "# ") {
			return strings.TrimPrefix(line, "# ")
		}
	}

	base := filepath.Base(filePath)
	ext := filepath.Ext(base)
	return strings.TrimSuffix(base, ext)
}
