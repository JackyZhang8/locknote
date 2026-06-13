package main

import (
	"os"
	"strings"
	"testing"
)

func TestStartupInitializesCoreInBackground(t *testing.T) {
	source, err := os.ReadFile("app.go")
	if err != nil {
		t.Fatalf("read app.go: %v", err)
	}
	text := string(source)
	startupBody := between(text, "func (a *App) startup(ctx context.Context)", "func (a *App) startCoreInitialization")

	if !strings.Contains(startupBody, "a.startCoreInitialization(ctx)") {
		t.Fatalf("startup should delegate core initialization to startCoreInitialization")
	}
	if !containsAll(text, "func (a *App) startCoreInitialization(ctx context.Context)", "go func()") {
		t.Fatalf("startCoreInitialization should run core initialization in a goroutine")
	}
	if strings.Contains(startupBody, "core.New(a.dataDir)") {
		t.Fatalf("startup should not synchronously call core.New")
	}
	if !containsAll(text, "func (a *App) IsCoreReady() bool", "func (a *App) GetStartupError() string") {
		t.Fatalf("app should expose core readiness APIs for frontend cold-start waiting")
	}
}

func containsAll(text string, parts ...string) bool {
	for _, part := range parts {
		if !strings.Contains(text, part) {
			return false
		}
	}
	return true
}

func between(text, start, end string) string {
	startIndex := strings.Index(text, start)
	if startIndex < 0 {
		return ""
	}
	remaining := text[startIndex:]
	endIndex := strings.Index(remaining, end)
	if endIndex < 0 {
		return remaining
	}
	return remaining[:endIndex]
}
