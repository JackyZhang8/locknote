// https://github.com/JackyZhang8/locknote
// 一个简单、可靠、离线优先的桌面加密笔记软件。
// A simple, reliable, offline-first encrypted note-taking desktop app.
// core 包提供与平台无关的核心业务逻辑，可被桌面端和移动端复用。
package core

import (
	"errors"
	"fmt"
	"locknote/internal/backup"
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
)

const dataKeyVerifierPlaintext = "LOCKNOTE_DATAKEY_VERIFY_V1"

// LockCallback 是锁定时的回调函数类型，用于通知上层（如桌面端发送事件）
type LockCallback func()

// Core 是 LockNote 的核心业务逻辑层，与平台无关
type Core struct {
	db               *database.DB
	cryptoService    *crypto.Service
	noteService      *notes.Service
	tagService       *tags.Service
	notebookService  *notebooks.Service
	smartViewService *smartviews.Service
	backupService    *backup.Service
	dataDir          string

	isUnlocked   bool
	dataKey      []byte
	mu           sync.RWMutex
	lastActivity time.Time
	lockTimer    *time.Timer
	lockCallback LockCallback
}

// SetupResult 是初始化密码后的返回结果
type SetupResult struct {
	DataKey string `json:"dataKey"`
}

// New 创建一个新的 Core 实例
// dataDir: 数据目录路径（由上层根据平台决定）
func New(dataDir string) (*Core, error) {
	// 确保目录存在
	if err := os.MkdirAll(dataDir, 0700); err != nil {
		return nil, fmt.Errorf("failed to create data dir: %w", err)
	}
	if err := os.MkdirAll(filepath.Join(dataDir, "notes"), 0700); err != nil {
		return nil, fmt.Errorf("failed to create notes dir: %w", err)
	}
	if err := os.MkdirAll(filepath.Join(dataDir, "attachments"), 0700); err != nil {
		return nil, fmt.Errorf("failed to create attachments dir: %w", err)
	}
	if err := os.MkdirAll(filepath.Join(dataDir, "history"), 0700); err != nil {
		return nil, fmt.Errorf("failed to create history dir: %w", err)
	}

	// 处理旧版数据库迁移
	legacyDBPath := filepath.Join(dataDir, "notebase.db")
	dbPath := filepath.Join(dataDir, "locknote.db")
	if _, err := os.Stat(legacyDBPath); err == nil {
		if _, err := os.Stat(dbPath); os.IsNotExist(err) {
			_ = os.Rename(legacyDBPath, dbPath)
		}
	}

	db, err := database.New(dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	c := &Core{
		db:               db,
		cryptoService:    crypto.NewService(),
		noteService:      notes.NewService(db, dataDir),
		tagService:       tags.NewService(db),
		notebookService:  notebooks.NewService(db),
		smartViewService: smartviews.NewService(db),
		backupService:    backup.NewService(dataDir),
		dataDir:          dataDir,
		lastActivity:     time.Now(),
	}

	return c, nil
}

// Close 关闭 Core，释放资源
func (c *Core) Close() {
	c.Lock()
	if c.db != nil {
		c.db.Close()
	}
}

// SetLockCallback 设置锁定时的回调函数
func (c *Core) SetLockCallback(cb LockCallback) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.lockCallback = cb
}

// GetDataDir 返回数据目录路径
func (c *Core) GetDataDir() string {
	return c.dataDir
}

// ============ 安全与解锁相关 ============

// IsFirstRun 检查是否是首次运行（未设置主密码）
func (c *Core) IsFirstRun() bool {
	return !c.db.HasMasterPassword()
}

func (c *Core) dataKeyVerifierFilePath() string {
	return filepath.Join(c.dataDir, "data_key_verifier")
}

func (c *Core) writeDataKeyVerifierFile(dataKey []byte) error {
	ciphertext, err := c.cryptoService.Encrypt(dataKey, []byte(dataKeyVerifierPlaintext))
	if err != nil {
		return err
	}
	return os.WriteFile(c.dataKeyVerifierFilePath(), ciphertext, 0600)
}

func (c *Core) verifyDataKeyWithFile(dataKey []byte) (bool, error) {
	ciphertext, err := os.ReadFile(c.dataKeyVerifierFilePath())
	if err != nil {
		if os.IsNotExist(err) {
			return false, fmt.Errorf("verification file missing")
		}
		return false, err
	}

	plaintext, err := c.cryptoService.Decrypt(dataKey, ciphertext)
	if err != nil {
		return false, nil
	}
	return string(plaintext) == dataKeyVerifierPlaintext, nil
}

// SetupPassword 初始化主密码（首次运行时调用）
func (c *Core) SetupPassword(password, hint, displayKey string) (*SetupResult, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	salt, err := c.cryptoService.GenerateSalt()
	if err != nil {
		return nil, err
	}

	passwordKey := c.cryptoService.DeriveKey(password, salt)
	dataKey := c.cryptoService.DeriveDataKey(displayKey)

	encryptedDataKey, err := c.cryptoService.Encrypt(passwordKey, dataKey)
	if err != nil {
		return nil, err
	}

	verifier, err := c.cryptoService.Encrypt(passwordKey, []byte("LOCKNOTE_VERIFY"))
	if err != nil {
		return nil, err
	}

	err = c.db.SaveMasterPassword(salt, verifier, hint, encryptedDataKey)
	if err != nil {
		return nil, err
	}
	if err := c.writeDataKeyVerifierFile(dataKey); err != nil {
		return nil, err
	}

	c.dataKey = dataKey
	c.isUnlocked = true
	c.noteService.SetMasterKey(dataKey)
	c.lastActivity = time.Now()
	c.startLockTimer()

	return &SetupResult{
		DataKey: displayKey,
	}, nil
}

// VerifyDataKey 验证恢复密钥是否正确
func (c *Core) VerifyDataKey(displayKey string) (bool, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	dataKey, err := c.cryptoService.ParseDisplayKey(displayKey)
	if err != nil {
		return false, nil
	}
	ok, err := c.verifyDataKeyWithFile(dataKey)
	if err != nil {
		return false, err
	}
	return ok, nil
}

// Unlock 使用密码解锁
func (c *Core) Unlock(password string) (bool, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	mp, err := c.db.GetMasterPassword()
	if err != nil {
		return false, err
	}

	passwordKey := c.cryptoService.DeriveKey(password, mp.Salt)

	_, err = c.cryptoService.Decrypt(passwordKey, mp.Verifier)
	if err != nil {
		return false, nil
	}

	dataKey, err := c.cryptoService.Decrypt(passwordKey, mp.EncryptedDataKey)
	if err != nil {
		return false, nil
	}

	c.dataKey = dataKey
	c.isUnlocked = true
	c.noteService.SetMasterKey(dataKey)
	c.lastActivity = time.Now()
	c.startLockTimer()

	return true, nil
}

// Lock 锁定应用，清除内存中的密钥
func (c *Core) Lock() {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.isUnlocked = false
	if c.dataKey != nil {
		for i := range c.dataKey {
			c.dataKey[i] = 0
		}
		c.dataKey = nil
	}
	c.noteService.SetMasterKey(nil)
	if c.lockTimer != nil {
		c.lockTimer.Stop()
	}
}

// IsUnlocked 检查是否已解锁
func (c *Core) IsUnlocked() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.isUnlocked
}

// GetPasswordHint 获取密码提示
func (c *Core) GetPasswordHint() (string, error) {
	mp, err := c.db.GetMasterPassword()
	if err != nil {
		return "", err
	}
	return mp.Hint, nil
}

// ChangePassword 修改密码（需要旧密码）
func (c *Core) ChangePassword(oldPassword, newPassword, newHint string) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	mp, err := c.db.GetMasterPassword()
	if err != nil {
		return err
	}

	oldPasswordKey := c.cryptoService.DeriveKey(oldPassword, mp.Salt)
	_, err = c.cryptoService.Decrypt(oldPasswordKey, mp.Verifier)
	if err != nil {
		return errors.New("旧密码不正确")
	}

	dataKey, err := c.cryptoService.Decrypt(oldPasswordKey, mp.EncryptedDataKey)
	if err != nil {
		return err
	}

	newSalt, err := c.cryptoService.GenerateSalt()
	if err != nil {
		return err
	}

	newPasswordKey := c.cryptoService.DeriveKey(newPassword, newSalt)

	newEncryptedDataKey, err := c.cryptoService.Encrypt(newPasswordKey, dataKey)
	if err != nil {
		return err
	}

	newVerifier, err := c.cryptoService.Encrypt(newPasswordKey, []byte("LOCKNOTE_VERIFY"))
	if err != nil {
		return err
	}

	err = c.db.SaveMasterPassword(newSalt, newVerifier, newHint, newEncryptedDataKey)
	if err != nil {
		return err
	}

	c.dataKey = dataKey
	return nil
}

// ResetPasswordWithDataKey 使用恢复密钥重置密码
func (c *Core) ResetPasswordWithDataKey(displayKey, newPassword, newHint string) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	dataKey, err := c.cryptoService.ParseDisplayKey(displayKey)
	if err != nil {
		return errors.New("密钥格式不正确")
	}

	ok, err := c.verifyDataKeyWithFile(dataKey)
	if err != nil {
		return err
	}
	if !ok {
		return errors.New("密钥不正确")
	}

	newSalt, err := c.cryptoService.GenerateSalt()
	if err != nil {
		return err
	}

	newPasswordKey := c.cryptoService.DeriveKey(newPassword, newSalt)

	newEncryptedDataKey, err := c.cryptoService.Encrypt(newPasswordKey, dataKey)
	if err != nil {
		return err
	}

	newVerifier, err := c.cryptoService.Encrypt(newPasswordKey, []byte("LOCKNOTE_VERIFY"))
	if err != nil {
		return err
	}

	err = c.db.SaveMasterPassword(newSalt, newVerifier, newHint, newEncryptedDataKey)
	if err != nil {
		return err
	}

	c.dataKey = dataKey
	c.isUnlocked = true
	c.noteService.SetMasterKey(dataKey)
	c.startLockTimer()

	return nil
}

// UpdateActivity 更新最后活动时间（用于自动锁定计时）
func (c *Core) UpdateActivity() {
	c.mu.Lock()
	c.lastActivity = time.Now()
	c.mu.Unlock()
	c.startLockTimer()
}

func (c *Core) startLockTimer() {
	settings, _ := c.db.GetSettings()
	if settings == nil || settings.AutoLockMinutes <= 0 {
		return
	}

	if c.lockTimer != nil {
		c.lockTimer.Stop()
	}

	c.lockTimer = time.AfterFunc(time.Duration(settings.AutoLockMinutes)*time.Minute, func() {
		c.mu.RLock()
		elapsed := time.Since(c.lastActivity)
		unlocked := c.isUnlocked
		cb := c.lockCallback
		c.mu.RUnlock()

		if !unlocked {
			return
		}

		if elapsed >= time.Duration(settings.AutoLockMinutes)*time.Minute {
			c.Lock()
			if cb != nil {
				cb()
			}
		} else {
			c.startLockTimer()
		}
	})
}

// GenerateDataKey 生成一个新的恢复密钥（用于首次设置时）
func (c *Core) GenerateDataKey() (string, error) {
	return c.cryptoService.GenerateDataKey()
}

// ============ 笔记相关（代理到 noteService）============

// Notes 返回笔记服务（供上层直接调用笔记相关方法）
func (c *Core) Notes() *notes.Service {
	return c.noteService
}

// ============ 标签相关（代理到 tagService）============

// Tags 返回标签服务
func (c *Core) Tags() *tags.Service {
	return c.tagService
}

// ============ 笔记本相关（代理到 notebookService）============

// Notebooks 返回笔记本服务
func (c *Core) Notebooks() *notebooks.Service {
	return c.notebookService
}

// ============ 智能视图相关（代理到 smartViewService）============

// SmartViews 返回智能视图服务
func (c *Core) SmartViews() *smartviews.Service {
	return c.smartViewService
}

// ============ 备份相关（代理到 backupService）============

// Backup 返回备份服务
func (c *Core) Backup() *backup.Service {
	return c.backupService
}

// ============ 设置相关 ============

// GetSettings 获取设置
func (c *Core) GetSettings() (*database.Settings, error) {
	return c.db.GetSettings()
}

// UpdateSettings 更新设置
func (c *Core) UpdateSettings(s *database.Settings) error {
	return c.db.UpdateSettings(s)
}
