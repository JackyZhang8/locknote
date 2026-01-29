// https://github.com/JackyZhang8/locknote
// 一个简单、可靠、离线优先的桌面加密笔记软件。
// A simple, reliable, offline-first encrypted note-taking desktop app.
package main

import (
	"os"
	"path/filepath"
	"strings"
)

func writeFileImpl(path string, data []byte) error {
	return os.WriteFile(path, data, 0600)
}

func readFileImpl(path string) ([]byte, error) {
	return os.ReadFile(path)
}

func renameFileImpl(oldPath, newPath string) error {
	return os.Rename(oldPath, newPath)
}

func extractTitle(filePath, content string) string {
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
