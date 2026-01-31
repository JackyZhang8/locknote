//  https://github.com/JackyZhang8/locknote
//  一个简单、可靠、离线优先的桌面加密笔记软件。
//  A simple, reliable, offline-first encrypted note-taking desktop app.

package main

import (
	"context"
	"locknote/internal/core"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App 是桌面端应用壳，持有 core 并处理桌面专属逻辑（窗口事件等）
type App struct {
	ctx               context.Context
	core              *core.Core
	dataDir           string
	windowWatcher     *time.Ticker
	windowWatcherOnce sync.Once
	watcherStop       chan struct{}
	lastMinimized     bool
}

func NewApp() *App {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		homeDir = "."
	}
	dataDir := filepath.Join(homeDir, ".locknote")
	legacyDir := filepath.Join(homeDir, ".notebase")
	if _, err := os.Stat(legacyDir); err == nil {
		if _, err := os.Stat(dataDir); os.IsNotExist(err) {
			if err := os.Rename(legacyDir, dataDir); err != nil {
				dataDir = legacyDir
			}
		}
	}
	return &App{
		dataDir: dataDir,
	}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.watcherStop = make(chan struct{})

	c, err := core.New(a.dataDir)
	if err != nil {
		panic(err)
	}
	a.core = c

	// 设置锁定回调，用于发送桌面端事件
	a.core.SetLockCallback(func() {
		if a.ctx != nil {
			runtime.EventsEmit(a.ctx, "app:locked")
		}
	})

	runtime.EventsOn(a.ctx, "frontend:ready", func(optionalData ...interface{}) {
		a.startWindowWatcherOnce()
	})

	time.AfterFunc(3*time.Second, func() {
		a.startWindowWatcherOnce()
	})
}

func (a *App) startWindowWatcherOnce() {
	a.windowWatcherOnce.Do(func() {
		a.startWindowWatcher()
	})
}

func (a *App) shutdown(ctx context.Context) {
	a.stopWindowWatcher()
	if a.core != nil {
		a.core.Close()
	}
}

func (a *App) startWindowWatcher() {
	a.windowWatcher = time.NewTicker(500 * time.Millisecond)
	go func() {
		for {
			select {
			case <-a.watcherStop:
				return
			case <-a.windowWatcher.C:
				a.checkWindowState()
			}
		}
	}()
}

func (a *App) stopWindowWatcher() {
	if a.windowWatcher != nil {
		a.windowWatcher.Stop()
	}
	if a.watcherStop != nil {
		close(a.watcherStop)
	}
}

func (a *App) checkWindowState() {
	if a.ctx == nil {
		return
	}

	isMinimized := runtime.WindowIsMinimised(a.ctx)

	if isMinimized && !a.lastMinimized {
		if a.core.IsUnlocked() {
			settings, _ := a.core.GetSettings()
			if settings != nil && settings.LockOnMinimize {
				a.core.Lock()
				runtime.EventsEmit(a.ctx, "app:locked")
			}
		}
	}

	a.lastMinimized = isMinimized
}

// ============ 委托给 core 的安全相关方法 ============

func (a *App) IsFirstRun() bool {
	return a.core.IsFirstRun()
}

func (a *App) SetupPassword(password, hint, displayKey string) (*core.SetupResult, error) {
	return a.core.SetupPassword(password, hint, displayKey)
}

func (a *App) VerifyDataKey(displayKey string) (bool, error) {
	return a.core.VerifyDataKey(displayKey)
}

func (a *App) Unlock(password string) (bool, error) {
	return a.core.Unlock(password)
}

func (a *App) Lock() {
	a.core.Lock()
}

func (a *App) IsUnlocked() bool {
	return a.core.IsUnlocked()
}

func (a *App) GetPasswordHint() (string, error) {
	return a.core.GetPasswordHint()
}

func (a *App) ChangePassword(oldPassword, newPassword, newHint string) error {
	return a.core.ChangePassword(oldPassword, newPassword, newHint)
}

func (a *App) ResetPasswordWithDataKey(displayKey, newPassword, newHint string) error {
	return a.core.ResetPasswordWithDataKey(displayKey, newPassword, newHint)
}

func (a *App) UpdateActivity() {
	a.core.UpdateActivity()
}

func (a *App) GenerateDataKey() (string, error) {
	return a.core.GenerateDataKey()
}

func (a *App) GetDataDir() string {
	return a.core.GetDataDir()
}

func (a *App) GetVersion() string {
	return "v1.0.3"
}
