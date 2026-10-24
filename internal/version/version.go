// Package version 提供应用版本号的单一来源。
//
// 版本号只在 Go 侧维护一份：桌面端通过 GetVersion() 暴露给前端，
// wails.json 与 frontend/package.json 中的版本号由 version_test.go 校验，
// 任何一处不一致都会让测试失败。
package version

// Version 是当前应用版本号（不含 v 前缀）。
// 构建时可用 -ldflags "-X locknote/internal/version.Version=x.y.z" 覆盖。
var Version = "1.1.0"

// Display 返回带 v 前缀的版本号，用于界面展示。
func Display() string {
	return "v" + Version
}
