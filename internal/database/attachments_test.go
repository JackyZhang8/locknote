package database

import (
	"database/sql"
	"path/filepath"
	"testing"
	"time"
)

func TestEnsureAttachmentSchemaAddsFavoriteColumnToExistingAttachments(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "locknote.db")
	rawDB, err := sql.Open("sqlite", dbPath+"?_foreign_keys=on")
	if err != nil {
		t.Fatalf("open raw database: %v", err)
	}
	_, err = rawDB.Exec(`
		CREATE TABLE attachments (
			id TEXT PRIMARY KEY,
			original_name TEXT NOT NULL,
			mime_type TEXT NOT NULL,
			size INTEGER NOT NULL,
			width INTEGER DEFAULT 0,
			height INTEGER DEFAULT 0,
			cipher_path TEXT NOT NULL,
			sha256 TEXT DEFAULT '',
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL
		);
		INSERT INTO attachments (id, original_name, mime_type, size, width, height, cipher_path, sha256, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
	`, "old-image", "old.png", "image/png", 10, 0, 0, "attachments/ol/d-/old-image.enc", "", time.Now(), time.Now())
	if closeErr := rawDB.Close(); closeErr != nil {
		t.Fatalf("close raw database: %v", closeErr)
	}
	if err != nil {
		t.Fatalf("create old attachment schema: %v", err)
	}

	db, err := New(dbPath)
	if err != nil {
		t.Fatalf("migrate database: %v", err)
	}
	defer db.Close()

	var count int
	if err := db.db.QueryRow(`SELECT COUNT(*) FROM pragma_table_info('attachments') WHERE name = 'favorite'`).Scan(&count); err != nil {
		t.Fatalf("inspect attachment columns: %v", err)
	}
	if count != 1 {
		t.Fatalf("favorite column count = %d, want 1", count)
	}

	var favorite int
	if err := db.db.QueryRow(`SELECT favorite FROM attachments WHERE id = ?`, "old-image").Scan(&favorite); err != nil {
		t.Fatalf("read migrated favorite value: %v", err)
	}
	if favorite != 0 {
		t.Fatalf("migrated favorite = %d, want 0", favorite)
	}
}
