//  https://github.com/JackyZhang8/locknote
//  一个简单、可靠、离线优先的桌面加密笔记软件。
//  A simple, reliable, offline-first encrypted note-taking desktop app.

package main

import (
	"context"
	"errors"
	"fmt"
	"locknote/internal/crypto"
	"locknote/internal/database"
	"locknote/internal/notebooks"
	"locknote/internal/notes"
	"locknote/internal/smartviews"
	"locknote/internal/tags"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

const dataKeyVerifierPlaintext = "LOCKNOTE_DATAKEY_VERIFY_V1"

type App struct {
	ctx               context.Context
	db                *database.DB
	cryptoService     *crypto.Service
	noteService       *notes.Service
	tagService        *tags.Service
	notebookService   *notebooks.Service
	smartViewService  *smartviews.Service
	dataDir           string
	isUnlocked        bool
	dataKey           []byte
	mu                sync.RWMutex
	lastActivity      time.Time
	lockTimer         *time.Timer
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
		dataDir:      dataDir,
		lastActivity: time.Now(),
	}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.watcherStop = make(chan struct{})
	os.MkdirAll(a.dataDir, 0700)
	os.MkdirAll(filepath.Join(a.dataDir, "notes"), 0700)
	os.MkdirAll(filepath.Join(a.dataDir, "attachments"), 0700)
	os.MkdirAll(filepath.Join(a.dataDir, "history"), 0700)

	legacyDBPath := filepath.Join(a.dataDir, "notebase.db")
	dbPath := filepath.Join(a.dataDir, "locknote.db")
	if _, err := os.Stat(legacyDBPath); err == nil {
		if _, err := os.Stat(dbPath); os.IsNotExist(err) {
			_ = os.Rename(legacyDBPath, dbPath)
		}
	}

	db, err := database.New(dbPath)
	if err != nil {
		panic(err)
	}
	a.db = db
	a.cryptoService = crypto.NewService()
	a.noteService = notes.NewService(db, a.dataDir)
	a.tagService = tags.NewService(db)
	a.notebookService = notebooks.NewService(db)
	a.smartViewService = smartviews.NewService(db)

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
	a.Lock()
	if a.db != nil {
		a.db.Close()
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
		a.mu.RLock()
		unlocked := a.isUnlocked
		a.mu.RUnlock()

		if unlocked {
			settings, _ := a.db.GetSettings()
			if settings != nil && settings.LockOnMinimize {
				a.Lock()
				runtime.EventsEmit(a.ctx, "app:locked")
			}
		}
	}

	a.lastMinimized = isMinimized
}

func (a *App) IsFirstRun() bool {
	return !a.db.HasMasterPassword()
}

func (a *App) dataKeyVerifierFilePath() string {
	return filepath.Join(a.dataDir, "data_key_verifier")
}

func (a *App) writeDataKeyVerifierFile(dataKey []byte) error {
	ciphertext, err := a.cryptoService.Encrypt(dataKey, []byte(dataKeyVerifierPlaintext))
	if err != nil {
		return err
	}
	return os.WriteFile(a.dataKeyVerifierFilePath(), ciphertext, 0600)
}

func (a *App) verifyDataKeyWithFile(dataKey []byte) (bool, error) {
	ciphertext, err := os.ReadFile(a.dataKeyVerifierFilePath())
	if err != nil {
		if os.IsNotExist(err) {
			return false, fmt.Errorf("verification file missing")
		}
		return false, err
	}

	plaintext, err := a.cryptoService.Decrypt(dataKey, ciphertext)
	if err != nil {
		return false, nil
	}
	return string(plaintext) == dataKeyVerifierPlaintext, nil
}

func (a *App) SetupPassword(password, hint string) (*SetupResult, error) {
	a.mu.Lock()
	defer a.mu.Unlock()

	salt, err := a.cryptoService.GenerateSalt()
	if err != nil {
		return nil, err
	}

	passwordKey := a.cryptoService.DeriveKey(password, salt)

	dataKey, err := a.cryptoService.GenerateDataKey()
	if err != nil {
		return nil, err
	}

	encryptedDataKey, err := a.cryptoService.Encrypt(passwordKey, dataKey)
	if err != nil {
		return nil, err
	}

	verifier, err := a.cryptoService.Encrypt(passwordKey, []byte("LOCKNOTE_VERIFY"))
	if err != nil {
		return nil, err
	}

	err = a.db.SaveMasterPassword(salt, verifier, hint, encryptedDataKey)
	if err != nil {
		return nil, err
	}
	if err := a.writeDataKeyVerifierFile(dataKey); err != nil {
		return nil, err
	}

	displayKey := a.cryptoService.FormatDataKeyForDisplay(dataKey)

	a.dataKey = dataKey
	a.isUnlocked = true
	a.noteService.SetMasterKey(dataKey)
	a.lastActivity = time.Now()
	a.startLockTimer()

	return &SetupResult{
		DataKey: displayKey,
	}, nil
}

type SetupResult struct {
	DataKey string `json:"dataKey"`
}

func (a *App) VerifyDataKey(displayKey string) (bool, error) {
	a.mu.Lock()
	defer a.mu.Unlock()

	dataKey, err := a.cryptoService.ParseDisplayKey(displayKey)
	if err != nil {
		return false, nil
	}
	ok, err := a.verifyDataKeyWithFile(dataKey)
	if err != nil {
		return false, err
	}
	return ok, nil
}

func (a *App) Unlock(password string) (bool, error) {
	a.mu.Lock()
	defer a.mu.Unlock()

	mp, err := a.db.GetMasterPassword()
	if err != nil {
		return false, err
	}

	passwordKey := a.cryptoService.DeriveKey(password, mp.Salt)

	_, err = a.cryptoService.Decrypt(passwordKey, mp.Verifier)
	if err != nil {
		return false, nil
	}

	dataKey, err := a.cryptoService.Decrypt(passwordKey, mp.EncryptedDataKey)
	if err != nil {
		return false, nil
	}

	a.dataKey = dataKey
	a.isUnlocked = true
	a.noteService.SetMasterKey(dataKey)
	a.lastActivity = time.Now()
	a.startLockTimer()

	return true, nil
}

func (a *App) Lock() {
	a.mu.Lock()
	defer a.mu.Unlock()

	a.isUnlocked = false
	if a.dataKey != nil {
		for i := range a.dataKey {
			a.dataKey[i] = 0
		}
		a.dataKey = nil
	}
	a.noteService.SetMasterKey(nil)
	if a.lockTimer != nil {
		a.lockTimer.Stop()
	}
}

func (a *App) IsUnlocked() bool {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.isUnlocked
}

func (a *App) GetPasswordHint() (string, error) {
	mp, err := a.db.GetMasterPassword()
	if err != nil {
		return "", err
	}
	return mp.Hint, nil
}

func (a *App) ChangePassword(oldPassword, newPassword, newHint string) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	mp, err := a.db.GetMasterPassword()
	if err != nil {
		return err
	}

	oldPasswordKey := a.cryptoService.DeriveKey(oldPassword, mp.Salt)
	_, err = a.cryptoService.Decrypt(oldPasswordKey, mp.Verifier)
	if err != nil {
		return errors.New("旧密码不正确")
	}

	dataKey, err := a.cryptoService.Decrypt(oldPasswordKey, mp.EncryptedDataKey)
	if err != nil {
		return err
	}

	newSalt, err := a.cryptoService.GenerateSalt()
	if err != nil {
		return err
	}

	newPasswordKey := a.cryptoService.DeriveKey(newPassword, newSalt)

	newEncryptedDataKey, err := a.cryptoService.Encrypt(newPasswordKey, dataKey)
	if err != nil {
		return err
	}

	newVerifier, err := a.cryptoService.Encrypt(newPasswordKey, []byte("LOCKNOTE_VERIFY"))
	if err != nil {
		return err
	}

	err = a.db.SaveMasterPassword(newSalt, newVerifier, newHint, newEncryptedDataKey)
	if err != nil {
		return err
	}

	a.dataKey = dataKey
	return nil
}

func (a *App) ResetPasswordWithDataKey(displayKey, newPassword, newHint string) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	dataKey, err := a.cryptoService.ParseDisplayKey(displayKey)
	if err != nil {
		return errors.New("密钥格式不正确")
	}

	ok, err := a.verifyDataKeyWithFile(dataKey)
	if err != nil {
		return err
	}
	if !ok {
		return errors.New("密钥不正确")
	}

	newSalt, err := a.cryptoService.GenerateSalt()
	if err != nil {
		return err
	}

	newPasswordKey := a.cryptoService.DeriveKey(newPassword, newSalt)

	newEncryptedDataKey, err := a.cryptoService.Encrypt(newPasswordKey, dataKey)
	if err != nil {
		return err
	}

	newVerifier, err := a.cryptoService.Encrypt(newPasswordKey, []byte("LOCKNOTE_VERIFY"))
	if err != nil {
		return err
	}

	err = a.db.SaveMasterPassword(newSalt, newVerifier, newHint, newEncryptedDataKey)
	if err != nil {
		return err
	}

	a.dataKey = dataKey
	a.isUnlocked = true
	a.noteService.SetMasterKey(dataKey)
	a.startLockTimer()

	return nil
}

func (a *App) UpdateActivity() {
	a.mu.Lock()
	a.lastActivity = time.Now()
	a.mu.Unlock()
	a.startLockTimer()
}

func (a *App) startLockTimer() {
	settings, _ := a.db.GetSettings()
	if settings == nil || settings.AutoLockMinutes <= 0 {
		return
	}

	if a.lockTimer != nil {
		a.lockTimer.Stop()
	}

	a.lockTimer = time.AfterFunc(time.Duration(settings.AutoLockMinutes)*time.Minute, func() {
		a.mu.RLock()
		elapsed := time.Since(a.lastActivity)
		unlocked := a.isUnlocked
		a.mu.RUnlock()

		if !unlocked {
			return
		}

		if elapsed >= time.Duration(settings.AutoLockMinutes)*time.Minute {
			a.Lock()
			if a.ctx != nil {
				runtime.EventsEmit(a.ctx, "app:locked")
			}
		} else {
			a.startLockTimer()
		}
	})
}

func (a *App) GetDataDir() string {
	return a.dataDir
}

func (a *App) GetVersion() string {
	return "v1.0.2"
}
