package attachments_test

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"image"
	"image/color"
	"image/jpeg"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"locknote/internal/attachments"
	"locknote/internal/database"
)

func testImageJPEG(t *testing.T, width, height int) []byte {
	t.Helper()

	img := image.NewRGBA(image.Rect(0, 0, width, height))
	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			img.SetRGBA(x, y, color.RGBA{
				R: uint8((x * 13) % 255),
				G: uint8((y * 17) % 255),
				B: uint8(((x + y) * 19) % 255),
				A: 255,
			})
		}
	}

	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: 95}); err != nil {
		t.Fatalf("encode jpeg: %v", err)
	}
	return buf.Bytes()
}

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

func TestServiceCreatesEncryptedImageThumbnailDataURL(t *testing.T) {
	dataDir := t.TempDir()
	db, err := database.New(filepath.Join(dataDir, "locknote.db"))
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	defer db.Close()

	service := attachments.NewService(db, dataDir)
	service.SetMasterKey(bytes.Repeat([]byte{8}, 32))

	imageBytes := testImageJPEG(t, 1600, 1200)
	attachment, err := service.CreateImage(attachments.CreateImageInput{
		OriginalName: "large.jpg",
		MIMEType:     "image/jpeg",
		Data:         imageBytes,
	})
	if err != nil {
		t.Fatalf("create image: %v", err)
	}

	thumbnailDataURL, err := service.GetThumbnailDataURL(attachment.ID)
	if err != nil {
		t.Fatalf("get thumbnail data url: %v", err)
	}
	const thumbnailPrefix = "data:image/jpeg;base64,"
	if !strings.HasPrefix(thumbnailDataURL, thumbnailPrefix) {
		t.Fatalf("thumbnail data url = %q, want jpeg data url", thumbnailDataURL)
	}
	thumbnailBytes, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(thumbnailDataURL, thumbnailPrefix))
	if err != nil {
		t.Fatalf("decode thumbnail data url: %v", err)
	}
	if len(thumbnailBytes) >= len(imageBytes) {
		t.Fatalf("thumbnail bytes = %d, want smaller than original %d", len(thumbnailBytes), len(imageBytes))
	}

	thumbnailCipherPath := filepath.Join(dataDir, "attachments", attachment.ID[:2], attachment.ID[2:4], attachment.ID+".thumb.enc")
	ciphertext, err := os.ReadFile(thumbnailCipherPath)
	if err != nil {
		t.Fatalf("read encrypted thumbnail: %v", err)
	}
	if bytes.Equal(ciphertext, thumbnailBytes) || bytes.Contains(ciphertext, thumbnailBytes) {
		t.Fatal("thumbnail bytes were written in plaintext")
	}

	originalDataURL, err := service.GetDataURL(attachment.ID)
	if err != nil {
		t.Fatalf("get original data url: %v", err)
	}
	const originalPrefix = "data:image/jpeg;base64,"
	if !strings.HasPrefix(originalDataURL, originalPrefix) {
		t.Fatalf("original data url = %q, want jpeg data url", originalDataURL)
	}
	originalBytes, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(originalDataURL, originalPrefix))
	if err != nil {
		t.Fatalf("decode original data url: %v", err)
	}
	if !bytes.Equal(originalBytes, imageBytes) {
		t.Fatal("thumbnail generation changed original image bytes")
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

func TestServiceSoftDeletesRestoresAndPermanentlyDeletesImages(t *testing.T) {
	dataDir := t.TempDir()
	db, err := database.New(filepath.Join(dataDir, "locknote.db"))
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	defer db.Close()

	service := attachments.NewService(db, dataDir)
	service.SetMasterKey(bytes.Repeat([]byte{4}, 32))

	imageBytes := testImageJPEG(t, 800, 600)
	attachment, err := service.CreateImage(attachments.CreateImageInput{
		OriginalName: "trash.jpg",
		MIMEType:     "image/jpeg",
		Data:         imageBytes,
	})
	if err != nil {
		t.Fatalf("create image: %v", err)
	}
	if attachment.DeletedAt != nil {
		t.Fatalf("new attachment deletedAt = %v, want nil", attachment.DeletedAt)
	}

	if err := service.SoftDelete(attachment.ID); err != nil {
		t.Fatalf("soft delete image: %v", err)
	}

	active, err := service.ListImages()
	if err != nil {
		t.Fatalf("list active images: %v", err)
	}
	if len(active) != 0 {
		t.Fatalf("active images after soft delete = %#v, want empty", active)
	}

	deleted, err := service.ListDeletedImages()
	if err != nil {
		t.Fatalf("list deleted images: %v", err)
	}
	if len(deleted) != 1 || deleted[0].ID != attachment.ID || deleted[0].DeletedAt == nil {
		t.Fatalf("deleted images = %#v, want deleted attachment with deletedAt", deleted)
	}

	dataURL, err := service.GetDataURL(attachment.ID)
	if err != nil {
		t.Fatalf("soft deleted image should remain readable until permanent delete: %v", err)
	}
	if !strings.HasPrefix(dataURL, "data:image/jpeg;base64,") {
		t.Fatalf("soft deleted data url = %q, want jpeg data url", dataURL)
	}

	if err := service.Restore(attachment.ID); err != nil {
		t.Fatalf("restore image: %v", err)
	}
	active, err = service.ListImages()
	if err != nil {
		t.Fatalf("list active after restore: %v", err)
	}
	if len(active) != 1 || active[0].ID != attachment.ID || active[0].DeletedAt != nil {
		t.Fatalf("active images after restore = %#v, want restored attachment", active)
	}

	if err := service.SoftDelete(attachment.ID); err != nil {
		t.Fatalf("soft delete image before permanent delete: %v", err)
	}
	cipherPath := filepath.Join(dataDir, attachment.CipherPath)
	if err := service.Delete(attachment.ID); err != nil {
		t.Fatalf("permanently delete image: %v", err)
	}
	if _, err := os.Stat(cipherPath); !os.IsNotExist(err) {
		t.Fatalf("expected encrypted file to be removed after permanent delete, stat err=%v", err)
	}
	deleted, err = service.ListDeletedImages()
	if err != nil {
		t.Fatalf("list deleted after permanent delete: %v", err)
	}
	if len(deleted) != 0 {
		t.Fatalf("deleted images after permanent delete = %#v, want empty", deleted)
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

func TestServiceCreatesImageFromDataURL(t *testing.T) {
	dataDir := t.TempDir()
	db, err := database.New(filepath.Join(dataDir, "locknote.db"))
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	defer db.Close()

	service := attachments.NewService(db, dataDir)
	service.SetMasterKey(bytes.Repeat([]byte{3}, 32))

	raw := []byte("shared image data")
	dataURL := "data:image/png;base64," + base64.StdEncoding.EncodeToString(raw)
	attachment, err := service.CreateImageFromDataURL("", "shared.png", dataURL)
	if err != nil {
		t.Fatalf("create image from data url: %v", err)
	}
	if attachment.MIMEType != "image/png" {
		t.Fatalf("mime type = %q, want image/png", attachment.MIMEType)
	}

	nextDataURL, err := service.GetDataURL(attachment.ID)
	if err != nil {
		t.Fatalf("get data url: %v", err)
	}
	if nextDataURL != dataURL {
		t.Fatalf("data url = %q, want %q", nextDataURL, dataURL)
	}

	if _, err := service.CreateImageFromDataURL("", "bad.txt", "data:text/plain;base64,"+base64.StdEncoding.EncodeToString([]byte("no"))); err == nil {
		t.Fatal("expected non-image data url to be rejected")
	}
}

func TestAttachmentJSONIncludesFavorite(t *testing.T) {
	attachment := attachments.Attachment{ID: "image-1", Favorite: true}
	data, err := json.Marshal(attachment)
	if err != nil {
		t.Fatalf("marshal attachment: %v", err)
	}
	if !strings.Contains(string(data), `"favorite":true`) {
		t.Fatalf("attachment json = %s, want favorite field", data)
	}
}
