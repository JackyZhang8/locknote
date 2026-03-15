// Package mobile 提供给移动端（iOS/Android）调用的 Go 接口
// 使用 gomobile bind 生成对应平台的库
package mobile

import (
	"encoding/json"
	"locknote/internal/core"
	"locknote/internal/database"
	"locknote/internal/notes"
	"locknote/internal/tags"

	// 保持 gomobile 依赖，防止 go mod tidy 移除
	"golang.org/x/mobile/bind/seq"
)

// _keepGomobileDep 防止 go mod tidy 移除 golang.org/x/mobile 依赖
var _keepGomobileDep = seq.FinalizeRef

var coreInstance *core.Core

// Init 初始化 Core，传入数据目录路径
// 移动端应传入应用沙盒内的目录
func Init(dataDir string) error {
	if coreInstance != nil {
		return nil
	}
	c, err := core.New(dataDir)
	if err != nil {
		return err
	}
	coreInstance = c
	return nil
}

// Close 关闭 Core，释放资源
func Close() {
	if coreInstance != nil {
		coreInstance.Close()
		coreInstance = nil
	}
}

// ============ 安全相关 ============

// IsFirstRun 检查是否是首次运行
func IsFirstRun() bool {
	if coreInstance == nil {
		return true
	}
	return coreInstance.IsFirstRun()
}

// SetupPassword 初始化主密码，返回 JSON 格式的 SetupResult
func SetupPassword(password, hint, displayKey string) (string, error) {
	if coreInstance == nil {
		return "", errNotInitialized
	}
	result, err := coreInstance.SetupPassword(password, hint, displayKey)
	if err != nil {
		return "", err
	}
	data, err := json.Marshal(result)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// GenerateDataKey 生成一个新的恢复密钥
func GenerateDataKey() (string, error) {
	if coreInstance == nil {
		return "", errNotInitialized
	}
	return coreInstance.GenerateDataKey()
}

// VerifyDataKey 验证恢复密钥是否正确
func VerifyDataKey(displayKey string) (bool, error) {
	if coreInstance == nil {
		return false, errNotInitialized
	}
	return coreInstance.VerifyDataKey(displayKey)
}

// Unlock 使用密码解锁
func Unlock(password string) (bool, error) {
	if coreInstance == nil {
		return false, errNotInitialized
	}
	return coreInstance.Unlock(password)
}

// Lock 锁定应用
func Lock() {
	if coreInstance != nil {
		coreInstance.Lock()
	}
}

// IsUnlocked 检查是否已解锁
func IsUnlocked() bool {
	if coreInstance == nil {
		return false
	}
	return coreInstance.IsUnlocked()
}

// GetPasswordHint 获取密码提示
func GetPasswordHint() (string, error) {
	if coreInstance == nil {
		return "", errNotInitialized
	}
	return coreInstance.GetPasswordHint()
}

// ChangePassword 修改密码
func ChangePassword(oldPassword, newPassword, newHint string) error {
	if coreInstance == nil {
		return errNotInitialized
	}
	return coreInstance.ChangePassword(oldPassword, newPassword, newHint)
}

// ResetPasswordWithDataKey 使用恢复密钥重置密码
func ResetPasswordWithDataKey(displayKey, newPassword, newHint string) error {
	if coreInstance == nil {
		return errNotInitialized
	}
	return coreInstance.ResetPasswordWithDataKey(displayKey, newPassword, newHint)
}

// UpdateActivity 更新最后活动时间
func UpdateActivity() {
	if coreInstance != nil {
		coreInstance.UpdateActivity()
	}
}

// ============ 笔记相关 ============

// CreateNote 创建笔记，返回 JSON 格式的 Note
func CreateNote(title, content string) (string, error) {
	if coreInstance == nil {
		return "", errNotInitialized
	}
	note, err := coreInstance.Notes().Create(title, content)
	if err != nil {
		return "", err
	}
	return marshalNote(note)
}

// GetNote 获取笔记，返回 JSON 格式的 Note
func GetNote(id string) (string, error) {
	if coreInstance == nil {
		return "", errNotInitialized
	}
	note, err := coreInstance.Notes().Get(id)
	if err != nil {
		return "", err
	}
	return marshalNote(note)
}

// UpdateNote 更新笔记，返回 JSON 格式的 Note
func UpdateNote(id, title, content string) (string, error) {
	if coreInstance == nil {
		return "", errNotInitialized
	}
	note, err := coreInstance.Notes().Update(id, title, content)
	if err != nil {
		return "", err
	}
	return marshalNote(note)
}

// ListNotes 列出所有笔记，返回 JSON 格式的 Note 数组
func ListNotes() (string, error) {
	if coreInstance == nil {
		return "", errNotInitialized
	}
	notesList, err := coreInstance.Notes().List()
	if err != nil {
		return "", err
	}
	return marshalNotes(notesList)
}

// ListDeletedNotes 列出回收站中的笔记
func ListDeletedNotes() (string, error) {
	if coreInstance == nil {
		return "", errNotInitialized
	}
	notesList, err := coreInstance.Notes().ListDeleted()
	if err != nil {
		return "", err
	}
	return marshalNotes(notesList)
}

// SoftDeleteNote 软删除笔记（移到回收站）
func SoftDeleteNote(id string) error {
	if coreInstance == nil {
		return errNotInitialized
	}
	return coreInstance.Notes().SoftDelete(id)
}

// RestoreNote 从回收站恢复笔记
func RestoreNote(id string) error {
	if coreInstance == nil {
		return errNotInitialized
	}
	return coreInstance.Notes().Restore(id)
}

// DeleteNote 永久删除笔记
func DeleteNote(id string) error {
	if coreInstance == nil {
		return errNotInitialized
	}
	return coreInstance.Notes().Delete(id)
}

// SetNotePinned 设置笔记置顶状态
func SetNotePinned(id string, pinned bool) error {
	if coreInstance == nil {
		return errNotInitialized
	}
	return coreInstance.Notes().SetPinned(id, pinned)
}

// GetNoteHistory 获取笔记历史版本
func GetNoteHistory(noteID string) (string, error) {
	if coreInstance == nil {
		return "", errNotInitialized
	}
	history, err := coreInstance.Notes().GetHistory(noteID)
	if err != nil {
		return "", err
	}
	return marshalNotes(history)
}

// RestoreNoteFromHistory 从历史版本恢复笔记
func RestoreNoteFromHistory(noteID, historyID string) (string, error) {
	if coreInstance == nil {
		return "", errNotInitialized
	}
	note, err := coreInstance.Notes().RestoreFromHistory(noteID, historyID)
	if err != nil {
		return "", err
	}
	return marshalNote(note)
}

// SetNoteNotebook 设置笔记所属笔记本
func SetNoteNotebook(noteID string, notebookID string) error {
	if coreInstance == nil {
		return errNotInitialized
	}
	var nbID *string
	if notebookID != "" {
		nbID = &notebookID
	}
	return coreInstance.Notes().SetNotebook(noteID, nbID)
}

// ============ 标签相关 ============

// CreateTag 创建标签，返回 JSON 格式的 Tag
func CreateTag(name, color string) (string, error) {
	if coreInstance == nil {
		return "", errNotInitialized
	}
	tag, err := coreInstance.Tags().Create(name, color)
	if err != nil {
		return "", err
	}
	return marshalTag(tag)
}

// UpdateTag 更新标签
func UpdateTag(id, name, color string) (string, error) {
	if coreInstance == nil {
		return "", errNotInitialized
	}
	tag, err := coreInstance.Tags().Update(id, name, color)
	if err != nil {
		return "", err
	}
	return marshalTag(tag)
}

// DeleteTag 删除标签
func DeleteTag(id string) error {
	if coreInstance == nil {
		return errNotInitialized
	}
	return coreInstance.Tags().Delete(id)
}

// ListTags 列出所有标签
func ListTags() (string, error) {
	if coreInstance == nil {
		return "", errNotInitialized
	}
	tagsList, err := coreInstance.Tags().List()
	if err != nil {
		return "", err
	}
	return marshalTags(tagsList)
}

// AddTagToNote 给笔记添加标签
func AddTagToNote(noteID, tagID string) error {
	if coreInstance == nil {
		return errNotInitialized
	}
	return coreInstance.Tags().AddToNote(noteID, tagID)
}

// RemoveTagFromNote 从笔记移除标签
func RemoveTagFromNote(noteID, tagID string) error {
	if coreInstance == nil {
		return errNotInitialized
	}
	return coreInstance.Tags().RemoveFromNote(noteID, tagID)
}

// ============ 笔记本相关 ============

// CreateNotebook 创建笔记本
func CreateNotebook(name, icon string) (string, error) {
	if coreInstance == nil {
		return "", errNotInitialized
	}
	notebook, err := coreInstance.Notebooks().Create(name, icon)
	if err != nil {
		return "", err
	}
	data, err := json.Marshal(notebook)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// ListNotebooks 列出所有笔记本
func ListNotebooks() (string, error) {
	if coreInstance == nil {
		return "", errNotInitialized
	}
	notebooks, err := coreInstance.Notebooks().List()
	if err != nil {
		return "", err
	}
	data, err := json.Marshal(notebooks)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// DeleteNotebook 删除笔记本
func DeleteNotebook(id string) error {
	if coreInstance == nil {
		return errNotInitialized
	}
	return coreInstance.Notebooks().Delete(id)
}

// UpdateNotebook 更新笔记本
func UpdateNotebook(id, name, icon string) (string, error) {
	if coreInstance == nil {
		return "", errNotInitialized
	}
	notebook, err := coreInstance.Notebooks().Update(id, name, icon)
	if err != nil {
		return "", err
	}
	data, err := json.Marshal(notebook)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// SetNotebookPinned 设置笔记本置顶状态
func SetNotebookPinned(id string, pinned bool) error {
	if coreInstance == nil {
		return errNotInitialized
	}
	return coreInstance.Notebooks().SetPinned(id, pinned)
}

// ============ 备份相关 ============

// CreateBackup 创建备份到指定路径
func CreateBackup(outputPath string) error {
	if coreInstance == nil {
		return errNotInitialized
	}
	return coreInstance.Backup().CreateBackup(outputPath)
}

// RestoreBackup 从备份恢复
func RestoreBackup(inputPath string) error {
	if coreInstance == nil {
		return errNotInitialized
	}
	return coreInstance.Backup().RestoreBackup(inputPath)
}

// ImportFromBackup 从备份导入笔记（使用恢复密钥）
func ImportFromBackup(backupPath, displayKey string) (int, error) {
	if coreInstance == nil {
		return 0, errNotInitialized
	}
	return coreInstance.Notes().ImportFromBackup(backupPath, displayKey)
}

// ============ 设置相关 ============

// GetSettings 获取设置，返回 JSON 格式
func GetSettings() (string, error) {
	if coreInstance == nil {
		return "", errNotInitialized
	}
	settings, err := coreInstance.GetSettings()
	if err != nil {
		return "", err
	}
	data, err := json.Marshal(settings)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// UpdateSettings 更新设置
func UpdateSettings(autoLockMinutes int, lockOnMinimize, lockOnSleep bool) error {
	if coreInstance == nil {
		return errNotInitialized
	}
	settings := &database.Settings{
		AutoLockMinutes: autoLockMinutes,
		LockOnMinimize:  lockOnMinimize,
		LockOnSleep:     lockOnSleep,
	}
	return coreInstance.UpdateSettings(settings)
}

// ============ 辅助函数 ============

var errNotInitialized = &NotInitializedError{}

type NotInitializedError struct{}

func (e *NotInitializedError) Error() string {
	return "core not initialized, call Init first"
}

func marshalNote(note *notes.Note) (string, error) {
	data, err := json.Marshal(note)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func marshalNotes(notesList []*notes.Note) (string, error) {
	data, err := json.Marshal(notesList)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func marshalTag(tag *tags.Tag) (string, error) {
	data, err := json.Marshal(tag)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func marshalTags(tagsList []*tags.Tag) (string, error) {
	data, err := json.Marshal(tagsList)
	if err != nil {
		return "", err
	}
	return string(data), nil
}
