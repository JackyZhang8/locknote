// https://github.com/JackyZhang8/locknote
// 一个简单、可靠、离线优先的桌面加密笔记软件。
// A simple, reliable, offline-first encrypted note-taking desktop app.
package notes

import (
	"archive/zip"
	"container/list"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"locknote/internal/crypto"
	"locknote/internal/database"
	"locknote/internal/fsutil"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

type Service struct {
	db         *database.DB
	dataDir    string
	crypto     *crypto.Service
	masterKey  []byte
	mu         sync.RWMutex
	cacheMu    sync.Mutex
	// contentCache 是解密后正文的 LRU 缓存，用于加速列表与搜索。
	contentCache map[string]*list.Element
	cacheOrder   *list.List
	cacheBytes   int
}

type cachedNoteContent struct {
	id         string
	updatedAt  time.Time
	cipherPath string
	title      string
	content    string
	size       int
}

// 缓存上限：条目数与字节数任一超限都会淘汰最久未使用的内容。
var (
	maxContentCacheEntries = 500
	maxContentCacheBytes   = 32 << 20
)

var (
	maxImportZipFileSize  int64 = 500 * 1024 * 1024
	maxImportZipTotalSize int64 = 4 * 1024 * 1024 * 1024
	maxImportZipEntries         = 100000
)

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

func (s *Service) listTitlePreview(meta *database.NoteMeta, key []byte) (string, string, bool) {
	title, preview := "", ""
	fallback := meta.EncryptedTitle == nil
	if meta.EncryptedTitle != nil {
		decrypted, err := s.crypto.Decrypt(key, meta.EncryptedTitle)
		if err != nil {
			fallback = true
		} else {
			title = string(decrypted)
		}
	}
	if meta.EncryptedPreview != nil {
		if decrypted, err := s.crypto.Decrypt(key, meta.EncryptedPreview); err == nil {
			preview = string(decrypted)
		}
	}
	if !fallback {
		return title, preview, true
	}
	ciphertext, err := os.ReadFile(filepath.Join(s.dataDir, meta.CipherPath))
	if err != nil {
		log.Printf("failed to read note file %s: %v", meta.ID, err)
		return "", "", false
	}
	plaintext, err := s.crypto.Decrypt(key, ciphertext)
	if err != nil {
		log.Printf("failed to decrypt note %s: %v", meta.ID, err)
		return "", "", false
	}
	var noteContent NoteContent
	if err := json.Unmarshal(plaintext, &noteContent); err != nil {
		log.Printf("failed to unmarshal note %s: %v", meta.ID, err)
		return "", "", false
	}
	return noteContent.Title, s.extractPreview(noteContent.Content), true
}

func (s *Service) noteFromMeta(meta *database.NoteMeta, key []byte, dbTags []*database.Tag) (*Note, bool) {
	title, preview, ok := s.listTitlePreview(meta, key)
	if !ok {
		return nil, false
	}
	tags := make([]Tag, len(dbTags))
	for i, tag := range dbTags {
		tags[i] = Tag{ID: tag.ID, Name: tag.Name, Color: tag.Color}
	}
	return &Note{
		ID:         meta.ID,
		Title:      title,
		Content:    preview,
		CreatedAt:  formatTime(meta.CreatedAt),
		UpdatedAt:  formatTime(meta.UpdatedAt),
		Pinned:     meta.Pinned,
		DeletedAt:  formatTimePtr(meta.DeletedAt),
		NotebookID: meta.NotebookID,
		Tags:       tags,
	}, true
}

func NewService(db *database.DB, dataDir string) *Service {
	return &Service{
		db:           db,
		dataDir:      dataDir,
		crypto:       crypto.NewService(),
		contentCache: make(map[string]*list.Element),
		cacheOrder:   list.New(),
	}
}

func (s *Service) SetMasterKey(key []byte) {
	s.ClearContentCache()
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.masterKey != nil {
		for i := range s.masterKey {
			s.masterKey[i] = 0
		}
	}
	s.masterKey = key
}

func (s *Service) ClearContentCache() {
	s.cacheMu.Lock()
	s.initCacheLocked()
	s.cacheMu.Unlock()
}

func (s *Service) initCacheLocked() {
	s.contentCache = make(map[string]*list.Element)
	s.cacheOrder = list.New()
	s.cacheBytes = 0
}

func (s *Service) cachedContent(meta *database.NoteMeta) (NoteContent, bool) {
	s.cacheMu.Lock()
	defer s.cacheMu.Unlock()

	element, ok := s.contentCache[meta.ID]
	if !ok {
		return NoteContent{}, false
	}
	cached := element.Value.(*cachedNoteContent)
	if cached.cipherPath != meta.CipherPath || !cached.updatedAt.Equal(meta.UpdatedAt) {
		s.dropCachedContentLocked(meta.ID)
		return NoteContent{}, false
	}
	s.cacheOrder.MoveToFront(element)
	return NoteContent{Title: cached.title, Content: cached.content}, true
}

func (s *Service) storeContent(meta *database.NoteMeta, content NoteContent) {
	s.cacheMu.Lock()
	defer s.cacheMu.Unlock()

	if s.contentCache == nil || s.cacheOrder == nil {
		s.initCacheLocked()
	}
	s.dropCachedContentLocked(meta.ID)

	entry := &cachedNoteContent{
		id:         meta.ID,
		updatedAt:  meta.UpdatedAt,
		cipherPath: meta.CipherPath,
		title:      content.Title,
		content:    content.Content,
	}
	// 粗略估算内存占用：正文与标题的字节数，加固定的结构开销。
	entry.size = len(entry.title) + len(entry.content) + 128

	s.contentCache[meta.ID] = s.cacheOrder.PushFront(entry)
	s.cacheBytes += entry.size
	s.evictCacheLocked()
}

// evictCacheLocked 从尾部淘汰最久未使用的内容，直到满足条目与字节上限。
func (s *Service) evictCacheLocked() {
	for s.cacheOrder != nil && s.cacheOrder.Len() > 0 {
		if len(s.contentCache) <= maxContentCacheEntries && s.cacheBytes <= maxContentCacheBytes {
			return
		}
		oldest := s.cacheOrder.Back()
		if oldest == nil {
			return
		}
		s.cacheOrder.Remove(oldest)
		entry := oldest.Value.(*cachedNoteContent)
		delete(s.contentCache, entry.id)
		s.cacheBytes -= entry.size
	}
}

func (s *Service) dropCachedContentLocked(id string) {
	if s.contentCache == nil {
		return
	}
	element, ok := s.contentCache[id]
	if !ok {
		return
	}
	s.cacheOrder.Remove(element)
	s.cacheBytes -= element.Value.(*cachedNoteContent).size
	delete(s.contentCache, id)
}

func (s *Service) removeCachedContent(id string) {
	s.cacheMu.Lock()
	s.dropCachedContentLocked(id)
	s.cacheMu.Unlock()
}

func (s *Service) getMasterKey() ([]byte, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if s.masterKey == nil {
		return nil, errors.New("not unlocked")
	}
	return s.masterKey, nil
}

const previewMaxRunes = 200

func (s *Service) extractPreview(content string) string {
	runes := []rune(content)
	if len(runes) <= previewMaxRunes {
		return content
	}
	return string(runes[:previewMaxRunes])
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

	tempPath, err := fsutil.WriteTemp(fullPath, ciphertext, 0600)
	if err != nil {
		return nil, err
	}
	defer os.Remove(tempPath)

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
		return nil, err
	}
	if err := fsutil.Commit(tempPath, fullPath); err != nil {
		_ = s.db.DeleteNotePermanently(id)
		return nil, err
	}
	s.storeContent(meta, noteContent)

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

	noteContent, ok := s.cachedContent(meta)
	if !ok {
		fullPath := filepath.Join(s.dataDir, meta.CipherPath)
		ciphertext, err := os.ReadFile(fullPath)
		if err != nil {
			return nil, err
		}
		plaintext, err := s.crypto.Decrypt(key, ciphertext)
		if err != nil {
			return nil, err
		}
		if err := json.Unmarshal(plaintext, &noteContent); err != nil {
			return nil, err
		}
		s.storeContent(meta, noteContent)
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

func isUneditedEmptyInitialNote(meta *database.NoteMeta, content NoteContent) bool {
	return content.Content == "" && meta.CreatedAt.Equal(meta.UpdatedAt)
}

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
			shouldCreateHistory := !isUneditedEmptyInitialNote(meta, oldContent)

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
					if err := fsutil.WriteFileAtomic(historyFullPath, oldCiphertext, 0600); err == nil {
						historyRecord = &database.NoteHistory{
							ID:         historyID,
							NoteID:     id,
							CipherPath: historyPath,
							CreatedAt:  time.Now(),
						}
					} else {
						log.Printf("[Update] failed to write history for note %s: %v", id, err)
					}
				}

				if len(existingHistory) >= historyMaxCount {
					for i := historyMaxCount - 1; i < len(existingHistory); i++ {
						if err := s.db.DeleteSingleHistory(existingHistory[i].ID); err != nil {
							log.Printf("[Update] failed to prune history record %s: %v", existingHistory[i].ID, err)
							continue
						}
						if err := os.Remove(filepath.Join(s.dataDir, existingHistory[i].CipherPath)); err != nil && !os.IsNotExist(err) {
							log.Printf("[Update] failed to prune history file %s: %v", existingHistory[i].ID, err)
						}
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
	tempPath, err := fsutil.WriteTemp(fullPath, ciphertext, 0600)
	if err != nil {
		return nil, err
	}
	defer os.Remove(tempPath)

	if contentChanged {
		meta.UpdatedAt = time.Now()
	}
	meta.EncryptedTitle = encryptedTitle
	meta.EncryptedPreview = encryptedPreview
	if err := s.db.UpdateNoteAndCreateHistory(meta, historyRecord); err != nil {
		if historyRecord != nil {
			_ = os.Remove(filepath.Join(s.dataDir, historyRecord.CipherPath))
		}
		return nil, err
	}
	if err := fsutil.Commit(tempPath, fullPath); err != nil {
		return nil, err
	}
	s.storeContent(meta, noteContent)

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
	return s.db.SetNotePinned(id, pinned)
}

func (s *Service) SoftDelete(id string) error {
	return s.db.SoftDeleteNote(id)
}

func (s *Service) BatchSoftDelete(ids []string) error {
	return s.db.BatchSoftDeleteNotes(ids)
}

func (s *Service) Restore(id string) error {
	return s.db.RestoreNote(id)
}

func (s *Service) Delete(id string) error {
	meta, err := s.db.GetNote(id)
	if err != nil {
		return err
	}

	history, err := s.db.GetNoteHistory(id)
	if err != nil {
		return err
	}
	if err := s.db.DeleteNoteHistory(id); err != nil {
		return err
	}
	for _, item := range history {
		if err := os.Remove(filepath.Join(s.dataDir, item.CipherPath)); err != nil && !os.IsNotExist(err) {
			log.Printf("[Delete] failed to remove history file %s: %v", item.ID, err)
		}
	}
	if err := s.db.DeleteNotePermanently(id); err != nil {
		return err
	}
	s.removeCachedContent(id)
	if err := os.Remove(filepath.Join(s.dataDir, meta.CipherPath)); err != nil && !os.IsNotExist(err) {
		log.Printf("[Delete] failed to remove note file %s: %v", id, err)
	}
	return nil
}

func (s *Service) List() ([]*Note, error) {
	result, err := s.ListWithStatus()
	if err != nil {
		return nil, err
	}
	return result.Notes, nil
}

// ListWithStatus 与 List 相同，但额外返回无法解密的笔记数量。
// 无法解密的笔记不会出现在列表中，调用方应把 Undecryptable 明确告知用户，
// 避免密文损坏时笔记静默消失。
func (s *Service) ListWithStatus() (*ListResult, error) {
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
	undecryptable := 0
	for _, meta := range metas {
		if note, ok := s.noteFromMeta(meta, key, tagsByNoteID[meta.ID]); ok {
			notes = append(notes, note)
			continue
		}
		undecryptable++
	}

	return &ListResult{Notes: notes, Total: len(metas), Undecryptable: undecryptable}, nil
}

func (s *Service) Search(query string) ([]*Note, error) {
	key, err := s.getMasterKey()
	if err != nil {
		return nil, err
	}

	metas, err := s.db.ListNotes(false)
	if err != nil {
		return nil, err
	}

	query = strings.ToLower(query)
	noteIDs := make([]string, len(metas))
	for i, meta := range metas {
		noteIDs[i] = meta.ID
	}
	tagsByNoteID, _ := s.db.GetNoteTagsBatch(noteIDs)

	var results []*Note
	for _, meta := range metas {
		noteContent, ok := s.cachedContent(meta)
		if !ok {
			fullPath := filepath.Join(s.dataDir, meta.CipherPath)
			ciphertext, err := os.ReadFile(fullPath)
			if err != nil {
				continue
			}
			plaintext, err := s.crypto.Decrypt(key, ciphertext)
			if err != nil {
				continue
			}
			if err := json.Unmarshal(plaintext, &noteContent); err != nil {
				continue
			}
			s.storeContent(meta, noteContent)
		}

		titleMatch := strings.Contains(strings.ToLower(noteContent.Title), query)
		contentMatch := strings.Contains(strings.ToLower(noteContent.Content), query)

		dbTags := tagsByNoteID[meta.ID]
		tags := make([]Tag, len(dbTags))
		tagMatch := false
		for i, t := range dbTags {
			tags[i] = Tag{ID: t.ID, Name: t.Name, Color: t.Color}
			if strings.Contains(strings.ToLower(t.Name), query) {
				tagMatch = true
			}
		}

		if titleMatch || contentMatch || tagMatch {
			results = append(results, &Note{
				ID:         meta.ID,
				Title:      noteContent.Title,
				Content:    s.extractPreview(noteContent.Content),
				CreatedAt:  formatTime(meta.CreatedAt),
				UpdatedAt:  formatTime(meta.UpdatedAt),
				Pinned:     meta.Pinned,
				DeletedAt:  formatTimePtr(meta.DeletedAt),
				NotebookID: meta.NotebookID,
				Tags:       tags,
			})
		}
	}

	return results, nil
}

type ListResult struct {
	Notes []*Note `json:"notes"`
	Total int     `json:"total"`
	// Undecryptable 是本页中无法解密的笔记数量（密文损坏或密钥不匹配）。
	Undecryptable int `json:"undecryptable"`
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
	undecryptable := 0
	for _, meta := range metas {
		if note, ok := s.noteFromMeta(meta, key, tagsByNoteID[meta.ID]); ok {
			notes = append(notes, note)
			continue
		}
		undecryptable++
	}

	return &ListResult{Notes: notes, Total: total, Undecryptable: undecryptable}, nil
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
		if note, ok := s.noteFromMeta(meta, key, nil); ok {
			notes = append(notes, note)
		}
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
	if _, err := os.Stat(notesDir); err != nil {
		return 0, errors.New("备份文件格式无效：找不到笔记目录")
	}

	importedCount := 0
	err = filepath.Walk(notesDir, func(path string, info os.FileInfo, walkErr error) error {
		if walkErr != nil {
			return nil
		}
		if info.IsDir() || !strings.HasSuffix(info.Name(), ".enc") {
			return nil
		}

		ciphertext, err := os.ReadFile(path)
		if err != nil {
			return nil
		}

		plaintext, err := s.crypto.Decrypt(importKey, ciphertext)
		if err != nil {
			return nil
		}

		var noteContent NoteContent
		if err := json.Unmarshal(plaintext, &noteContent); err != nil {
			return nil
		}

		_, err = s.Create(noteContent.Title, noteContent.Content)
		if err != nil {
			return nil
		}
		importedCount++
		return nil
	})
	if err != nil {
		return 0, err
	}

	if importedCount == 0 {
		return 0, errors.New("无法导入任何笔记，请检查密钥是否正确")
	}

	s.ClearContentCache()
	return importedCount, nil
}

func (s *Service) extractZip(zipPath, destDir string) error {
	reader, err := zip.OpenReader(zipPath)
	if err != nil {
		return err
	}
	defer reader.Close()

	if len(reader.File) > maxImportZipEntries {
		return fmt.Errorf("zip contains too many entries (%d)", len(reader.File))
	}
	root := filepath.Clean(destDir)
	var totalSize int64
	for _, file := range reader.File {
		if filepath.IsAbs(file.Name) {
			continue
		}
		cleanDestPath := filepath.Clean(filepath.Join(root, filepath.FromSlash(file.Name)))
		relative, err := filepath.Rel(root, cleanDestPath)
		if err != nil || relative == ".." || strings.HasPrefix(relative, ".."+string(os.PathSeparator)) {
			continue
		}

		if file.FileInfo().IsDir() {
			if err := os.MkdirAll(cleanDestPath, 0700); err != nil {
				return err
			}
			continue
		}

		if maxImportZipFileSize < 0 || file.UncompressedSize64 > uint64(maxImportZipFileSize) {
			return errors.New("file in zip exceeds size limit")
		}
		remaining := maxImportZipTotalSize - totalSize
		limit := maxImportZipFileSize + 1
		if remaining < limit {
			limit = remaining + 1
		}
		if limit < 0 {
			limit = 0
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

		copied, copyErr := io.Copy(destFile, io.LimitReader(srcFile, limit))
		sourceCloseErr := srcFile.Close()
		destCloseErr := destFile.Close()
		if copyErr != nil {
			return copyErr
		}
		if sourceCloseErr != nil {
			return sourceCloseErr
		}
		if destCloseErr != nil {
			return destCloseErr
		}
		if copied > maxImportZipFileSize {
			return errors.New("file in zip exceeds size limit")
		}
		totalSize += copied
		if totalSize > maxImportZipTotalSize {
			return errors.New("zip exceeds total size limit")
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

				if err := fsutil.WriteFileAtomic(newFullPath, ciphertext, 0600); err != nil {
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
