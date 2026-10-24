package version

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func readJSONFile(t *testing.T, path string) map[string]any {
	t.Helper()
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}
	var parsed map[string]any
	if err := json.Unmarshal(data, &parsed); err != nil {
		t.Fatalf("parse %s: %v", path, err)
	}
	return parsed
}

func TestDisplayHasVPrefix(t *testing.T) {
	if got, want := Display(), "v"+Version; got != want {
		t.Fatalf("Display() = %q, want %q", got, want)
	}
}

// TestVersionMatchesBuildMetadata 保证 Go 侧版本号与构建配置一致。
// 版本号只在 internal/version 维护，wails.json 与 package.json 必须同步，
// 否则发布产物的版本信息会与实际不符。
func TestVersionMatchesBuildMetadata(t *testing.T) {
	root := filepath.Join("..", "..")

	wailsConfig := readJSONFile(t, filepath.Join(root, "wails.json"))
	info, ok := wailsConfig["info"].(map[string]any)
	if !ok {
		t.Fatal("wails.json missing info section")
	}
	if got, _ := info["productVersion"].(string); got != Version {
		t.Errorf("wails.json productVersion = %q, want %q", got, Version)
	}

	pkg := readJSONFile(t, filepath.Join(root, "frontend", "package.json"))
	if got, _ := pkg["version"].(string); got != Version {
		t.Errorf("frontend/package.json version = %q, want %q", got, Version)
	}
}
