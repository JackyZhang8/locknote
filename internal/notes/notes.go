// https://github.com/JackyZhang8/locknote
// 一个简单、可靠、离线优先的桌面加密笔记软件。
// A simple, reliable, offline-first encrypted note-taking desktop app.
package notes

import (
	"archive/zip"
	"encoding/json"
	"errors"
	"io"
	"locknote/internal/crypto"
	"locknote/internal/database"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

type Service struct {
	db        *database.DB
	dataDir   string
	crypto    *crypto.Service
	masterKey []byte
	mu        sync.RWMutex
}

type Note struct {
	ID         string  `json:"id"`
	Title      string  `json:"title"`
	Content    string  `json:"content"`
	CreatedAt  string  `json:"createdAt"`
	UpdatedAt  string  `json:"updatedAt"`
	Pinned     bool    `json:"pinned"`
	DeletedAt  *string `json:"deletedAt,omitempty"`
	NotebookID *string `json:"notebookId,omitempty"`
	Tags       []Tag   `json:"tags"`
}

func formatTime(t time.Time) string {
	return t.Format(time.RFC3339Nano)
}

func formatTimePtr(t *time.Time) *string {
	if t == nil {
		return nil
	}
	s := t.Format(time.RFC3339Nano)
	return &s
}

type Tag struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Color string `json:"color"`
}

type NoteContent struct {
	Title   string `json:"title"`
	Content string `json:"content"`
}

func NewService(db *database.DB, dataDir string) *Service {
	return &Service{
		db:      db,
		dataDir: dataDir,
		crypto:  crypto.NewService(),
	}
}

func (s *Service) SetMasterKey(key []byte) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.masterKey = key
}

func (s *Service) getMasterKey() ([]byte, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if s.masterKey == nil {
		return nil, errors.New("not unlocked")
	}
	return s.masterKey, nil
}

const previewMaxLen = 200

func (s *Service) extractPreview(content string) string {
	if len(content) <= previewMaxLen {
		return content
	}
	return content[:previewMaxLen]
}

func (s *Service) Create(title, content string) (*Note, error) {
	key, err := s.getMasterKey()
	if err != nil {
		return nil, err
	}

	id := uuid.New().String()
	now := time.Now()

	noteContent := NoteContent{Title: title, Content: content}
	plaintext, err := json.Marshal(noteContent)
	if err != nil {
		return nil, err
	}

	ciphertext, err := s.crypto.Encrypt(key, plaintext)
	if err != nil {
		return nil, err
	}

	encryptedTitle, err := s.crypto.Encrypt(key, []byte(title))
	if err != nil {
		return nil, err
	}

	preview := s.extractPreview(content)
	encryptedPreview, err := s.crypto.Encrypt(key, []byte(preview))
	if err != nil {
		return nil, err
	}

	cipherPath := s.buildCipherPath("notes", id)
	fullPath := filepath.Join(s.dataDir, cipherPath)

	if err := os.MkdirAll(filepath.Dir(fullPath), 0700); err != nil {
		return nil, err
	}

	tempPath := fullPath + ".tmp"
	if err := os.WriteFile(tempPath, ciphertext, 0600); err != nil {
		return nil, err
	}
	if err := os.Rename(tempPath, fullPath); err != nil {
		os.Remove(tempPath)
		return nil, err
	}

	meta := &database.NoteMeta{
		ID:               id,
		CipherPath:       cipherPath,
		CreatedAt:        now,
		UpdatedAt:        now,
		Pinned:           false,
		EncryptedTitle:   encryptedTitle,
		EncryptedPreview: encryptedPreview,
	}

	if err := s.db.CreateNote(meta); err != nil {
		os.Remove(fullPath)
		return nil, err
	}

	return &Note{
		ID:         id,
		Title:      title,
		Content:    content,
		CreatedAt:  formatTime(now),
		UpdatedAt:  formatTime(now),
		Pinned:     false,
		NotebookID: nil,
		Tags:       []Tag{},
	}, nil
}

func (s *Service) buildCipherPath(dir, id string) string {
	prefix := id[:2]
	return filepath.Join(dir, prefix, id+".enc")
}

func (s *Service) Get(id string) (*Note, error) {
	key, err := s.getMasterKey()
	if err != nil {
		return nil, err
	}

	meta, err := s.db.GetNote(id)
	if err != nil {
		return nil, err
	}

	fullPath := filepath.Join(s.dataDir, meta.CipherPath)
	ciphertext, err := os.ReadFile(fullPath)
	if err != nil {
		return nil, err
	}

	plaintext, err := s.crypto.Decrypt(key, ciphertext)
	if err != nil {
		return nil, err
	}

	var noteContent NoteContent
	if err := json.Unmarshal(plaintext, &noteContent); err != nil {
		return nil, err
	}

	dbTags, err := s.db.GetNoteTags(id)
	if err != nil {
		return nil, err
	}

	tags := make([]Tag, len(dbTags))
	for i, t := range dbTags {
		tags[i] = Tag{ID: t.ID, Name: t.Name, Color: t.Color}
	}

	return &Note{
		ID:         meta.ID,
		Title:      noteContent.Title,
		Content:    noteContent.Content,
		CreatedAt:  formatTime(meta.CreatedAt),
		UpdatedAt:  formatTime(meta.UpdatedAt),
		Pinned:     meta.Pinned,
		DeletedAt:  formatTimePtr(meta.DeletedAt),
		NotebookID: meta.NotebookID,
		Tags:       tags,
	}, nil
}

const (
	historyMinInterval = 5 * time.Minute
	historyMaxCount    = 20
)

func (s *Service) Update(id, title, content string) (*Note, error) {
	key, err := s.getMasterKey()
	if err != nil {
		return nil, err
	}

	meta, err := s.db.GetNote(id)
	if err != nil {
		return nil, err
	}

	var historyRecord *database.NoteHistory
	var oldContent NoteContent
	var contentChanged bool

	oldPath := filepath.Join(s.dataDir, meta.CipherPath)
	oldCiphertext, err := os.ReadFile(oldPath)
	if err == nil {
		oldPlaintext, decErr := s.crypto.Decrypt(key, oldCiphertext)
		if decErr == nil {
			json.Unmarshal(oldPlaintext, &oldContent)
		}
		contentChanged = oldContent.Title != title || oldContent.Content != content

		if contentChanged {
			shouldCreateHistory := true

			existingHistory, _ := s.db.GetNoteHistory(id)
			if len(existingHistory) > 0 {
				lastHistory := existingHistory[0]
				if time.Since(lastHistory.CreatedAt) < historyMinInterval {
					shouldCreateHistory = false
				}
			}

			if shouldCreateHistory {
				historyID := uuid.New().String()
				historyPath := s.buildCipherPath("history", historyID)
				historyFullPath := filepath.Join(s.dataDir, historyPath)
				if err := os.MkdirAll(filepath.Dir(historyFullPath), 0700); err == nil {
					if err := os.WriteFile(historyFullPath, oldCiphertext, 0600); err == nil {
						historyRecord = &database.NoteHistory{
							ID:         historyID,
							NoteID:     id,
							CipherPath: historyPath,
							CreatedAt:  time.Now(),
						}
					}
				}

				if len(existingHistory) >= historyMaxCount {
					for i := historyMaxCount - 1; i < len(existingHistory); i++ {
						os.Remove(filepath.Join(s.dataDir, existingHistory[i].CipherPath))
						s.db.DeleteSingleHistory(existingHistory[i].ID)
					}
				}
			}
		}
	}

	noteContent := NoteContent{Title: title, Content: content}
	plaintext, err := json.Marshal(noteContent)
	if err != nil {
		return nil, err
	}

	ciphertext, err := s.crypto.Encrypt(key, plaintext)
	if err != nil {
		return nil, err
	}

	encryptedTitle, err := s.crypto.Encrypt(key, []byte(title))
	if err != nil {
		return nil, err
	}

	preview := s.extractPreview(content)
	encryptedPreview, err := s.crypto.Encrypt(key, []byte(preview))
	if err != nil {
		return nil, err
	}

	fullPath := filepath.Join(s.dataDir, meta.CipherPath)
	tempPath := fullPath + ".tmp"
	if err := os.WriteFile(tempPath, ciphertext, 0600); err != nil {
		return nil, err
	}
	if err := os.Rename(tempPath, fullPath); err != nil {
		os.Remove(tempPath)
		return nil, err
	}

	meta.UpdatedAt = time.Now()
	meta.EncryptedTitle = encryptedTitle
	meta.EncryptedPreview = encryptedPreview
	if err := s.db.UpdateNoteAndCreateHistory(meta, historyRecord); err != nil {
		return nil, err
	}

	dbTags, _ := s.db.GetNoteTags(id)
	tags := make([]Tag, len(dbTags))
	for i, t := range dbTags {
		tags[i] = Tag{ID: t.ID, Name: t.Name, Color: t.Color}
	}

	return &Note{
		ID:         meta.ID,
		Title:      title,
		Content:    content,
		CreatedAt:  formatTime(meta.CreatedAt),
		UpdatedAt:  formatTime(meta.UpdatedAt),
		Pinned:     meta.Pinned,
		DeletedAt:  formatTimePtr(meta.DeletedAt),
		NotebookID: meta.NotebookID,
		Tags:       tags,
	}, nil
}

func (s *Service) SetPinned(id string, pinned bool) error {
	meta, err := s.db.GetNote(id)
	if err != nil {
		return err
	}
	meta.Pinned = pinned
	meta.UpdatedAt = time.Now()
	return s.db.UpdateNote(meta)
}

func (s *Service) SoftDelete(id string) error {
	meta, err := s.db.GetNote(id)
	if err != nil {
		return err
	}
	now := time.Now()
	meta.DeletedAt = &now
	return s.db.UpdateNote(meta)
}

func (s *Service) Restore(id string) error {
	meta, err := s.db.GetNote(id)
	if err != nil {
		return err
	}
	meta.DeletedAt = nil
	meta.UpdatedAt = time.Now()
	return s.db.UpdateNote(meta)
}

func (s *Service) Delete(id string) error {
	meta, err := s.db.GetNote(id)
	if err != nil {
		return err
	}

	fullPath := filepath.Join(s.dataDir, meta.CipherPath)
	os.Remove(fullPath)

	history, _ := s.db.GetNoteHistory(id)
	for _, h := range history {
		os.Remove(filepath.Join(s.dataDir, h.CipherPath))
	}
	s.db.DeleteNoteHistory(id)

	return s.db.DeleteNotePermanently(id)
}

func (s *Service) List() ([]*Note, error) {
	key, err := s.getMasterKey()
	if err != nil {
		return nil, err
	}

	metas, err := s.db.ListNotes(false)
	if err != nil {
		return nil, err
	}

	// Batch fetch all tags to avoid N+1 queries
	noteIDs := make([]string, len(metas))
	for i, meta := range metas {
		noteIDs[i] = meta.ID
	}
	tagsByNoteID, _ := s.db.GetNoteTagsBatch(noteIDs)

	notes := make([]*Note, 0, len(metas))
	for _, meta := range metas {
		var title, preview string

		// Try to use cached encrypted title/preview first (fast path)
		if meta.EncryptedTitle != nil {
			if decrypted, err := s.crypto.Decrypt(key, meta.EncryptedTitle); err == nil {
				title = string(decrypted)
			}
		}
		if meta.EncryptedPreview != nil {
			if decrypted, err := s.crypto.Decrypt(key, meta.EncryptedPreview); err == nil {
				preview = string(decrypted)
			}
		}

		// Fallback to reading file if cache is empty (for old notes)
		if title == "" {
			fullPath := filepath.Join(s.dataDir, meta.CipherPath)
			ciphertext, err := os.ReadFile(fullPath)
			if err != nil {
				continue
			}

			plaintext, err := s.crypto.Decrypt(key, ciphertext)
			if err != nil {
				continue
			}

			var noteContent NoteContent
			if err := json.Unmarshal(plaintext, &noteContent); err != nil {
				continue
			}
			title = noteContent.Title
			preview = s.extractPreview(noteContent.Content)
		}

		// Get tags from batch result
		dbTags := tagsByNoteID[meta.ID]
		tags := make([]Tag, len(dbTags))
		for i, t := range dbTags {
			tags[i] = Tag{ID: t.ID, Name: t.Name, Color: t.Color}
		}

		notes = append(notes, &Note{
			ID:         meta.ID,
			Title:      title,
			Content:    preview,
			CreatedAt:  formatTime(meta.CreatedAt),
			UpdatedAt:  formatTime(meta.UpdatedAt),
			Pinned:     meta.Pinned,
			DeletedAt:  formatTimePtr(meta.DeletedAt),
			NotebookID: meta.NotebookID,
			Tags:       tags,
		})
	}

	return notes, nil
}

type ListResult struct {
	Notes []*Note `json:"notes"`
	Total int     `json:"total"`
}

func (s *Service) ListPaginated(limit, offset int) (*ListResult, error) {
	key, err := s.getMasterKey()
	if err != nil {
		return nil, err
	}

	metas, total, err := s.db.ListNotesPaginated(limit, offset)
	if err != nil {
		return nil, err
	}

	// Batch fetch all tags to avoid N+1 queries
	noteIDs := make([]string, len(metas))
	for i, meta := range metas {
		noteIDs[i] = meta.ID
	}
	tagsByNoteID, _ := s.db.GetNoteTagsBatch(noteIDs)

	notes := make([]*Note, 0, len(metas))
	for _, meta := range metas {
		var title, preview string

		// Try to use cached encrypted title/preview first (fast path)
		if meta.EncryptedTitle != nil {
			if decrypted, err := s.crypto.Decrypt(key, meta.EncryptedTitle); err == nil {
				title = string(decrypted)
			}
		}
		if meta.EncryptedPreview != nil {
			if decrypted, err := s.crypto.Decrypt(key, meta.EncryptedPreview); err == nil {
				preview = string(decrypted)
			}
		}

		// Fallback to reading file if cache is empty (for old notes)
		if title == "" {
			fullPath := filepath.Join(s.dataDir, meta.CipherPath)
			ciphertext, err := os.ReadFile(fullPath)
			if err != nil {
				continue
			}

			plaintext, err := s.crypto.Decrypt(key, ciphertext)
			if err != nil {
				continue
			}

			var noteContent NoteContent
			if err := json.Unmarshal(plaintext, &noteContent); err != nil {
				continue
			}
			title = noteContent.Title
			preview = s.extractPreview(noteContent.Content)
		}

		// Get tags from batch result
		dbTags := tagsByNoteID[meta.ID]
		tags := make([]Tag, len(dbTags))
		for i, t := range dbTags {
			tags[i] = Tag{ID: t.ID, Name: t.Name, Color: t.Color}
		}

		notes = append(notes, &Note{
			ID:         meta.ID,
			Title:      title,
			Content:    preview,
			CreatedAt:  formatTime(meta.CreatedAt),
			UpdatedAt:  formatTime(meta.UpdatedAt),
			Pinned:     meta.Pinned,
			DeletedAt:  formatTimePtr(meta.DeletedAt),
			NotebookID: meta.NotebookID,
			Tags:       tags,
		})
	}

	return &ListResult{Notes: notes, Total: total}, nil
}

func (s *Service) SetNotebook(id string, notebookID *string) error {
	return s.db.SetNoteNotebook(id, notebookID)
}

func (s *Service) SetNotesNotebook(noteIDs []string, notebookID *string) error {
	return s.db.SetNotesNotebook(noteIDs, notebookID)
}

func (s *Service) ListDeleted() ([]*Note, error) {
	key, err := s.getMasterKey()
	if err != nil {
		return nil, err
	}

	metas, err := s.db.ListDeletedNotes()
	if err != nil {
		return nil, err
	}

	notes := make([]*Note, 0, len(metas))
	for _, meta := range metas {
		var title, preview string

		// Try to use cached encrypted title/preview first
		if meta.EncryptedTitle != nil {
			if decrypted, err := s.crypto.Decrypt(key, meta.EncryptedTitle); err == nil {
				title = string(decrypted)
			}
		}
		if meta.EncryptedPreview != nil {
			if decrypted, err := s.crypto.Decrypt(key, meta.EncryptedPreview); err == nil {
				preview = string(decrypted)
			}
		}

		// Fallback to reading file if cache is empty
		if title == "" {
			fullPath := filepath.Join(s.dataDir, meta.CipherPath)
			ciphertext, err := os.ReadFile(fullPath)
			if err != nil {
				continue
			}

			plaintext, err := s.crypto.Decrypt(key, ciphertext)
			if err != nil {
				continue
			}

			var noteContent NoteContent
			if err := json.Unmarshal(plaintext, &noteContent); err != nil {
				continue
			}
			title = noteContent.Title
			preview = s.extractPreview(noteContent.Content)
		}

		notes = append(notes, &Note{
			ID:        meta.ID,
			Title:     title,
			Content:   preview,
			CreatedAt: formatTime(meta.CreatedAt),
			UpdatedAt: formatTime(meta.UpdatedAt),
			Pinned:    meta.Pinned,
			DeletedAt: formatTimePtr(meta.DeletedAt),
			Tags:      []Tag{},
		})
	}

	return notes, nil
}

func (s *Service) GetHistory(noteID string) ([]*Note, error) {
	key, err := s.getMasterKey()
	if err != nil {
		return nil, err
	}

	history, err := s.db.GetNoteHistory(noteID)
	if err != nil {
		return nil, err
	}

	notes := make([]*Note, 0, len(history))
	for _, h := range history {
		fullPath := filepath.Join(s.dataDir, h.CipherPath)
		ciphertext, err := os.ReadFile(fullPath)
		if err != nil {
			continue
		}

		plaintext, err := s.crypto.Decrypt(key, ciphertext)
		if err != nil {
			continue
		}

		var noteContent NoteContent
		if err := json.Unmarshal(plaintext, &noteContent); err != nil {
			continue
		}

		notes = append(notes, &Note{
			ID:        h.ID,
			Title:     noteContent.Title,
			Content:   noteContent.Content,
			CreatedAt: formatTime(h.CreatedAt),
			UpdatedAt: formatTime(h.CreatedAt),
			Tags:      []Tag{},
		})
	}

	return notes, nil
}

func (s *Service) RestoreFromHistory(noteID, historyID string) (*Note, error) {
	key, err := s.getMasterKey()
	if err != nil {
		return nil, err
	}

	history, err := s.db.GetNoteHistory(noteID)
	if err != nil {
		return nil, err
	}

	var targetHistory *database.NoteHistory
	for _, h := range history {
		if h.ID == historyID {
			targetHistory = h
			break
		}
	}

	if targetHistory == nil {
		return nil, errors.New("history not found")
	}

	fullPath := filepath.Join(s.dataDir, targetHistory.CipherPath)
	ciphertext, err := os.ReadFile(fullPath)
	if err != nil {
		return nil, err
	}

	plaintext, err := s.crypto.Decrypt(key, ciphertext)
	if err != nil {
		return nil, err
	}

	var noteContent NoteContent
	if err := json.Unmarshal(plaintext, &noteContent); err != nil {
		return nil, err
	}

	return s.Update(noteID, noteContent.Title, noteContent.Content)
}

func (s *Service) ReorderNotes(ids []string) error {
	return s.db.ReorderNotes(ids)
}

func (s *Service) ImportFromBackup(backupPath, displayKey string) (int, error) {
	_, err := s.getMasterKey()
	if err != nil {
		return 0, err
	}

	importKey, err := s.crypto.ParseDisplayKey(displayKey)
	if err != nil {
		return 0, errors.New("无效的密钥格式")
	}

	tempDir, err := os.MkdirTemp("", "locknote-import-*")
	if err != nil {
		return 0, err
	}
	defer os.RemoveAll(tempDir)

	if err := s.extractZip(backupPath, tempDir); err != nil {
		return 0, err
	}

	notesDir := filepath.Join(tempDir, "notes")
	entries, err := os.ReadDir(notesDir)
	if err != nil {
		return 0, errors.New("备份文件格式无效：找不到笔记目录")
	}

	importedCount := 0
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".enc") {
			continue
		}

		encPath := filepath.Join(notesDir, entry.Name())
		ciphertext, err := os.ReadFile(encPath)
		if err != nil {
			continue
		}

		plaintext, err := s.crypto.Decrypt(importKey, ciphertext)
		if err != nil {
			continue
		}

		var noteContent NoteContent
		if err := json.Unmarshal(plaintext, &noteContent); err != nil {
			continue
		}

		_, err = s.Create(noteContent.Title, noteContent.Content)
		if err != nil {
			continue
		}
		importedCount++
	}

	if importedCount == 0 {
		return 0, errors.New("无法导入任何笔记，请检查密钥是否正确")
	}

	return importedCount, nil
}

func (s *Service) extractZip(zipPath, destDir string) error {
	reader, err := zip.OpenReader(zipPath)
	if err != nil {
		return err
	}
	defer reader.Close()

	for _, file := range reader.File {
		destPath := filepath.Join(destDir, file.Name)
		cleanDestPath := filepath.Clean(destPath)

		if !strings.HasPrefix(cleanDestPath, filepath.Clean(destDir)+string(os.PathSeparator)) {
			continue
		}

		if file.FileInfo().IsDir() {
			os.MkdirAll(cleanDestPath, 0700)
			continue
		}

		if err := os.MkdirAll(filepath.Dir(cleanDestPath), 0700); err != nil {
			return err
		}

		destFile, err := os.OpenFile(cleanDestPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0600)
		if err != nil {
			return err
		}

		srcFile, err := file.Open()
		if err != nil {
			destFile.Close()
			return err
		}

		_, err = io.Copy(destFile, srcFile)
		srcFile.Close()
		destFile.Close()

		if err != nil {
			return err
		}
	}

	return nil
}

func (s *Service) MigrateOldNotes() (int, error) {
	key, err := s.getMasterKey()
	if err != nil {
		return 0, err
	}

	metas, err := s.db.ListNotes(true)
	if err != nil {
		return 0, err
	}

	migratedCount := 0
	for _, meta := range metas {
		needsUpdate := false
		oldPath := filepath.Join(s.dataDir, meta.CipherPath)

		// Check if file needs to be moved to new directory structure
		newCipherPath := s.buildCipherPath("notes", meta.ID)
		if meta.CipherPath != newCipherPath {
			newFullPath := filepath.Join(s.dataDir, newCipherPath)

			// Only migrate if old file exists and new path is different
			if _, err := os.Stat(oldPath); err == nil {
				if err := os.MkdirAll(filepath.Dir(newFullPath), 0700); err != nil {
					continue
				}

				// Copy file to new location
				ciphertext, err := os.ReadFile(oldPath)
				if err != nil {
					continue
				}

				if err := os.WriteFile(newFullPath, ciphertext, 0600); err != nil {
					continue
				}

				// Remove old file after successful copy
				os.Remove(oldPath)

				meta.CipherPath = newCipherPath
				needsUpdate = true
			}
		}

		// Check if encrypted_title/preview needs to be populated
		if meta.EncryptedTitle == nil {
			fullPath := filepath.Join(s.dataDir, meta.CipherPath)
			ciphertext, err := os.ReadFile(fullPath)
			if err != nil {
				continue
			}

			plaintext, err := s.crypto.Decrypt(key, ciphertext)
			if err != nil {
				continue
			}

			var noteContent NoteContent
			if err := json.Unmarshal(plaintext, &noteContent); err != nil {
				continue
			}

			encryptedTitle, err := s.crypto.Encrypt(key, []byte(noteContent.Title))
			if err != nil {
				continue
			}

			preview := s.extractPreview(noteContent.Content)
			encryptedPreview, err := s.crypto.Encrypt(key, []byte(preview))
			if err != nil {
				continue
			}

			meta.EncryptedTitle = encryptedTitle
			meta.EncryptedPreview = encryptedPreview
			needsUpdate = true
		}

		if needsUpdate {
			if err := s.db.UpdateNote(meta); err != nil {
				continue
			}
			migratedCount++
		}
	}

	return migratedCount, nil
}
