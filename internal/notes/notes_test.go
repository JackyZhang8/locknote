package notes

import (
	"bytes"
	"os"
	"path/filepath"
	"testing"
	"time"

	"locknote/internal/database"
)

func newTestNotesService(t *testing.T) *Service {
	t.Helper()

	dataDir := t.TempDir()
	db, err := database.New(filepath.Join(dataDir, "locknote.db"))
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	t.Cleanup(func() {
		if err := db.Close(); err != nil {
			t.Fatalf("close database: %v", err)
		}
	})

	service := NewService(db, dataDir)
	service.SetMasterKey(bytes.Repeat([]byte{6}, 32))
	return service
}

func TestListUsesEncryptedEmptyTitleWithoutReadingNoteFile(t *testing.T) {
	service := newTestNotesService(t)
	note, err := service.Create("", "body")
	if err != nil {
		t.Fatalf("create note: %v", err)
	}
	if err := os.Remove(filepath.Join(service.dataDir, service.buildCipherPath("notes", note.ID))); err != nil {
		t.Fatalf("remove note file: %v", err)
	}
	listed, err := service.List()
	if err != nil {
		t.Fatalf("list notes: %v", err)
	}
	if len(listed) != 1 || listed[0].ID != note.ID || listed[0].Title != "" {
		t.Fatalf("listed notes = %#v, want the empty-title note", listed)
	}
}

func TestSearchUsesAndClearsContentCache(t *testing.T) {
	service := newTestNotesService(t)
	note, err := service.Create("cached title", "initial content")
	if err != nil {
		t.Fatalf("create note: %v", err)
	}
	if _, err := service.Update(note.ID, "cached title", "updated searchable content"); err != nil {
		t.Fatalf("update note: %v", err)
	}
	if err := os.Remove(filepath.Join(service.dataDir, service.buildCipherPath("notes", note.ID))); err != nil {
		t.Fatalf("remove note file: %v", err)
	}
	results, err := service.Search("searchable")
	if err != nil {
		t.Fatalf("search cached content: %v", err)
	}
	if len(results) != 1 || results[0].ID != note.ID {
		t.Fatalf("search results = %#v, want cached note", results)
	}
	service.SetMasterKey(nil)
	service.cacheMu.RLock()
	cacheSize := len(service.contentCache)
	service.cacheMu.RUnlock()
	if cacheSize != 0 {
		t.Fatalf("cache size after clearing master key = %d, want 0", cacheSize)
	}
	if _, err := service.Search("searchable"); err == nil {
		t.Fatal("expected search to fail after clearing the master key")
	}
}

func TestUpdateSkipsHistoryForUneditedEmptyInitialNote(t *testing.T) {
	service := newTestNotesService(t)

	note, err := service.Create("新建笔记", "")
	if err != nil {
		t.Fatalf("create note: %v", err)
	}

	if _, err := service.Update(note.ID, "Project plan", "Draft body"); err != nil {
		t.Fatalf("first update note: %v", err)
	}

	history, err := service.GetHistory(note.ID)
	if err != nil {
		t.Fatalf("get history after first edit: %v", err)
	}
	if len(history) != 0 {
		t.Fatalf("history count after first edit = %d, want 0", len(history))
	}
}

func TestInitialHistorySkipOnlyAppliesToEmptyContent(t *testing.T) {
	now := time.Now()
	meta := &database.NoteMeta{CreatedAt: now, UpdatedAt: now}

	if !isUneditedEmptyInitialNote(meta, NoteContent{Title: "New Note", Content: ""}) {
		t.Fatal("empty initial note should be skipped")
	}
	if isUneditedEmptyInitialNote(meta, NoteContent{Title: "New Note", Content: "body"}) {
		t.Fatal("initial note with content should not be skipped")
	}
	if isUneditedEmptyInitialNote(&database.NoteMeta{CreatedAt: now, UpdatedAt: now.Add(time.Second)}, NoteContent{Title: "New Note", Content: ""}) {
		t.Fatal("edited empty note should not be skipped")
	}
}

func TestListWithStatusCountsUndecryptableNotes(t *testing.T) {
	service := newTestNotesService(t)
	if _, err := service.Create("secret", "body"); err != nil {
		t.Fatalf("create note: %v", err)
	}

	// 换一个不匹配的密钥，模拟密文损坏或密钥不一致。
	service.SetMasterKey(bytes.Repeat([]byte{9}, 32))

	result, err := service.ListWithStatus()
	if err != nil {
		t.Fatalf("list notes with status: %v", err)
	}
	if len(result.Notes) != 0 {
		t.Fatalf("visible notes = %d, want 0", len(result.Notes))
	}
	if result.Undecryptable != 1 {
		t.Fatalf("undecryptable = %d, want 1", result.Undecryptable)
	}
	if result.Total != 1 {
		t.Fatalf("total = %d, want 1", result.Total)
	}
}

func TestListKeepsBackwardCompatibleSignature(t *testing.T) {
	service := newTestNotesService(t)
	if _, err := service.Create("secret", "body"); err != nil {
		t.Fatalf("create note: %v", err)
	}
	service.SetMasterKey(bytes.Repeat([]byte{9}, 32))

	listed, err := service.List()
	if err != nil {
		t.Fatalf("list notes: %v", err)
	}
	if len(listed) != 0 {
		t.Fatalf("listed notes = %d, want 0", len(listed))
	}
}
