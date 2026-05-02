package attachments_test

import (
	"bytes"
	"encoding/base64"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"locknote/internal/attachments"
	"locknote/internal/database"
)

func TestServiceEncryptsImageOnDiskAndDecryptsDataURL(t *testing.T) {
	dataDir := t.TempDir()
	db, err := database.New(filepath.Join(dataDir, "locknote.db"))
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	defer db.Close()

	service := attachments.NewService(db, dataDir)
	service.SetMasterKey(bytes.Repeat([]byte{7}, 32))

	imageBytes := []byte("fake png bytes that must not be stored in plaintext")
	attachment, err := service.CreateImage(attachments.CreateImageInput{
		OriginalName: "pasted-image.png",
		MIMEType:     "image/png",
		Data:         imageBytes,
	})
	if err != nil {
		t.Fatalf("create image: %v", err)
	}
	if attachment.ID == "" {
		t.Fatal("expected generated attachment id")
	}
	if attachment.CipherPath == "" {
		t.Fatal("expected cipher path")
	}
	pathParts := strings.Split(filepath.ToSlash(attachment.CipherPath), "/")
	if len(pathParts) != 4 || pathParts[0] != "attachments" || pathParts[1] != attachment.ID[:2] || pathParts[2] != attachment.ID[2:4] || pathParts[3] != attachment.ID+".enc" {
		t.Fatalf("expected two-level attachment path, got %q", attachment.CipherPath)
	}

	ciphertext, err := os.ReadFile(filepath.Join(dataDir, attachment.CipherPath))
	if err != nil {
		t.Fatalf("read encrypted file: %v", err)
	}
	if bytes.Equal(ciphertext, imageBytes) || bytes.Contains(ciphertext, imageBytes) {
		t.Fatal("image bytes were written in plaintext")
	}

	dataURL, err := service.GetDataURL(attachment.ID)
	if err != nil {
		t.Fatalf("get data url: %v", err)
	}
	const prefix = "data:image/png;base64,"
	if !strings.HasPrefix(dataURL, prefix) {
		t.Fatalf("expected image data URL, got %q", dataURL)
	}
	decoded, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(dataURL, prefix))
	if err != nil {
		t.Fatalf("decode data URL: %v", err)
	}
	if !bytes.Equal(decoded, imageBytes) {
		t.Fatalf("decoded data mismatch: got %q want %q", decoded, imageBytes)
	}
}

func TestServiceListsAndDeletesEncryptedImages(t *testing.T) {
	dataDir := t.TempDir()
	db, err := database.New(filepath.Join(dataDir, "locknote.db"))
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	defer db.Close()

	service := attachments.NewService(db, dataDir)
	service.SetMasterKey(bytes.Repeat([]byte{9}, 32))

	first, err := service.CreateImage(attachments.CreateImageInput{
		OriginalName: "first.jpg",
		MIMEType:     "image/jpeg",
		Data:         []byte("first image"),
	})
	if err != nil {
		t.Fatalf("create first image: %v", err)
	}
	if _, err := service.CreateImage(attachments.CreateImageInput{
		OriginalName: "second.webp",
		MIMEType:     "image/webp",
		Data:         []byte("second image"),
	}); err != nil {
		t.Fatalf("create second image: %v", err)
	}

	items, err := service.ListImages()
	if err != nil {
		t.Fatalf("list images: %v", err)
	}
	if len(items) != 2 {
		t.Fatalf("expected 2 images, got %d", len(items))
	}

	cipherPath := filepath.Join(dataDir, first.CipherPath)
	if err := service.Delete(first.ID); err != nil {
		t.Fatalf("delete image: %v", err)
	}
	if _, err := os.Stat(cipherPath); !os.IsNotExist(err) {
		t.Fatalf("expected encrypted file to be removed, stat err=%v", err)
	}

	items, err = service.ListImages()
	if err != nil {
		t.Fatalf("list images after delete: %v", err)
	}
	if len(items) != 1 || items[0].ID == first.ID {
		t.Fatalf("deleted image is still listed: %#v", items)
	}
}

func TestServiceSetsImageFavorite(t *testing.T) {
	dataDir := t.TempDir()
	db, err := database.New(filepath.Join(dataDir, "locknote.db"))
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	defer db.Close()

	service := attachments.NewService(db, dataDir)
	service.SetMasterKey(bytes.Repeat([]byte{5}, 32))

	attachment, err := service.CreateImage(attachments.CreateImageInput{
		OriginalName: "favorite.png",
		MIMEType:     "image/png",
		Data:         []byte("favorite image"),
	})
	if err != nil {
		t.Fatalf("create image: %v", err)
	}
	if attachment.Favorite {
		t.Fatal("new image should not be favorite by default")
	}

	if err := service.SetFavorite(attachment.ID, true); err != nil {
		t.Fatalf("set image favorite: %v", err)
	}

	items, err := service.ListImages()
	if err != nil {
		t.Fatalf("list images: %v", err)
	}
	if len(items) != 1 || !items[0].Favorite {
		t.Fatalf("listed favorite = %#v, want one favorite image", items)
	}

	if err := service.SetFavorite(attachment.ID, false); err != nil {
		t.Fatalf("unset image favorite: %v", err)
	}
	items, err = service.ListImages()
	if err != nil {
		t.Fatalf("list images after unset: %v", err)
	}
	if len(items) != 1 || items[0].Favorite {
		t.Fatalf("listed favorite after unset = %#v, want one non-favorite image", items)
	}
}
