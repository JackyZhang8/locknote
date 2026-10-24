package backup

import (
	"archive/zip"
	"bytes"
	"os"
	"path/filepath"
	"testing"

	"locknote/internal/crypto"
)

type zipTestEntry struct {
	name string
	data []byte
}

func writeTestZip(t *testing.T, path string, entries []zipTestEntry) {
	t.Helper()
	file, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	writer := zip.NewWriter(file)
	for _, entry := range entries {
		part, err := writer.Create(entry.name)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := part.Write(entry.data); err != nil {
			t.Fatal(err)
		}
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	if err := file.Close(); err != nil {
		t.Fatal(err)
	}
}

func TestCreateBackupExcludesSensitiveFilesAndRestoreSnapshots(t *testing.T) {
	dataDir := t.TempDir()
	for _, name := range []string{"locknote.db", "data_key_verifier", "notes/note.enc", "restore-snapshots/123/notes/old.enc"} {
		path := filepath.Join(dataDir, name)
		if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, []byte("file"), 0600); err != nil {
			t.Fatal(err)
		}
	}

	backupPath := filepath.Join(t.TempDir(), "backup.zip")
	if err := NewService(dataDir).CreateBackup(backupPath); err != nil {
		t.Fatal(err)
	}
	reader, err := zip.OpenReader(backupPath)
	if err != nil {
		t.Fatal(err)
	}
	defer reader.Close()
	var names []string
	for _, file := range reader.File {
		names = append(names, file.Name)
	}
	if len(names) != 1 || names[0] != "notes/note.enc" {
		t.Fatalf("backup entries = %v, want only notes/note.enc", names)
	}
}

func TestRestoreBackupOverwritesAndSnapshotsOriginal(t *testing.T) {
	serviceCrypto := crypto.NewService()
	key := serviceCrypto.DeriveDataKey("same-vault-key")
	ciphertext, err := serviceCrypto.Encrypt(key, []byte("restored note"))
	if err != nil {
		t.Fatal(err)
	}
	dataDir := t.TempDir()
	notePath := filepath.Join(dataDir, "notes", "aa", "note.enc")
	if err := os.MkdirAll(filepath.Dir(notePath), 0700); err != nil {
		t.Fatal(err)
	}
	oldContent := []byte("old ciphertext")
	if err := os.WriteFile(notePath, oldContent, 0600); err != nil {
		t.Fatal(err)
	}
	backupPath := filepath.Join(t.TempDir(), "backup.zip")
	writeTestZip(t, backupPath, []zipTestEntry{{name: "notes/aa/note.enc", data: ciphertext}})

	if err := NewService(dataDir).RestoreBackup(backupPath, serviceCrypto, key); err != nil {
		t.Fatal(err)
	}
	got, err := os.ReadFile(notePath)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(got, ciphertext) {
		t.Fatal("restored note ciphertext does not match backup")
	}
	snapshotRoot := filepath.Join(dataDir, "restore-snapshots")
	var snapshotPath string
	err = filepath.Walk(snapshotRoot, func(path string, info os.FileInfo, err error) error {
		if err == nil && !info.IsDir() {
			snapshotPath = path
		}
		return err
	})
	if err != nil {
		t.Fatal(err)
	}
	snapshot, err := os.ReadFile(snapshotPath)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(snapshot, oldContent) {
		t.Fatalf("snapshot = %q, want %q", snapshot, oldContent)
	}
}

func TestRestoreBackupRejectsDifferentKeyWithoutChangingFiles(t *testing.T) {
	serviceCrypto := crypto.NewService()
	backupKey := serviceCrypto.DeriveDataKey("backup-key")
	currentKey := serviceCrypto.DeriveDataKey("current-key")
	ciphertext, err := serviceCrypto.Encrypt(backupKey, []byte("note"))
	if err != nil {
		t.Fatal(err)
	}
	dataDir := t.TempDir()
	notePath := filepath.Join(dataDir, "notes", "note.enc")
	if err := os.MkdirAll(filepath.Dir(notePath), 0700); err != nil {
		t.Fatal(err)
	}
	original := []byte("unchanged")
	if err := os.WriteFile(notePath, original, 0600); err != nil {
		t.Fatal(err)
	}
	backupPath := filepath.Join(t.TempDir(), "backup.zip")
	writeTestZip(t, backupPath, []zipTestEntry{{name: "notes/note.enc", data: ciphertext}})

	if err := NewService(dataDir).RestoreBackup(backupPath, serviceCrypto, currentKey); err == nil {
		t.Fatal("expected different-key restore to fail")
	}
	got, err := os.ReadFile(notePath)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(got, original) {
		t.Fatalf("original file changed: got %q", got)
	}
}

func TestRestoreBackupSkipsSensitiveAndTraversalEntries(t *testing.T) {
	serviceCrypto := crypto.NewService()
	key := serviceCrypto.DeriveDataKey("same-vault")
	ciphertext, err := serviceCrypto.Encrypt(key, []byte("note"))
	if err != nil {
		t.Fatal(err)
	}
	dataDir := t.TempDir()
	originalDB := []byte("existing db")
	if err := os.WriteFile(filepath.Join(dataDir, "locknote.db"), originalDB, 0600); err != nil {
		t.Fatal(err)
	}
	originalVerifier := []byte("existing verifier")
	if err := os.WriteFile(filepath.Join(dataDir, "data_key_verifier"), originalVerifier, 0600); err != nil {
		t.Fatal(err)
	}
	outsidePath := filepath.Join(filepath.Dir(dataDir), "evil")
	_ = os.Remove(outsidePath)
	backupPath := filepath.Join(t.TempDir(), "backup.zip")
	writeTestZip(t, backupPath, []zipTestEntry{
		{name: "notes/note.enc", data: ciphertext},
		{name: "locknote.db", data: []byte("malicious db")},
		{name: "data_key_verifier", data: []byte("malicious verifier")},
		{name: "../evil", data: []byte("outside")},
	})

	if err := NewService(dataDir).RestoreBackup(backupPath, serviceCrypto, key); err != nil {
		t.Fatal(err)
	}
	for name, want := range map[string][]byte{
		"locknote.db":       originalDB,
		"data_key_verifier": originalVerifier,
	} {
		got, err := os.ReadFile(filepath.Join(dataDir, name))
		if err != nil {
			t.Fatal(err)
		}
		if !bytes.Equal(got, want) {
			t.Fatalf("%s changed: got %q", name, got)
		}
	}
	if _, err := os.Stat(outsidePath); !os.IsNotExist(err) {
		t.Fatalf("traversal entry was written outside the data directory: %v", err)
	}
}

func TestExtractBackupRejectsOversizedEntry(t *testing.T) {
	previousLimit := maxZipFileSize
	maxZipFileSize = 3
	defer func() { maxZipFileSize = previousLimit }()

	backupPath := filepath.Join(t.TempDir(), "backup.zip")
	writeTestZip(t, backupPath, []zipTestEntry{{name: "notes/oversized.enc", data: []byte("four")}})
	if _, err := NewService(t.TempDir()).ExtractBackupToTemp(backupPath); err == nil {
		t.Fatal("expected oversized zip entry to fail")
	}
}

func TestPruneRestoreSnapshotsKeepsNewest(t *testing.T) {
	dataDir := t.TempDir()
	service := NewService(dataDir)
	root := filepath.Join(dataDir, "restore-snapshots")

	for _, name := range []string{"100", "200", "300", "400", "500"} {
		if err := os.MkdirAll(filepath.Join(root, name), 0700); err != nil {
			t.Fatal(err)
		}
	}
	// 非时间戳目录不应被清理。
	if err := os.MkdirAll(filepath.Join(root, "keep-me"), 0700); err != nil {
		t.Fatal(err)
	}

	service.pruneRestoreSnapshots(3)

	entries, err := os.ReadDir(root)
	if err != nil {
		t.Fatal(err)
	}
	got := map[string]bool{}
	for _, entry := range entries {
		got[entry.Name()] = true
	}
	for _, want := range []string{"300", "400", "500", "keep-me"} {
		if !got[want] {
			t.Fatalf("snapshot %q should be kept, got %v", want, got)
		}
	}
	for _, gone := range []string{"100", "200"} {
		if got[gone] {
			t.Fatalf("snapshot %q should be pruned, got %v", gone, got)
		}
	}
}

func TestPruneRestoreSnapshotsNoopWhenUnderLimit(t *testing.T) {
	dataDir := t.TempDir()
	service := NewService(dataDir)
	root := filepath.Join(dataDir, "restore-snapshots")
	if err := os.MkdirAll(filepath.Join(root, "100"), 0700); err != nil {
		t.Fatal(err)
	}

	service.pruneRestoreSnapshots(3)

	if _, err := os.Stat(filepath.Join(root, "100")); err != nil {
		t.Fatalf("snapshot should survive: %v", err)
	}
}
