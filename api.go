//  https://github.com/JackyZhang8/locknote
//  一个简单、可靠、离线优先的桌面加密笔记软件。
//  A simple, reliable, offline-first encrypted note-taking desktop app.

package main

import (
	"errors"
	"locknote/internal/attachments"
	"locknote/internal/database"
	"locknote/internal/fsutil"
	"locknote/internal/markdown"
	"locknote/internal/notebooks"
	"locknote/internal/notes"
	"locknote/internal/smartviews"
	"locknote/internal/tags"
	"locknote/internal/todos"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

func (a *App) CreateNote(title, content string) (*notes.Note, error) {
	c, coreErr := a.coreOrErr()
	if coreErr != nil {
		return nil, coreErr
	}

	a.UpdateActivity()
	return c.Notes().Create(title, content)
}

func (a *App) GetNote(id string) (*notes.Note, error) {
	c, coreErr := a.coreOrErr()
	if coreErr != nil {
		return nil, coreErr
	}

	a.UpdateActivity()
	return c.Notes().Get(id)
}

func (a *App) UpdateNote(id, title, content string) (*notes.Note, error) {
	c, coreErr := a.coreOrErr()
	if coreErr != nil {
		return nil, coreErr
	}

	a.UpdateActivity()
	return c.Notes().Update(id, title, content)
}

func (a *App) SetNotePinned(id string, pinned bool) error {
	c, coreErr := a.coreOrErr()
	if coreErr != nil {
		return coreErr
	}

	a.UpdateActivity()
	return c.Notes().SetPinned(id, pinned)
}

func (a *App) SoftDeleteNote(id string) error {
	c, coreErr := a.coreOrErr()
	if coreErr != nil {
		return coreErr
	}

	a.UpdateActivity()
	return c.Notes().SoftDelete(id)
}

func (a *App) RestoreNote(id string) error {
	c, coreErr := a.coreOrErr()
	if coreErr != nil {
		return coreErr
	}

	a.UpdateActivity()
	return c.Notes().Restore(id)
}

func (a *App) DeleteNote(id string) error {
	c, coreErr := a.coreOrErr()
	if coreErr != nil {
		return coreErr
	}

	a.UpdateActivity()
	return c.Notes().Delete(id)
}

func (a *App) ListNotes() ([]*notes.Note, error) {
	c, coreErr := a.coreOrErr()
	if coreErr != nil {
		return nil, coreErr
	}

	a.UpdateActivity()
	return c.Notes().List()
}

// ListNotesWithStatus 返回笔记列表，并附带无法解密的笔记数量。
func (a *App) ListNotesWithStatus() (*notes.ListResult, error) {
	c, coreErr := a.coreOrErr()
	if coreErr != nil {
		return nil, coreErr
	}

	a.UpdateActivity()
	return c.Notes().ListWithStatus()
}

func (a *App) ListNotesPaginated(limit, offset int) (*notes.ListResult, error) {
	c, coreErr := a.coreOrErr()
	if coreErr != nil {
		return nil, coreErr
	}

	a.UpdateActivity()
	return c.Notes().ListPaginated(limit, offset)
}

func (a *App) SearchNotes(query string) ([]*notes.Note, error) {
	c, coreErr := a.coreOrErr()
	if coreErr != nil {
		return nil, coreErr
	}

	a.UpdateActivity()
	return c.Notes().Search(query)
}

func (a *App) MigrateOldNotes() (int, error) {
	c, coreErr := a.coreOrErr()
	if coreErr != nil {
		return 0, coreErr
	}

	a.UpdateActivity()
	return c.Notes().MigrateOldNotes()
}

func (a *App) ListDeletedNotes() ([]*notes.Note, error) {
	c, coreErr := a.coreOrErr()
	if coreErr != nil {
		return nil, coreErr
	}

	a.UpdateActivity()
	return c.Notes().ListDeleted()
}

func (a *App) GetNoteHistory(noteID string) ([]*notes.Note, error) {
	c, coreErr := a.coreOrErr()
	if coreErr != nil {
		return nil, coreErr
	}

	a.UpdateActivity()
	return c.Notes().GetHistory(noteID)
}

func (a *App) RestoreNoteFromHistory(noteID, historyID string) (*notes.Note, error) {
	c, coreErr := a.coreOrErr()
	if coreErr != nil {
		return nil, coreErr
	}

	a.UpdateActivity()
	return c.Notes().RestoreFromHistory(noteID, historyID)
}

func (a *App) CreateTag(name, color string) (*tags.Tag, error) {
	c, coreErr := a.coreOrErr()
	if coreErr != nil {
		return nil, coreErr
	}

	a.UpdateActivity()
	return c.Tags().Create(name, color)
}

func (a *App) UpdateTag(id, name, color string) (*tags.Tag, error) {
	c, coreErr := a.coreOrErr()
	if coreErr != nil {
		return nil, coreErr
	}

	a.UpdateActivity()
	return c.Tags().Update(id, name, color)
}

func (a *App) DeleteTag(id string) error {
	c, coreErr := a.coreOrErr()
	if coreErr != nil {
		return coreErr
	}

	a.UpdateActivity()
	return c.Tags().Delete(id)
}

func (a *App) ListTags() ([]*tags.Tag, error) {
	c, coreErr := a.coreOrErr()
	if coreErr != nil {
		return nil, coreErr
	}

	a.UpdateActivity()
	return c.Tags().List()
}

func (a *App) AddTagToNote(noteID, tagID string) error {
	c, coreErr := a.coreOrErr()
	if coreErr != nil {
		return coreErr
	}

	a.UpdateActivity()
	return c.Tags().AddToNote(noteID, tagID)
}

func (a *App) RemoveTagFromNote(noteID, tagID string) error {
	c, coreErr := a.coreOrErr()
	if coreErr != nil {
		return coreErr
	}

	a.UpdateActivity()
	return c.Tags().RemoveFromNote(noteID, tagID)
}

func parseOptionalDate(value string) (*time.Time, error) {
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

func (a *App) ListTodos() ([]*todos.Todo, error) {
	c, coreErr := a.coreOrErr()
	if coreErr != nil {
		return nil, coreErr
	}

	a.UpdateActivity()
	return c.Todos().List()
}

func (a *App) GetTodo(id string) (*todos.Todo, error) {
	c, coreErr := a.coreOrErr()
	if coreErr != nil {
		return nil, coreErr
	}

	a.UpdateActivity()
	return c.Todos().Get(id)
}

func (a *App) CreateTodo(title, priority, dueAt string) (*todos.Todo, error) {
	c, coreErr := a.coreOrErr()
	if coreErr != nil {
		return nil, coreErr
	}

	a.UpdateActivity()

	parsedDueAt, err := parseOptionalDate(dueAt)
	if err != nil {
		return nil, err
	}

	input := todos.CreateTodoInput{
		Title:    title,
		Priority: priority,
		DueAt:    parsedDueAt,
	}
	return c.Todos().Create(input)
}

func (a *App) UpdateTodo(id, title, priority, dueAt string) (*todos.Todo, error) {
	c, coreErr := a.coreOrErr()
	if coreErr != nil {
		return nil, coreErr
	}

	a.UpdateActivity()

	parsedDueAt, err := parseOptionalDate(dueAt)
	if err != nil {
		return nil, err
	}

	return c.Todos().Update(todos.UpdateTodoInput{
		ID:       id,
		Title:    title,
		Priority: priority,
		DueAt:    parsedDueAt,
	})
}

func (a *App) SetTodoCompleted(id string, completed bool) (*todos.Todo, error) {
	c, coreErr := a.coreOrErr()
	if coreErr != nil {
		return nil, coreErr
	}

	a.UpdateActivity()
	return c.Todos().SetCompleted(id, completed)
}

func (a *App) DeleteTodo(id string) error {
	c, coreErr := a.coreOrErr()
	if coreErr != nil {
		return coreErr
	}

	a.UpdateActivity()
	return c.Todos().Delete(id)
}

func (a *App) CreateTodoSubtask(todoID, title string) (*todos.Subtask, error) {
	c, coreErr := a.coreOrErr()
	if coreErr != nil {
		return nil, coreErr
	}

	a.UpdateActivity()
	return c.Todos().CreateSubtask(todoID, title)
}

func (a *App) UpdateTodoSubtask(id, title string) (*todos.Subtask, error) {
	c, coreErr := a.coreOrErr()
	if coreErr != nil {
		return nil, coreErr
	}

	a.UpdateActivity()
	return c.Todos().UpdateSubtask(id, title)
}

func (a *App) SetTodoSubtaskCompleted(id string, completed bool) (*todos.Subtask, error) {
	c, coreErr := a.coreOrErr()
	if coreErr != nil {
		return nil, coreErr
	}

	a.UpdateActivity()
	return c.Todos().SetSubtaskCompleted(id, completed)
}

func (a *App) DeleteTodoSubtask(id string) error {
	c, coreErr := a.coreOrErr()
	if coreErr != nil {
		return coreErr
	}

	a.UpdateActivity()
	return c.Todos().DeleteSubtask(id)
}

func (a *App) GetSettings() (*database.Settings, error) {
	c, coreErr := a.coreOrErr()
	if coreErr != nil {
		return nil, coreErr
	}

	return c.GetSettings()
}

func (a *App) UpdateSettings(autoLockMinutes int, lockOnMinimize, lockOnSleep bool) error {
	c, coreErr := a.coreOrErr()
	if coreErr != nil {
		return coreErr
	}

	settings := &database.Settings{
		AutoLockMinutes: autoLockMinutes,
		LockOnMinimize:  lockOnMinimize,
		LockOnSleep:     lockOnSleep,
	}
	return c.UpdateSettings(settings)
}

func (a *App) CreateBackup() (string, error) {
	c, coreErr := a.coreOrErr()
	if coreErr != nil {
		return "", coreErr
	}

	a.UpdateActivity()

	savePath, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "保存备份文件",
		DefaultFilename: "LockNote.app-backup.zip",
		Filters: []runtime.FileFilter{
			{DisplayName: "ZIP 文件", Pattern: "*.zip"},
		},
	})
	if err != nil {
		return "", err
	}
	if savePath == "" {
		return "", nil
	}

	err = c.Backup().CreateBackup(savePath)
	if err != nil {
		return "", err
	}

	return savePath, nil
}

func (a *App) RestoreBackup() error {
	c, coreErr := a.coreOrErr()
	if coreErr != nil {
		return coreErr
	}

	a.UpdateActivity()

	openPath, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "选择备份文件",
		Filters: []runtime.FileFilter{
			{DisplayName: "ZIP 文件", Pattern: "*.zip"},
		},
	})
	if err != nil {
		return err
	}
	if openPath == "" {
		return nil
	}

	return c.RestoreBackup(openPath)
}

func (a *App) ImportBackupWithKey(dataKey string) (int, error) {
	c, coreErr := a.coreOrErr()
	if coreErr != nil {
		return 0, coreErr
	}

	a.UpdateActivity()

	openPath, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "选择要导入的备份文件",
		Filters: []runtime.FileFilter{
			{DisplayName: "ZIP 文件", Pattern: "*.zip"},
		},
	})
	if err != nil {
		return 0, err
	}
	if openPath == "" {
		return 0, nil
	}

	return c.Notes().ImportFromBackup(openPath, dataKey)
}

func (a *App) ExportNoteAsMarkdown(noteID string) (string, error) {
	c, coreErr := a.coreOrErr()
	if coreErr != nil {
		return "", coreErr
	}

	a.UpdateActivity()

	note, err := c.Notes().Get(noteID)
	if err != nil {
		return "", err
	}

	savePath, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "导出笔记",
		DefaultFilename: sanitizeFileName(note.Title) + ".md",
		Filters: []runtime.FileFilter{
			{DisplayName: "Markdown 文件", Pattern: "*.md"},
		},
	})
	if err != nil {
		return "", err
	}
	if savePath == "" {
		return "", nil
	}

	content := "# " + note.Title + "\n\n" + note.Content
	exportedContent, err := a.exportMarkdownAttachments(content, filepath.Dir(savePath), time.Now())
	if err != nil {
		return "", err
	}
	err = fsutil.WriteFileAtomic(savePath, []byte(exportedContent), 0600)
	if err != nil {
		return "", err
	}

	return savePath, nil
}

func sanitizeFileName(name string) string {
	var sanitized strings.Builder
	for _, char := range name {
		if unicode.IsControl(char) || strings.ContainsRune(`/\:*?"<>|`, char) {
			sanitized.WriteRune('_')
		} else {
			sanitized.WriteRune(char)
		}
	}
	name = strings.Trim(sanitized.String(), " .")
	runes := []rune(name)
	if len(runes) > 100 {
		name = strings.Trim(string(runes[:100]), " .")
	}
	if name == "" {
		return "note"
	}
	return name
}

var attachmentURLPattern = regexp.MustCompile(`locknote-attachment://([A-Za-z0-9_-]+)`)

func formatAssetsDirName(t time.Time) string {
	return "assets_" + t.Format("200601021504")
}

func collectAttachmentIDs(content string) []string {
	matches := attachmentURLPattern.FindAllStringSubmatch(content, -1)
	seen := map[string]bool{}
	ids := make([]string, 0, len(matches))
	for _, match := range matches {
		if len(match) < 2 || seen[match[1]] {
			continue
		}
		seen[match[1]] = true
		ids = append(ids, match[1])
	}
	return ids
}

func rewriteMarkdownAttachmentLinks(content, assetsDirName string, fileNames map[string]string) string {
	return attachmentURLPattern.ReplaceAllStringFunc(content, func(match string) string {
		parts := attachmentURLPattern.FindStringSubmatch(match)
		if len(parts) < 2 {
			return match
		}
		fileName, ok := fileNames[parts[1]]
		if !ok {
			return match
		}
		return filepath.ToSlash(filepath.Join(assetsDirName, fileName))
	})
}

func imageExtensionForMIME(mimeType string) string {
	switch strings.ToLower(mimeType) {
	case "image/png":
		return ".png"
	case "image/jpeg", "image/jpg":
		return ".jpg"
	case "image/webp":
		return ".webp"
	case "image/gif":
		return ".gif"
	default:
		return ".img"
	}
}

func sanitizeExportImageName(originalName, mimeType, id string) string {
	name := strings.TrimSpace(filepath.Base(originalName))
	if name == "" || name == "." || name == string(filepath.Separator) {
		prefix := id
		if len(prefix) > 8 {
			prefix = prefix[:8]
		}
		name = "image-" + prefix + imageExtensionForMIME(mimeType)
	}

	ext := filepath.Ext(name)
	base := strings.TrimSuffix(name, ext)
	if ext == "" {
		ext = imageExtensionForMIME(mimeType)
	}
	base = strings.TrimSpace(base)
	if base == "" {
		base = "image"
	}

	var b strings.Builder
	lastDash := false
	for _, r := range base {
		isSafe := r >= 'A' && r <= 'Z' || r >= 'a' && r <= 'z' || r >= '0' && r <= '9' || r == '-' || r == '_'
		if isSafe {
			b.WriteRune(r)
			lastDash = false
			continue
		}
		if !lastDash {
			b.WriteByte('-')
			lastDash = true
		}
	}
	base = strings.Trim(b.String(), "-")
	if base == "" {
		base = "image"
	}
	return base + strings.ToLower(ext)
}

func uniqueExportImageName(originalName, mimeType, id string, used map[string]int) string {
	name := sanitizeExportImageName(originalName, mimeType, id)
	ext := filepath.Ext(name)
	base := strings.TrimSuffix(name, ext)
	count := used[name]
	if count == 0 {
		used[name] = 1
		return name
	}
	for {
		count++
		next := base + "-" + strconv.Itoa(count) + ext
		if used[next] == 0 {
			used[name] = count
			used[next] = 1
			return next
		}
	}
}

func createUniqueAssetsDir(baseDir string, now time.Time) (string, string, error) {
	baseName := formatAssetsDirName(now)
	for i := 0; ; i++ {
		name := baseName
		if i > 0 {
			name = baseName + "_" + strconv.Itoa(i+1)
		}
		path := filepath.Join(baseDir, name)
		err := os.Mkdir(path, 0700)
		if err == nil {
			return name, path, nil
		}
		if os.IsExist(err) {
			continue
		}
		return "", "", err
	}
}

func (a *App) exportMarkdownAttachments(content, exportDir string, now time.Time) (string, error) {
	c, coreErr := a.coreOrErr()
	if coreErr != nil {
		return "", coreErr
	}

	attachmentIDs := collectAttachmentIDs(content)
	if len(attachmentIDs) == 0 {
		return content, nil
	}

	assetsDirName, assetsDirPath, err := createUniqueAssetsDir(exportDir, now)
	if err != nil {
		return "", err
	}

	fileNames := make(map[string]string, len(attachmentIDs))
	usedNames := map[string]int{}
	for _, id := range attachmentIDs {
		attachment, data, err := c.Attachments().GetData(id)
		if err != nil {
			return "", err
		}
		fileName := uniqueExportImageName(attachment.OriginalName, attachment.MIMEType, attachment.ID, usedNames)
		fileNames[id] = fileName
		if err := fsutil.WriteFileAtomic(filepath.Join(assetsDirPath, fileName), data, 0600); err != nil {
			return "", err
		}
	}

	return rewriteMarkdownAttachmentLinks(content, assetsDirName, fileNames), nil
}

func (a *App) ImportMarkdown() (*notes.Note, error) {
	c, coreErr := a.coreOrErr()
	if coreErr != nil {
		return nil, coreErr
	}

	a.UpdateActivity()

	openPath, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "导入 Markdown 文件",
		Filters: []runtime.FileFilter{
			{DisplayName: "Markdown 文件", Pattern: "*.md"},
		},
	})
	if err != nil {
		return nil, err
	}
	if openPath == "" {
		return nil, nil
	}

	content, err := os.ReadFile(openPath)
	if err != nil {
		return nil, err
	}

	title := markdown.ExtractTitle(openPath, string(content))
	return c.Notes().Create(title, string(content))
}

func parseImageDataURL(dataURL string) (string, []byte, error) {
	return attachments.ParseImageDataURL(dataURL)
}

func imageMIMEFromFile(path string, data []byte) string {
	switch strings.ToLower(filepath.Ext(path)) {
	case ".png":
		return "image/png"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".webp":
		return "image/webp"
	case ".gif":
		return "image/gif"
	default:
		detected := http.DetectContentType(data)
		if strings.HasPrefix(detected, "image/") {
			return detected
		}
		return ""
	}
}

func (a *App) ImportImage(noteID string) (*attachments.Attachment, error) {
	c, coreErr := a.coreOrErr()
	if coreErr != nil {
		return nil, coreErr
	}

	a.UpdateActivity()

	openPath, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "插入图片",
		Filters: []runtime.FileFilter{
			{DisplayName: "图片文件", Pattern: "*.png;*.jpg;*.jpeg;*.webp;*.gif"},
		},
	})
	if err != nil {
		return nil, err
	}
	if openPath == "" {
		return nil, nil
	}

	data, err := os.ReadFile(openPath)
	if err != nil {
		return nil, err
	}
	mimeType := imageMIMEFromFile(openPath, data)
	if mimeType == "" {
		return nil, errors.New("不支持的图片格式")
	}
	return c.Attachments().CreateImage(attachments.CreateImageInput{
		OriginalName: filepath.Base(openPath),
		MIMEType:     mimeType,
		Data:         data,
		NoteID:       noteID,
	})
}

func (a *App) CreateImageFromDataURL(noteID, originalName, dataURL string) (*attachments.Attachment, error) {
	c, coreErr := a.coreOrErr()
	if coreErr != nil {
		return nil, coreErr
	}

	a.UpdateActivity()
	return c.Attachments().CreateImageFromDataURL(noteID, originalName, dataURL)
}

func (a *App) GetAttachmentDataURL(id string) (string, error) {
	c, coreErr := a.coreOrErr()
	if coreErr != nil {
		return "", coreErr
	}

	a.UpdateActivity()
	return c.Attachments().GetDataURL(id)
}

func (a *App) GetAttachmentThumbnailDataURL(id string) (string, error) {
	c, coreErr := a.coreOrErr()
	if coreErr != nil {
		return "", coreErr
	}

	a.UpdateActivity()
	return c.Attachments().GetThumbnailDataURL(id)
}

func (a *App) ListAttachments() ([]*attachments.Attachment, error) {
	c, coreErr := a.coreOrErr()
	if coreErr != nil {
		return nil, coreErr
	}

	a.UpdateActivity()
	return c.Attachments().ListImages()
}

func (a *App) ListDeletedAttachments() ([]*attachments.Attachment, error) {
	c, coreErr := a.coreOrErr()
	if coreErr != nil {
		return nil, coreErr
	}

	a.UpdateActivity()
	return c.Attachments().ListDeletedImages()
}

func (a *App) SoftDeleteAttachment(id string) error {
	c, coreErr := a.coreOrErr()
	if coreErr != nil {
		return coreErr
	}

	a.UpdateActivity()
	return c.Attachments().SoftDelete(id)
}

func (a *App) RestoreAttachment(id string) error {
	c, coreErr := a.coreOrErr()
	if coreErr != nil {
		return coreErr
	}

	a.UpdateActivity()
	return c.Attachments().Restore(id)
}

func (a *App) DeleteAttachment(id string) error {
	c, coreErr := a.coreOrErr()
	if coreErr != nil {
		return coreErr
	}

	a.UpdateActivity()
	return c.Attachments().Delete(id)
}

func (a *App) SetAttachmentFavorite(id string, favorite bool) error {
	c, coreErr := a.coreOrErr()
	if coreErr != nil {
		return coreErr
	}

	a.UpdateActivity()
	return c.Attachments().SetFavorite(id, favorite)
}

func (a *App) AttachAttachmentToNote(noteID, attachmentID string) error {
	c, coreErr := a.coreOrErr()
	if coreErr != nil {
		return coreErr
	}

	a.UpdateActivity()
	return c.Attachments().AttachToNote(noteID, attachmentID)
}

func (a *App) DetachAttachmentFromNote(noteID, attachmentID string) error {
	c, coreErr := a.coreOrErr()
	if coreErr != nil {
		return coreErr
	}

	a.UpdateActivity()
	return c.Attachments().DetachFromNote(noteID, attachmentID)
}

// Notebook APIs

func (a *App) CreateNotebook(name, icon string) (*notebooks.Notebook, error) {
	c, coreErr := a.coreOrErr()
	if coreErr != nil {
		return nil, coreErr
	}

	a.UpdateActivity()
	return c.Notebooks().Create(name, icon)
}

func (a *App) UpdateNotebook(id, name, icon string) (*notebooks.Notebook, error) {
	c, coreErr := a.coreOrErr()
	if coreErr != nil {
		return nil, coreErr
	}

	a.UpdateActivity()
	return c.Notebooks().Update(id, name, icon)
}

func (a *App) DeleteNotebook(id string) error {
	c, coreErr := a.coreOrErr()
	if coreErr != nil {
		return coreErr
	}

	a.UpdateActivity()
	return c.Notebooks().Delete(id)
}

func (a *App) ListNotebooks() ([]*notebooks.Notebook, error) {
	c, coreErr := a.coreOrErr()
	if coreErr != nil {
		return nil, coreErr
	}

	a.UpdateActivity()
	return c.Notebooks().List()
}

func (a *App) ReorderNotebooks(ids []string) error {
	c, coreErr := a.coreOrErr()
	if coreErr != nil {
		return coreErr
	}

	a.UpdateActivity()
	return c.Notebooks().ReorderNotebooks(ids)
}

func (a *App) SetNotebookPinned(id string, pinned bool) error {
	c, coreErr := a.coreOrErr()
	if coreErr != nil {
		return coreErr
	}

	a.UpdateActivity()
	return c.Notebooks().SetPinned(id, pinned)
}

func (a *App) SetNoteNotebook(noteID string, notebookID *string) error {
	c, coreErr := a.coreOrErr()
	if coreErr != nil {
		return coreErr
	}

	a.UpdateActivity()
	return c.Notes().SetNotebook(noteID, notebookID)
}

func (a *App) SetNotesNotebook(noteIDs []string, notebookID *string) error {
	c, coreErr := a.coreOrErr()
	if coreErr != nil {
		return coreErr
	}

	a.UpdateActivity()
	return c.Notes().SetNotesNotebook(noteIDs, notebookID)
}

func (a *App) BatchDeleteNotes(noteIDs []string) error {
	c, coreErr := a.coreOrErr()
	if coreErr != nil {
		return coreErr
	}

	a.UpdateActivity()
	return c.Notes().BatchSoftDelete(noteIDs)
}

func (a *App) BatchAddTagToNotes(noteIDs []string, tagID string) error {
	c, coreErr := a.coreOrErr()
	if coreErr != nil {
		return coreErr
	}

	a.UpdateActivity()
	for _, noteID := range noteIDs {
		if err := c.Tags().AddToNote(noteID, tagID); err != nil {
			return err
		}
	}
	return nil
}

func (a *App) ReorderNotes(ids []string) error {
	c, coreErr := a.coreOrErr()
	if coreErr != nil {
		return coreErr
	}

	a.UpdateActivity()
	return c.Notes().ReorderNotes(ids)
}

// SmartView APIs

func (a *App) CreateSmartView(name, icon string, filter smartviews.Filter) (*smartviews.SmartView, error) {
	c, coreErr := a.coreOrErr()
	if coreErr != nil {
		return nil, coreErr
	}

	a.UpdateActivity()
	return c.SmartViews().Create(name, icon, filter)
}

func (a *App) UpdateSmartView(id, name, icon string, filter smartviews.Filter) (*smartviews.SmartView, error) {
	c, coreErr := a.coreOrErr()
	if coreErr != nil {
		return nil, coreErr
	}

	a.UpdateActivity()
	return c.SmartViews().Update(id, name, icon, filter)
}

func (a *App) DeleteSmartView(id string) error {
	c, coreErr := a.coreOrErr()
	if coreErr != nil {
		return coreErr
	}

	a.UpdateActivity()
	return c.SmartViews().Delete(id)
}

func (a *App) ListSmartViews() ([]*smartviews.SmartView, error) {
	c, coreErr := a.coreOrErr()
	if coreErr != nil {
		return nil, coreErr
	}

	a.UpdateActivity()
	return c.SmartViews().List()
}

func (a *App) GetSmartView(id string) (*smartviews.SmartView, error) {
	c, coreErr := a.coreOrErr()
	if coreErr != nil {
		return nil, coreErr
	}

	a.UpdateActivity()
	return c.SmartViews().Get(id)
}
