//  https://github.com/JackyZhang8/locknote
//  一个简单、可靠、离线优先的桌面加密笔记软件。
//  A simple, reliable, offline-first encrypted note-taking desktop app.

package main

import (
	"errors"
	"locknote/internal/attachments"
	"locknote/internal/database"
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

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

func (a *App) CreateNote(title, content string) (*notes.Note, error) {
	a.UpdateActivity()
	return a.core.Notes().Create(title, content)
}

func (a *App) GetNote(id string) (*notes.Note, error) {
	a.UpdateActivity()
	return a.core.Notes().Get(id)
}

func (a *App) UpdateNote(id, title, content string) (*notes.Note, error) {
	a.UpdateActivity()
	return a.core.Notes().Update(id, title, content)
}

func (a *App) SetNotePinned(id string, pinned bool) error {
	a.UpdateActivity()
	return a.core.Notes().SetPinned(id, pinned)
}

func (a *App) SoftDeleteNote(id string) error {
	a.UpdateActivity()
	return a.core.Notes().SoftDelete(id)
}

func (a *App) RestoreNote(id string) error {
	a.UpdateActivity()
	return a.core.Notes().Restore(id)
}

func (a *App) DeleteNote(id string) error {
	a.UpdateActivity()
	return a.core.Notes().Delete(id)
}

func (a *App) ListNotes() ([]*notes.Note, error) {
	a.UpdateActivity()
	return a.core.Notes().List()
}

func (a *App) ListNotesPaginated(limit, offset int) (*notes.ListResult, error) {
	a.UpdateActivity()
	return a.core.Notes().ListPaginated(limit, offset)
}

func (a *App) MigrateOldNotes() (int, error) {
	a.UpdateActivity()
	return a.core.Notes().MigrateOldNotes()
}

func (a *App) ListDeletedNotes() ([]*notes.Note, error) {
	a.UpdateActivity()
	return a.core.Notes().ListDeleted()
}

func (a *App) GetNoteHistory(noteID string) ([]*notes.Note, error) {
	a.UpdateActivity()
	return a.core.Notes().GetHistory(noteID)
}

func (a *App) RestoreNoteFromHistory(noteID, historyID string) (*notes.Note, error) {
	a.UpdateActivity()
	return a.core.Notes().RestoreFromHistory(noteID, historyID)
}

func (a *App) CreateTag(name, color string) (*tags.Tag, error) {
	a.UpdateActivity()
	return a.core.Tags().Create(name, color)
}

func (a *App) UpdateTag(id, name, color string) (*tags.Tag, error) {
	a.UpdateActivity()
	return a.core.Tags().Update(id, name, color)
}

func (a *App) DeleteTag(id string) error {
	a.UpdateActivity()
	return a.core.Tags().Delete(id)
}

func (a *App) ListTags() ([]*tags.Tag, error) {
	a.UpdateActivity()
	return a.core.Tags().List()
}

func (a *App) AddTagToNote(noteID, tagID string) error {
	a.UpdateActivity()
	return a.core.Tags().AddToNote(noteID, tagID)
}

func (a *App) RemoveTagFromNote(noteID, tagID string) error {
	a.UpdateActivity()
	return a.core.Tags().RemoveFromNote(noteID, tagID)
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
	a.UpdateActivity()
	return a.core.Todos().List()
}

func (a *App) GetTodo(id string) (*todos.Todo, error) {
	a.UpdateActivity()
	return a.core.Todos().Get(id)
}

func (a *App) CreateTodo(title, priority, dueAt string) (*todos.Todo, error) {
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
	return a.core.Todos().Create(input)
}

func (a *App) UpdateTodo(id, title, priority, dueAt string) (*todos.Todo, error) {
	a.UpdateActivity()

	parsedDueAt, err := parseOptionalDate(dueAt)
	if err != nil {
		return nil, err
	}

	return a.core.Todos().Update(todos.UpdateTodoInput{
		ID:       id,
		Title:    title,
		Priority: priority,
		DueAt:    parsedDueAt,
	})
}

func (a *App) SetTodoCompleted(id string, completed bool) (*todos.Todo, error) {
	a.UpdateActivity()
	return a.core.Todos().SetCompleted(id, completed)
}

func (a *App) DeleteTodo(id string) error {
	a.UpdateActivity()
	return a.core.Todos().Delete(id)
}

func (a *App) CreateTodoSubtask(todoID, title string) (*todos.Subtask, error) {
	a.UpdateActivity()
	return a.core.Todos().CreateSubtask(todoID, title)
}

func (a *App) UpdateTodoSubtask(id, title string) (*todos.Subtask, error) {
	a.UpdateActivity()
	return a.core.Todos().UpdateSubtask(id, title)
}

func (a *App) SetTodoSubtaskCompleted(id string, completed bool) (*todos.Subtask, error) {
	a.UpdateActivity()
	return a.core.Todos().SetSubtaskCompleted(id, completed)
}

func (a *App) DeleteTodoSubtask(id string) error {
	a.UpdateActivity()
	return a.core.Todos().DeleteSubtask(id)
}

func (a *App) GetSettings() (*database.Settings, error) {
	return a.core.GetSettings()
}

func (a *App) UpdateSettings(autoLockMinutes int, lockOnMinimize, lockOnSleep bool) error {
	settings := &database.Settings{
		AutoLockMinutes: autoLockMinutes,
		LockOnMinimize:  lockOnMinimize,
		LockOnSleep:     lockOnSleep,
	}
	return a.core.UpdateSettings(settings)
}

func (a *App) CreateBackup() (string, error) {
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

	err = a.core.Backup().CreateBackup(savePath)
	if err != nil {
		return "", err
	}

	return savePath, nil
}

func (a *App) RestoreBackup() error {
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

	return a.core.Backup().RestoreBackup(openPath)
}

func (a *App) ImportBackupWithKey(dataKey string) (int, error) {
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

	return a.core.Notes().ImportFromBackup(openPath, dataKey)
}

func (a *App) ExportNoteAsMarkdown(noteID string) (string, error) {
	a.UpdateActivity()

	note, err := a.core.Notes().Get(noteID)
	if err != nil {
		return "", err
	}

	savePath, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "导出笔记",
		DefaultFilename: note.Title + ".md",
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
	err = writeFileAtomic(savePath, []byte(exportedContent))
	if err != nil {
		return "", err
	}

	return savePath, nil
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
		attachment, data, err := a.core.Attachments().GetData(id)
		if err != nil {
			return "", err
		}
		fileName := uniqueExportImageName(attachment.OriginalName, attachment.MIMEType, attachment.ID, usedNames)
		fileNames[id] = fileName
		if err := writeFileAtomic(filepath.Join(assetsDirPath, fileName), data); err != nil {
			return "", err
		}
	}

	return rewriteMarkdownAttachmentLinks(content, assetsDirName, fileNames), nil
}

func (a *App) ImportMarkdown() (*notes.Note, error) {
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

	content, err := readFile(openPath)
	if err != nil {
		return nil, err
	}

	title := extractTitle(openPath, string(content))
	return a.core.Notes().Create(title, string(content))
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

	data, err := readFile(openPath)
	if err != nil {
		return nil, err
	}
	mimeType := imageMIMEFromFile(openPath, data)
	if mimeType == "" {
		return nil, errors.New("不支持的图片格式")
	}
	return a.core.Attachments().CreateImage(attachments.CreateImageInput{
		OriginalName: filepath.Base(openPath),
		MIMEType:     mimeType,
		Data:         data,
		NoteID:       noteID,
	})
}

func (a *App) CreateImageFromDataURL(noteID, originalName, dataURL string) (*attachments.Attachment, error) {
	a.UpdateActivity()
	return a.core.Attachments().CreateImageFromDataURL(noteID, originalName, dataURL)
}

func (a *App) GetAttachmentDataURL(id string) (string, error) {
	a.UpdateActivity()
	return a.core.Attachments().GetDataURL(id)
}

func (a *App) GetAttachmentThumbnailDataURL(id string) (string, error) {
	a.UpdateActivity()
	return a.core.Attachments().GetThumbnailDataURL(id)
}

func (a *App) ListAttachments() ([]*attachments.Attachment, error) {
	a.UpdateActivity()
	return a.core.Attachments().ListImages()
}

func (a *App) ListDeletedAttachments() ([]*attachments.Attachment, error) {
	a.UpdateActivity()
	return a.core.Attachments().ListDeletedImages()
}

func (a *App) SoftDeleteAttachment(id string) error {
	a.UpdateActivity()
	return a.core.Attachments().SoftDelete(id)
}

func (a *App) RestoreAttachment(id string) error {
	a.UpdateActivity()
	return a.core.Attachments().Restore(id)
}

func (a *App) DeleteAttachment(id string) error {
	a.UpdateActivity()
	return a.core.Attachments().Delete(id)
}

func (a *App) SetAttachmentFavorite(id string, favorite bool) error {
	a.UpdateActivity()
	return a.core.Attachments().SetFavorite(id, favorite)
}

func (a *App) AttachAttachmentToNote(noteID, attachmentID string) error {
	a.UpdateActivity()
	return a.core.Attachments().AttachToNote(noteID, attachmentID)
}

func (a *App) DetachAttachmentFromNote(noteID, attachmentID string) error {
	a.UpdateActivity()
	return a.core.Attachments().DetachFromNote(noteID, attachmentID)
}

func writeFileAtomic(path string, data []byte) error {
	tempPath := path + ".tmp"
	if err := writeFile(tempPath, data); err != nil {
		return err
	}
	return renameFile(tempPath, path)
}

func writeFile(path string, data []byte) error {
	return writeFileImpl(path, data)
}

func readFile(path string) ([]byte, error) {
	return readFileImpl(path)
}

func renameFile(oldPath, newPath string) error {
	return renameFileImpl(oldPath, newPath)
}

// Notebook APIs

func (a *App) CreateNotebook(name, icon string) (*notebooks.Notebook, error) {
	a.UpdateActivity()
	return a.core.Notebooks().Create(name, icon)
}

func (a *App) UpdateNotebook(id, name, icon string) (*notebooks.Notebook, error) {
	a.UpdateActivity()
	return a.core.Notebooks().Update(id, name, icon)
}

func (a *App) DeleteNotebook(id string) error {
	a.UpdateActivity()
	return a.core.Notebooks().Delete(id)
}

func (a *App) ListNotebooks() ([]*notebooks.Notebook, error) {
	a.UpdateActivity()
	return a.core.Notebooks().List()
}

func (a *App) ReorderNotebooks(ids []string) error {
	a.UpdateActivity()
	return a.core.Notebooks().ReorderNotebooks(ids)
}

func (a *App) SetNotebookPinned(id string, pinned bool) error {
	a.UpdateActivity()
	return a.core.Notebooks().SetPinned(id, pinned)
}

func (a *App) SetNoteNotebook(noteID string, notebookID *string) error {
	a.UpdateActivity()
	return a.core.Notes().SetNotebook(noteID, notebookID)
}

func (a *App) SetNotesNotebook(noteIDs []string, notebookID *string) error {
	a.UpdateActivity()
	return a.core.Notes().SetNotesNotebook(noteIDs, notebookID)
}

func (a *App) BatchDeleteNotes(noteIDs []string) error {
	a.UpdateActivity()
	for _, id := range noteIDs {
		if err := a.core.Notes().SoftDelete(id); err != nil {
			return err
		}
	}
	return nil
}

func (a *App) BatchAddTagToNotes(noteIDs []string, tagID string) error {
	a.UpdateActivity()
	for _, noteID := range noteIDs {
		if err := a.core.Tags().AddToNote(noteID, tagID); err != nil {
			return err
		}
	}
	return nil
}

func (a *App) ReorderNotes(ids []string) error {
	a.UpdateActivity()
	return a.core.Notes().ReorderNotes(ids)
}

// SmartView APIs

func (a *App) CreateSmartView(name, icon string, filter smartviews.Filter) (*smartviews.SmartView, error) {
	a.UpdateActivity()
	return a.core.SmartViews().Create(name, icon, filter)
}

func (a *App) UpdateSmartView(id, name, icon string, filter smartviews.Filter) (*smartviews.SmartView, error) {
	a.UpdateActivity()
	return a.core.SmartViews().Update(id, name, icon, filter)
}

func (a *App) DeleteSmartView(id string) error {
	a.UpdateActivity()
	return a.core.SmartViews().Delete(id)
}

func (a *App) ListSmartViews() ([]*smartviews.SmartView, error) {
	a.UpdateActivity()
	return a.core.SmartViews().List()
}

func (a *App) GetSmartView(id string) (*smartviews.SmartView, error) {
	a.UpdateActivity()
	return a.core.SmartViews().Get(id)
}
