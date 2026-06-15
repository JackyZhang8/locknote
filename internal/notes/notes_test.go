package notes

import (
	"bytes"
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
