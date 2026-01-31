//  https://github.com/JackyZhang8/locknote
//  一个简单、可靠、离线优先的桌面加密笔记软件。
//  A simple, reliable, offline-first encrypted note-taking desktop app.

package main

import (
	"locknote/internal/database"
	"locknote/internal/notebooks"
	"locknote/internal/notes"
	"locknote/internal/smartviews"
	"locknote/internal/tags"

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
	err = writeFileAtomic(savePath, []byte(content))
	if err != nil {
		return "", err
	}

	return savePath, nil
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
