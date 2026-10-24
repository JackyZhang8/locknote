//  https://github.com/JackyZhang8/locknote
//  一个简单、可靠、离线优先的桌面加密笔记软件。
//  A simple, reliable, offline-first encrypted note-taking desktop app.

package main

import (
	"context"
	"errors"
	"fmt"
	"locknote/internal/core"
	"log"
	"os"
	"path/filepath"
	"sync"
	"sync/atomic"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App 是桌面端应用壳，持有 core 并处理桌面专属逻辑（窗口事件等）
type App struct {
	ctx               context.Context
	core              *core.Core
	coreReady         chan struct{}
	coreInitErr       error
	coreMu            sync.RWMutex
	dataDir           string
	windowWatcher     *time.Ticker
	windowWatcherOnce sync.Once
	watcherStop       chan struct{}
	lastMinimized     bool
	allowClose        atomic.Bool
	closeRequestStart atomic.Bool
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
		dataDir:   dataDir,
		coreReady: make(chan struct{}),
	}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.watcherStop = make(chan struct{})
	a.startCoreInitialization(ctx)

	runtime.EventsOn(a.ctx, "frontend:ready", func(optionalData ...interface{}) {
		a.startWindowWatcherOnce()
	})

	time.AfterFunc(3*time.Second, func() {
		a.startWindowWatcherOnce()
	})
}

func (a *App) startCoreInitialization(ctx context.Context) {
	go func() {
		c, err := core.New(a.dataDir)
		if err != nil {
			log.Printf("Failed to initialize core: %v", err)
			a.coreMu.Lock()
			a.coreInitErr = err
			a.coreMu.Unlock()
			close(a.coreReady)
			if ctx != nil {
				runtime.MessageDialog(ctx, runtime.MessageDialogOptions{
					Type:    runtime.ErrorDialog,
					Title:   "LockNote",
					Message: fmt.Sprintf("Failed to initialize: %v", err),
				})
			}
			return
		}

		a.coreMu.Lock()
		a.core = c

		// 设置锁定回调，用于发送桌面端事件
		a.core.SetLockCallback(func() {
			if a.ctx != nil {
				runtime.EventsEmit(a.ctx, "app:locked")
			}
		})
		a.coreMu.Unlock()
		close(a.coreReady)
	}()
}

func (a *App) IsCoreReady() bool {
	select {
	case <-a.coreReady:
		a.coreMu.RLock()
		defer a.coreMu.RUnlock()
		return a.core != nil && a.coreInitErr == nil
	default:
		return false
	}
}

func (a *App) GetStartupError() string {
	select {
	case <-a.coreReady:
		a.coreMu.RLock()
		defer a.coreMu.RUnlock()
		if a.coreInitErr != nil {
			return a.coreInitErr.Error()
		}
		return ""
	default:
		return ""
	}
}

func (a *App) getCoreIfReady() *core.Core {
	select {
	case <-a.coreReady:
		a.coreMu.RLock()
		defer a.coreMu.RUnlock()
		if a.coreInitErr != nil {
			return nil
		}
		return a.core
	default:
		return nil
	}
}

func (a *App) coreOrErr() (*core.Core, error) {
	c := a.getCoreIfReady()
	if c == nil {
		return nil, errors.New("应用尚未就绪，请稍候重试")
	}
	return c, nil
}

func (a *App) startWindowWatcherOnce() {
	a.windowWatcherOnce.Do(func() {
		a.startWindowWatcher()
	})
}

func (a *App) shutdown(ctx context.Context) {
	a.stopWindowWatcher()
	if c := a.getCoreIfReady(); c != nil {
		c.Close()
	}
}

func (a *App) beforeClose(ctx context.Context) bool {
	if a.allowClose.Load() {
		return false
	}
	if a.closeRequestStart.CompareAndSwap(false, true) {
		runtime.EventsEmit(ctx, "app:before-close")
		time.AfterFunc(3*time.Second, func() {
			if !a.allowClose.Swap(true) {
				runtime.Quit(ctx)
			}
		})
	}
	return true
}

func (a *App) ConfirmClose() {
	a.allowClose.Store(true)
	runtime.Quit(a.ctx)
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
		a.watcherStop = nil
	}
}

func (a *App) checkWindowState() {
	if a.ctx == nil {
		return
	}

	isMinimized := runtime.WindowIsMinimised(a.ctx)

	if isMinimized && !a.lastMinimized {
		if c := a.getCoreIfReady(); c != nil && c.IsUnlocked() {
			settings, _ := c.GetSettings()
			if settings != nil && settings.LockOnMinimize {
				c.Lock()
				runtime.EventsEmit(a.ctx, "app:locked")
			}
		}
	}

	a.lastMinimized = isMinimized
}

// ============ 委托给 core 的安全相关方法 ============

func (a *App) IsFirstRun() (bool, error) {
	c, err := a.coreOrErr()
	if err != nil {
		return false, err
	}
	return c.IsFirstRun()
}

func (a *App) SetupPassword(password, hint, displayKey string) (*core.SetupResult, error) {
	c, err := a.coreOrErr()
	if err != nil {
		return nil, err
	}
	return c.SetupPassword(password, hint, displayKey)
}

func (a *App) VerifyDataKey(displayKey string) (bool, error) {
	c, err := a.coreOrErr()
	if err != nil {
		return false, err
	}
	return c.VerifyDataKey(displayKey)
}

func (a *App) Unlock(password string) (bool, error) {
	c, err := a.coreOrErr()
	if err != nil {
		return false, err
	}
	return c.Unlock(password)
}

func (a *App) Lock() {
	if c := a.getCoreIfReady(); c != nil {
		c.Lock()
	}
}

func (a *App) IsUnlocked() bool {
	if c := a.getCoreIfReady(); c != nil {
		return c.IsUnlocked()
	}
	return false
}

func (a *App) GetPasswordHint() (string, error) {
	c, err := a.coreOrErr()
	if err != nil {
		return "", err
	}
	return c.GetPasswordHint()
}

func (a *App) ChangePassword(oldPassword, newPassword, newHint string) error {
	c, err := a.coreOrErr()
	if err != nil {
		return err
	}
	return c.ChangePassword(oldPassword, newPassword, newHint)
}

func (a *App) ResetPasswordWithDataKey(displayKey, newPassword, newHint string) error {
	c, err := a.coreOrErr()
	if err != nil {
		return err
	}
	return c.ResetPasswordWithDataKey(displayKey, newPassword, newHint)
}

func (a *App) UpdateActivity() {
	if c := a.getCoreIfReady(); c != nil {
		c.UpdateActivity()
	}
}

func (a *App) GenerateDataKey() (string, error) {
	c, err := a.coreOrErr()
	if err != nil {
		return "", err
	}
	return c.GenerateDataKey()
}

func (a *App) GetDataDir() string {
	if c := a.getCoreIfReady(); c != nil {
		return c.GetDataDir()
	}
	return ""
}

func (a *App) GetVersion() string {
	return "v1.1.0"
}
