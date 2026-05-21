// Package mobile 提供给移动端（iOS/Android）调用的 Go 接口
// 使用 gomobile bind 生成对应平台的库
package mobile

import (
	"encoding/json"
	"fmt"
	"locknote/internal/core"
	"locknote/internal/database"
	"locknote/internal/notes"
	"locknote/internal/tags"
	"locknote/internal/todos"
	"sync"
	"time"

	// 保持 gomobile 依赖，防止 go mod tidy 移除
	"golang.org/x/mobile/bind/seq"
)

// _keepGomobileDep 防止 go mod tidy 移除 golang.org/x/mobile 依赖
var _keepGomobileDep = seq.FinalizeRef

var coreInstance *core.Core
var mobileMu sync.RWMutex

func mobileCall[T any](operation string, zero T, fn func() (T, error)) (value T, err error) {
	value = zero
	mobileMu.Lock()
	defer mobileMu.Unlock()
	defer func() {
		if recovered := recover(); recovered != nil {
			value = zero
			err = fmt.Errorf("%s panic: %v", operation, recovered)
		}
	}()
	return fn()
}

func mobileCallRead[T any](operation string, zero T, fn func() (T, error)) (value T, err error) {
	value = zero
	mobileMu.RLock()
	defer mobileMu.RUnlock()
	defer func() {
		if recovered := recover(); recovered != nil {
			value = zero
			err = fmt.Errorf("%s panic: %v", operation, recovered)
		}
	}()
	return fn()
}

func mobileCallError(operation string, fn func() error) (err error) {
	mobileMu.Lock()
	defer mobileMu.Unlock()
	defer func() {
		if recovered := recover(); recovered != nil {
			err = fmt.Errorf("%s panic: %v", operation, recovered)
		}
	}()
	return fn()
}

func mobileCallValue[T any](operation string, fallback T, fn func() T) (value T) {
	value = fallback
	mobileMu.RLock()
	defer mobileMu.RUnlock()
	defer func() {
		if recovered := recover(); recovered != nil {
			fmt.Printf("locknote mobile %s panic: %v\n", operation, recovered)
			value = fallback
		}
	}()
	return fn()
}

func mobileCallVoid(operation string, fn func()) {
	mobileMu.Lock()
	defer mobileMu.Unlock()
	defer func() {
		if recovered := recover(); recovered != nil {
			fmt.Printf("locknote mobile %s panic: %v\n", operation, recovered)
			// No error channel exists for these gomobile void APIs.
		}
	}()
	fn()
}

// Init 初始化 Core，传入数据目录路径
// 移动端应传入应用沙盒内的目录
func Init(dataDir string) error {
	return mobileCallError("Init", func() error {
		if coreInstance != nil {
			return nil
		}
		c, err := core.New(dataDir)
		if err != nil {
			return err
		}
		coreInstance = c
		return nil
	})
}

// Close 关闭 Core，释放资源
func Close() {
	mobileCallVoid("Close", func() {
		if coreInstance != nil {
			coreInstance.Close()
			coreInstance = nil
		}
	})
}

// ============ 安全相关 ============

// IsFirstRun 检查是否是首次运行
func IsFirstRun() bool {
	return mobileCallValue("IsFirstRun", true, func() bool {
		if coreInstance == nil {
			return true
		}
		return coreInstance.IsFirstRun()
	})
}

// SetupPassword 初始化主密码，返回 JSON 格式的 SetupResult
func SetupPassword(password, hint, displayKey string) (string, error) {
	return mobileCall("SetupPassword", "", func() (string, error) {
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
	})
}

// GenerateDataKey 生成一个新的恢复密钥
func GenerateDataKey() (string, error) {
	return mobileCall("GenerateDataKey", "", func() (string, error) {
		if coreInstance == nil {
			return "", errNotInitialized
		}
		return coreInstance.GenerateDataKey()
	})
}

// VerifyDataKey 验证恢复密钥是否正确
func VerifyDataKey(displayKey string) (bool, error) {
	return mobileCallRead("VerifyDataKey", false, func() (bool, error) {
		if coreInstance == nil {
			return false, errNotInitialized
		}
		return coreInstance.VerifyDataKey(displayKey)
	})
}

// Unlock 使用密码解锁
func Unlock(password string) (bool, error) {
	return mobileCall("Unlock", false, func() (bool, error) {
		if coreInstance == nil {
			return false, errNotInitialized
		}
		return coreInstance.Unlock(password)
	})
}

// Lock 锁定应用
func Lock() {
	mobileCallVoid("Lock", func() {
		if coreInstance != nil {
			coreInstance.Lock()
		}
	})
}

// IsUnlocked 检查是否已解锁
func IsUnlocked() bool {
	return mobileCallValue("IsUnlocked", false, func() bool {
		if coreInstance == nil {
			return false
		}
		return coreInstance.IsUnlocked()
	})
}

// GetPasswordHint 获取密码提示
func GetPasswordHint() (string, error) {
	return mobileCallRead("GetPasswordHint", "", func() (string, error) {
		if coreInstance == nil {
			return "", errNotInitialized
		}
		return coreInstance.GetPasswordHint()
	})
}

// ChangePassword 修改密码
func ChangePassword(oldPassword, newPassword, newHint string) error {
	return mobileCallError("ChangePassword", func() error {
		if coreInstance == nil {
			return errNotInitialized
		}
		return coreInstance.ChangePassword(oldPassword, newPassword, newHint)
	})
}

// ResetPasswordWithDataKey 使用恢复密钥重置密码
func ResetPasswordWithDataKey(displayKey, newPassword, newHint string) error {
	return mobileCallError("ResetPasswordWithDataKey", func() error {
		if coreInstance == nil {
			return errNotInitialized
		}
		return coreInstance.ResetPasswordWithDataKey(displayKey, newPassword, newHint)
	})
}

// UpdateActivity 更新最后活动时间
func UpdateActivity() {
	mobileCallVoid("UpdateActivity", func() {
		if coreInstance != nil {
			coreInstance.UpdateActivity()
		}
	})
}

// ============ 笔记相关 ============

// CreateNote 创建笔记，返回 JSON 格式的 Note
func CreateNote(title, content string) (string, error) {
	return mobileCall("CreateNote", "", func() (string, error) {
		if coreInstance == nil {
			return "", errNotInitialized
		}
		note, err := coreInstance.Notes().Create(title, content)
		if err != nil {
			return "", err
		}
		return marshalNote(note)
	})
}

// GetNote 获取笔记，返回 JSON 格式的 Note
func GetNote(id string) (string, error) {
	return mobileCallRead("GetNote", "", func() (string, error) {
		if coreInstance == nil {
			return "", errNotInitialized
		}
		note, err := coreInstance.Notes().Get(id)
		if err != nil {
			return "", err
		}
		return marshalNote(note)
	})
}

// UpdateNote 更新笔记，返回 JSON 格式的 Note
func UpdateNote(id, title, content string) (string, error) {
	return mobileCall("UpdateNote", "", func() (string, error) {
		if coreInstance == nil {
			return "", errNotInitialized
		}
		note, err := coreInstance.Notes().Update(id, title, content)
		if err != nil {
			return "", err
		}
		return marshalNote(note)
	})
}

// ListNotes 列出所有笔记，返回 JSON 格式的 Note 数组
func ListNotes() (string, error) {
	return mobileCallRead("ListNotes", "", func() (string, error) {
		if coreInstance == nil {
			return "", errNotInitialized
		}
		notesList, err := coreInstance.Notes().List()
		if err != nil {
			return "", err
		}
		return marshalNotes(notesList)
	})
}

// ListDeletedNotes 列出回收站中的笔记
func ListDeletedNotes() (string, error) {
	return mobileCallRead("ListDeletedNotes", "", func() (string, error) {
		if coreInstance == nil {
			return "", errNotInitialized
		}
		notesList, err := coreInstance.Notes().ListDeleted()
		if err != nil {
			return "", err
		}
		return marshalNotes(notesList)
	})
}

// SoftDeleteNote 软删除笔记（移到回收站）
func SoftDeleteNote(id string) error {
	return mobileCallError("SoftDeleteNote", func() error {
		if coreInstance == nil {
			return errNotInitialized
		}
		return coreInstance.Notes().SoftDelete(id)
	})
}

// RestoreNote 从回收站恢复笔记
func RestoreNote(id string) error {
	return mobileCallError("RestoreNote", func() error {
		if coreInstance == nil {
			return errNotInitialized
		}
		return coreInstance.Notes().Restore(id)
	})
}

// DeleteNote 永久删除笔记
func DeleteNote(id string) error {
	return mobileCallError("DeleteNote", func() error {
		if coreInstance == nil {
			return errNotInitialized
		}
		return coreInstance.Notes().Delete(id)
	})
}

// SetNotePinned 设置笔记置顶状态
func SetNotePinned(id string, pinned bool) error {
	return mobileCallError("SetNotePinned", func() error {
		if coreInstance == nil {
			return errNotInitialized
		}
		return coreInstance.Notes().SetPinned(id, pinned)
	})
}

// GetNoteHistory 获取笔记历史版本
func GetNoteHistory(noteID string) (string, error) {
	return mobileCallRead("GetNoteHistory", "", func() (string, error) {
		if coreInstance == nil {
			return "", errNotInitialized
		}
		history, err := coreInstance.Notes().GetHistory(noteID)
		if err != nil {
			return "", err
		}
		return marshalNotes(history)
	})
}

// RestoreNoteFromHistory 从历史版本恢复笔记
func RestoreNoteFromHistory(noteID, historyID string) (string, error) {
	return mobileCall("RestoreNoteFromHistory", "", func() (string, error) {
		if coreInstance == nil {
			return "", errNotInitialized
		}
		note, err := coreInstance.Notes().RestoreFromHistory(noteID, historyID)
		if err != nil {
			return "", err
		}
		return marshalNote(note)
	})
}

// SetNoteNotebook 设置笔记所属笔记本
func SetNoteNotebook(noteID string, notebookID string) error {
	return mobileCallError("SetNoteNotebook", func() error {
		if coreInstance == nil {
			return errNotInitialized
		}
		var nbID *string
		if notebookID != "" {
			nbID = &notebookID
		}
		return coreInstance.Notes().SetNotebook(noteID, nbID)
	})
}

// ============ 标签相关 ============

// CreateTag 创建标签，返回 JSON 格式的 Tag
func CreateTag(name, color string) (string, error) {
	return mobileCall("CreateTag", "", func() (string, error) {
		if coreInstance == nil {
			return "", errNotInitialized
		}
		tag, err := coreInstance.Tags().Create(name, color)
		if err != nil {
			return "", err
		}
		return marshalTag(tag)
	})
}

// UpdateTag 更新标签
func UpdateTag(id, name, color string) (string, error) {
	return mobileCall("UpdateTag", "", func() (string, error) {
		if coreInstance == nil {
			return "", errNotInitialized
		}
		tag, err := coreInstance.Tags().Update(id, name, color)
		if err != nil {
			return "", err
		}
		return marshalTag(tag)
	})
}

// DeleteTag 删除标签
func DeleteTag(id string) error {
	return mobileCallError("DeleteTag", func() error {
		if coreInstance == nil {
			return errNotInitialized
		}
		return coreInstance.Tags().Delete(id)
	})
}

// ListTags 列出所有标签
func ListTags() (string, error) {
	return mobileCallRead("ListTags", "", func() (string, error) {
		if coreInstance == nil {
			return "", errNotInitialized
		}
		tagsList, err := coreInstance.Tags().List()
		if err != nil {
			return "", err
		}
		return marshalTags(tagsList)
	})
}

// AddTagToNote 给笔记添加标签
func AddTagToNote(noteID, tagID string) error {
	return mobileCallError("AddTagToNote", func() error {
		if coreInstance == nil {
			return errNotInitialized
		}
		return coreInstance.Tags().AddToNote(noteID, tagID)
	})
}

// RemoveTagFromNote 从笔记移除标签
func RemoveTagFromNote(noteID, tagID string) error {
	return mobileCallError("RemoveTagFromNote", func() error {
		if coreInstance == nil {
			return errNotInitialized
		}
		return coreInstance.Tags().RemoveFromNote(noteID, tagID)
	})
}

// ============ 笔记本相关 ============

// CreateNotebook 创建笔记本
func CreateNotebook(name, icon string) (string, error) {
	return mobileCall("CreateNotebook", "", func() (string, error) {
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
	})
}

// ListNotebooks 列出所有笔记本
func ListNotebooks() (string, error) {
	return mobileCallRead("ListNotebooks", "", func() (string, error) {
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
	})
}

// DeleteNotebook 删除笔记本
func DeleteNotebook(id string) error {
	return mobileCallError("DeleteNotebook", func() error {
		if coreInstance == nil {
			return errNotInitialized
		}
		return coreInstance.Notebooks().Delete(id)
	})
}

// UpdateNotebook 更新笔记本
func UpdateNotebook(id, name, icon string) (string, error) {
	return mobileCall("UpdateNotebook", "", func() (string, error) {
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
	})
}

// SetNotebookPinned 设置笔记本置顶状态
func SetNotebookPinned(id string, pinned bool) error {
	return mobileCallError("SetNotebookPinned", func() error {
		if coreInstance == nil {
			return errNotInitialized
		}
		return coreInstance.Notebooks().SetPinned(id, pinned)
	})
}

// ============ 备份相关 ============

// CreateBackup 创建备份到指定路径
func CreateBackup(outputPath string) error {
	return mobileCallError("CreateBackup", func() error {
		if coreInstance == nil {
			return errNotInitialized
		}
		return coreInstance.Backup().CreateBackup(outputPath)
	})
}

// RestoreBackup 从备份恢复
func RestoreBackup(inputPath string) error {
	return mobileCallError("RestoreBackup", func() error {
		if coreInstance == nil {
			return errNotInitialized
		}
		return coreInstance.Backup().RestoreBackup(inputPath)
	})
}

// ImportFromBackup 从备份导入笔记（使用恢复密钥）
func ImportFromBackup(backupPath, displayKey string) (int, error) {
	return mobileCall("ImportFromBackup", 0, func() (int, error) {
		if coreInstance == nil {
			return 0, errNotInitialized
		}
		return coreInstance.Notes().ImportFromBackup(backupPath, displayKey)
	})
}

// ============ 待办相关 ============

// ListTodos 列出所有待办，返回 JSON 格式的 Todo 数组
func ListTodos() (string, error) {
	return mobileCallRead("ListTodos", "", func() (string, error) {
		if coreInstance == nil {
			return "", errNotInitialized
		}
		items, err := coreInstance.Todos().List()
		if err != nil {
			return "", err
		}
		return marshalTodos(items)
	})
}

// GetTodo 获取待办详情，返回 JSON 格式的 Todo
func GetTodo(id string) (string, error) {
	return mobileCallRead("GetTodo", "", func() (string, error) {
		if coreInstance == nil {
			return "", errNotInitialized
		}
		todo, err := coreInstance.Todos().Get(id)
		if err != nil {
			return "", err
		}
		return marshalTodo(todo)
	})
}

// CreateTodo 创建待办，返回 JSON 格式的 Todo
func CreateTodo(title, priority, dueAt string) (string, error) {
	return mobileCall("CreateTodo", "", func() (string, error) {
		if coreInstance == nil {
			return "", errNotInitialized
		}
		parsedDueAt, err := parseOptionalTodoDate(dueAt)
		if err != nil {
			return "", err
		}
		todo, err := coreInstance.Todos().Create(todos.CreateTodoInput{
			Title:    title,
			Priority: priority,
			DueAt:    parsedDueAt,
		})
		if err != nil {
			return "", err
		}
		return marshalTodo(todo)
	})
}

// UpdateTodo 更新待办，返回 JSON 格式的 Todo
func UpdateTodo(id, title, priority, dueAt string) (string, error) {
	return mobileCall("UpdateTodo", "", func() (string, error) {
		if coreInstance == nil {
			return "", errNotInitialized
		}
		parsedDueAt, err := parseOptionalTodoDate(dueAt)
		if err != nil {
			return "", err
		}
		todo, err := coreInstance.Todos().Update(todos.UpdateTodoInput{
			ID:       id,
			Title:    title,
			Priority: priority,
			DueAt:    parsedDueAt,
		})
		if err != nil {
			return "", err
		}
		return marshalTodo(todo)
	})
}

// SetTodoCompleted 设置待办完成状态，返回 JSON 格式的 Todo
func SetTodoCompleted(id string, completed bool) (string, error) {
	return mobileCall("SetTodoCompleted", "", func() (string, error) {
		if coreInstance == nil {
			return "", errNotInitialized
		}
		todo, err := coreInstance.Todos().SetCompleted(id, completed)
		if err != nil {
			return "", err
		}
		return marshalTodo(todo)
	})
}

// DeleteTodo 删除待办
func DeleteTodo(id string) error {
	return mobileCallError("DeleteTodo", func() error {
		if coreInstance == nil {
			return errNotInitialized
		}
		return coreInstance.Todos().Delete(id)
	})
}

// CreateTodoSubtask 创建待办子任务，返回 JSON 格式的 Subtask
func CreateTodoSubtask(todoID, title string) (string, error) {
	return mobileCall("CreateTodoSubtask", "", func() (string, error) {
		if coreInstance == nil {
			return "", errNotInitialized
		}
		subtask, err := coreInstance.Todos().CreateSubtask(todoID, title)
		if err != nil {
			return "", err
		}
		return marshalTodoSubtask(subtask)
	})
}

// UpdateTodoSubtask 更新待办子任务，返回 JSON 格式的 Subtask
func UpdateTodoSubtask(id, title string) (string, error) {
	return mobileCall("UpdateTodoSubtask", "", func() (string, error) {
		if coreInstance == nil {
			return "", errNotInitialized
		}
		subtask, err := coreInstance.Todos().UpdateSubtask(id, title)
		if err != nil {
			return "", err
		}
		return marshalTodoSubtask(subtask)
	})
}

// SetTodoSubtaskCompleted 设置待办子任务完成状态，返回 JSON 格式的 Subtask
func SetTodoSubtaskCompleted(id string, completed bool) (string, error) {
	return mobileCall("SetTodoSubtaskCompleted", "", func() (string, error) {
		if coreInstance == nil {
			return "", errNotInitialized
		}
		subtask, err := coreInstance.Todos().SetSubtaskCompleted(id, completed)
		if err != nil {
			return "", err
		}
		return marshalTodoSubtask(subtask)
	})
}

// DeleteTodoSubtask 删除待办子任务
func DeleteTodoSubtask(id string) error {
	return mobileCallError("DeleteTodoSubtask", func() error {
		if coreInstance == nil {
			return errNotInitialized
		}
		return coreInstance.Todos().DeleteSubtask(id)
	})
}

// ============ 图片附件相关 ============

// CreateImageFromDataURL 从 data URL 创建图片附件，返回 JSON 格式的 Attachment
func CreateImageFromDataURL(noteID, originalName, dataURL string) (string, error) {
	return mobileCall("CreateImageFromDataURL", "", func() (string, error) {
		if coreInstance == nil {
			return "", errNotInitialized
		}
		attachment, err := coreInstance.Attachments().CreateImageFromDataURL(noteID, originalName, dataURL)
		if err != nil {
			return "", err
		}
		data, err := json.Marshal(attachment)
		if err != nil {
			return "", err
		}
		return string(data), nil
	})
}

// GetAttachmentDataURL 获取图片附件 data URL
func GetAttachmentDataURL(id string) (string, error) {
	return mobileCallRead("GetAttachmentDataURL", "", func() (string, error) {
		if coreInstance == nil {
			return "", errNotInitialized
		}
		return coreInstance.Attachments().GetDataURL(id)
	})
}

// GetAttachmentThumbnailDataURL 获取图片附件缩略图 data URL
func GetAttachmentThumbnailDataURL(id string) (string, error) {
	return mobileCallRead("GetAttachmentThumbnailDataURL", "", func() (string, error) {
		if coreInstance == nil {
			return "", errNotInitialized
		}
		return coreInstance.Attachments().GetThumbnailDataURL(id)
	})
}

// ListAttachments 列出所有图片附件，返回 JSON 格式的 Attachment 数组
func ListAttachments() (string, error) {
	return mobileCallRead("ListAttachments", "", func() (string, error) {
		if coreInstance == nil {
			return "", errNotInitialized
		}
		items, err := coreInstance.Attachments().ListImages()
		if err != nil {
			return "", err
		}
		data, err := json.Marshal(items)
		if err != nil {
			return "", err
		}
		return string(data), nil
	})
}

// ListDeletedAttachments 列出回收站图片附件，返回 JSON 格式的 Attachment 数组
func ListDeletedAttachments() (string, error) {
	return mobileCallRead("ListDeletedAttachments", "", func() (string, error) {
		if coreInstance == nil {
			return "", errNotInitialized
		}
		items, err := coreInstance.Attachments().ListDeletedImages()
		if err != nil {
			return "", err
		}
		data, err := json.Marshal(items)
		if err != nil {
			return "", err
		}
		return string(data), nil
	})
}

// SoftDeleteAttachment 将图片附件移入回收站
func SoftDeleteAttachment(id string) error {
	return mobileCallError("SoftDeleteAttachment", func() error {
		if coreInstance == nil {
			return errNotInitialized
		}
		return coreInstance.Attachments().SoftDelete(id)
	})
}

// RestoreAttachment 从回收站恢复图片附件
func RestoreAttachment(id string) error {
	return mobileCallError("RestoreAttachment", func() error {
		if coreInstance == nil {
			return errNotInitialized
		}
		return coreInstance.Attachments().Restore(id)
	})
}

// DeleteAttachment 删除图片附件
func DeleteAttachment(id string) error {
	return mobileCallError("DeleteAttachment", func() error {
		if coreInstance == nil {
			return errNotInitialized
		}
		return coreInstance.Attachments().Delete(id)
	})
}

// SetAttachmentFavorite 设置图片附件收藏状态
func SetAttachmentFavorite(id string, favorite bool) error {
	return mobileCallError("SetAttachmentFavorite", func() error {
		if coreInstance == nil {
			return errNotInitialized
		}
		return coreInstance.Attachments().SetFavorite(id, favorite)
	})
}

// AttachAttachmentToNote 将图片附件关联到笔记
func AttachAttachmentToNote(noteID, attachmentID string) error {
	return mobileCallError("AttachAttachmentToNote", func() error {
		if coreInstance == nil {
			return errNotInitialized
		}
		return coreInstance.Attachments().AttachToNote(noteID, attachmentID)
	})
}

// DetachAttachmentFromNote 取消图片附件与笔记的关联
func DetachAttachmentFromNote(noteID, attachmentID string) error {
	return mobileCallError("DetachAttachmentFromNote", func() error {
		if coreInstance == nil {
			return errNotInitialized
		}
		return coreInstance.Attachments().DetachFromNote(noteID, attachmentID)
	})
}

// ============ 设置相关 ============

// GetSettings 获取设置，返回 JSON 格式
func GetSettings() (string, error) {
	return mobileCallRead("GetSettings", "", func() (string, error) {
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
	})
}

// UpdateSettings 更新设置
func UpdateSettings(autoLockMinutes int, lockOnMinimize, lockOnSleep bool) error {
	return mobileCallError("UpdateSettings", func() error {
		if coreInstance == nil {
			return errNotInitialized
		}
		settings := &database.Settings{
			AutoLockMinutes: autoLockMinutes,
			LockOnMinimize:  lockOnMinimize,
			LockOnSleep:     lockOnSleep,
		}
		return coreInstance.UpdateSettings(settings)
	})
}

// ============ 辅助函数 ============

var errNotInitialized = &NotInitializedError{}

type NotInitializedError struct{}

func (e *NotInitializedError) Error() string {
	return "core not initialized, call Init first"
}

func parseOptionalTodoDate(value string) (*time.Time, error) {
	if value == "" {
		return nil, nil
	}
	if parsed, err := time.Parse("2006-01-02", value); err == nil {
		return &parsed, nil
	}
	parsed, err := time.Parse(time.RFC3339Nano, value)
	if err != nil {
		return nil, err
	}
	return &parsed, nil
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

func marshalTodo(todo *todos.Todo) (string, error) {
	data, err := json.Marshal(todo)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func marshalTodos(items []*todos.Todo) (string, error) {
	data, err := json.Marshal(items)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func marshalTodoSubtask(subtask *todos.Subtask) (string, error) {
	data, err := json.Marshal(subtask)
	if err != nil {
		return "", err
	}
	return string(data), nil
}
