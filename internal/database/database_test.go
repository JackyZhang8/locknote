package database

import (
	"path/filepath"
	"testing"
)

func TestMigrateIsIdempotentAndSetsSchemaVersion(t *testing.T) {
	db, err := New(filepath.Join(t.TempDir(), "locknote.db"))
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	defer db.Close()

	if err := db.migrate(); err != nil {
		t.Fatalf("first migration: %v", err)
	}
	if err := db.migrate(); err != nil {
		t.Fatalf("second migration: %v", err)
	}
	var version int
	if err := db.db.QueryRow(`PRAGMA user_version;`).Scan(&version); err != nil {
		t.Fatalf("read user_version: %v", err)
	}
	if version != schemaVersion {
		t.Fatalf("user_version = %d, want %d", version, schemaVersion)
	}
}

func TestMasterPasswordInsertUpdateAndClosedDBErrors(t *testing.T) {
	db, err := New(filepath.Join(t.TempDir(), "locknote.db"))
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	if err := db.InsertMasterPassword([]byte("salt"), []byte("verifier"), "hint", []byte("key")); err != nil {
		t.Fatalf("insert master password: %v", err)
	}
	if err := db.InsertMasterPassword([]byte("salt"), []byte("verifier"), "hint", []byte("key")); err == nil {
		t.Fatal("expected duplicate master password insert to fail")
	}
	if err := db.UpdateMasterPassword([]byte("salt2"), []byte("verifier2"), "hint2", []byte("key2")); err != nil {
		t.Fatalf("update master password: %v", err)
	}
	if err := db.Close(); err != nil {
		t.Fatalf("close database: %v", err)
	}
	if _, err := db.HasMasterPassword(); err == nil {
		t.Fatal("expected HasMasterPassword to fail on closed database")
	}

	emptyDB, err := New(filepath.Join(t.TempDir(), "empty.db"))
	if err != nil {
		t.Fatalf("open empty database: %v", err)
	}
	defer emptyDB.Close()
	if err := emptyDB.UpdateMasterPassword(nil, nil, "", nil); err == nil {
		t.Fatal("expected update without an existing password record to fail")
	}
}
