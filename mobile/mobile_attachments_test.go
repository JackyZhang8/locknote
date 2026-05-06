package mobile

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"image"
	"image/color"
	"image/jpeg"
	"strings"
	"testing"
)

type mobileAttachment struct {
	ID           string `json:"id"`
	OriginalName string `json:"originalName"`
	MIMEType     string `json:"mimeType"`
	Favorite     bool   `json:"favorite"`
}

func mobileTestImageJPEG(t *testing.T, width, height int) []byte {
	t.Helper()

	img := image.NewRGBA(image.Rect(0, 0, width, height))
	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			img.SetRGBA(x, y, color.RGBA{
				R: uint8((x * 7) % 255),
				G: uint8((y * 11) % 255),
				B: uint8(((x + y) * 13) % 255),
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

func TestMobileAttachmentAPIsUseSharedCore(t *testing.T) {
	Close()
	t.Cleanup(Close)

	if err := Init(t.TempDir()); err != nil {
		t.Fatalf("init mobile core: %v", err)
	}
	dataKey, err := GenerateDataKey()
	if err != nil {
		t.Fatalf("generate data key: %v", err)
	}
	if _, err := SetupPassword("password", "", dataKey); err != nil {
		t.Fatalf("setup password: %v", err)
	}

	raw := mobileTestImageJPEG(t, 1200, 900)
	dataURL := "data:image/jpeg;base64," + base64.StdEncoding.EncodeToString(raw)
	createdJSON, err := CreateImageFromDataURL("", "mobile.jpg", dataURL)
	if err != nil {
		t.Fatalf("create image from data url: %v", err)
	}
	var created mobileAttachment
	if err := json.Unmarshal([]byte(createdJSON), &created); err != nil {
		t.Fatalf("unmarshal created attachment: %v", err)
	}
	if created.ID == "" || created.OriginalName != "mobile.jpg" || created.MIMEType != "image/jpeg" || created.Favorite {
		t.Fatalf("created attachment = %#v", created)
	}

	listJSON, err := ListAttachments()
	if err != nil {
		t.Fatalf("list attachments: %v", err)
	}
	var listed []mobileAttachment
	if err := json.Unmarshal([]byte(listJSON), &listed); err != nil {
		t.Fatalf("unmarshal listed attachments: %v", err)
	}
	if len(listed) != 1 || listed[0].ID != created.ID {
		t.Fatalf("listed attachments = %#v", listed)
	}

	if err := SetAttachmentFavorite(created.ID, true); err != nil {
		t.Fatalf("set attachment favorite: %v", err)
	}
	listJSON, err = ListAttachments()
	if err != nil {
		t.Fatalf("list attachments after favorite: %v", err)
	}
	listed = nil
	if err := json.Unmarshal([]byte(listJSON), &listed); err != nil {
		t.Fatalf("unmarshal listed favorite attachments: %v", err)
	}
	if len(listed) != 1 || !listed[0].Favorite {
		t.Fatalf("listed favorite attachments = %#v", listed)
	}

	gotDataURL, err := GetAttachmentDataURL(created.ID)
	if err != nil {
		t.Fatalf("get attachment data url: %v", err)
	}
	if !strings.HasPrefix(gotDataURL, "data:image/jpeg;base64,") {
		t.Fatalf("data url = %q, want jpeg data url", gotDataURL)
	}

	gotThumbnailDataURL, err := GetAttachmentThumbnailDataURL(created.ID)
	if err != nil {
		t.Fatalf("get attachment thumbnail data url: %v", err)
	}
	if !strings.HasPrefix(gotThumbnailDataURL, "data:image/jpeg;base64,") {
		t.Fatalf("thumbnail data url = %q, want jpeg data url", gotThumbnailDataURL)
	}
	if len(gotThumbnailDataURL) >= len(gotDataURL) {
		t.Fatalf("thumbnail data url length = %d, want smaller than original %d", len(gotThumbnailDataURL), len(gotDataURL))
	}

	if err := DeleteAttachment(created.ID); err != nil {
		t.Fatalf("delete attachment: %v", err)
	}
	listJSON, err = ListAttachments()
	if err != nil {
		t.Fatalf("list attachments after delete: %v", err)
	}
	listed = nil
	if err := json.Unmarshal([]byte(listJSON), &listed); err != nil {
		t.Fatalf("unmarshal listed attachments after delete: %v", err)
	}
	if len(listed) != 0 {
		t.Fatalf("listed attachments after delete = %#v, want empty", listed)
	}
}

func TestMobileAttachmentTrashAPIsUseSharedCore(t *testing.T) {
	Close()
	t.Cleanup(Close)

	if err := Init(t.TempDir()); err != nil {
		t.Fatalf("init mobile core: %v", err)
	}
	dataKey, err := GenerateDataKey()
	if err != nil {
		t.Fatalf("generate data key: %v", err)
	}
	if _, err := SetupPassword("password", "", dataKey); err != nil {
		t.Fatalf("setup password: %v", err)
	}

	raw := mobileTestImageJPEG(t, 900, 700)
	dataURL := "data:image/jpeg;base64," + base64.StdEncoding.EncodeToString(raw)
	createdJSON, err := CreateImageFromDataURL("", "trash.jpg", dataURL)
	if err != nil {
		t.Fatalf("create image from data url: %v", err)
	}
	var created mobileAttachment
	if err := json.Unmarshal([]byte(createdJSON), &created); err != nil {
		t.Fatalf("unmarshal created attachment: %v", err)
	}

	if err := SoftDeleteAttachment(created.ID); err != nil {
		t.Fatalf("soft delete attachment: %v", err)
	}

	listJSON, err := ListAttachments()
	if err != nil {
		t.Fatalf("list attachments after soft delete: %v", err)
	}
	var active []mobileAttachment
	if err := json.Unmarshal([]byte(listJSON), &active); err != nil {
		t.Fatalf("unmarshal active attachments: %v", err)
	}
	if len(active) != 0 {
		t.Fatalf("active attachments after soft delete = %#v, want empty", active)
	}

	deletedJSON, err := ListDeletedAttachments()
	if err != nil {
		t.Fatalf("list deleted attachments: %v", err)
	}
	var deleted []mobileAttachment
	if err := json.Unmarshal([]byte(deletedJSON), &deleted); err != nil {
		t.Fatalf("unmarshal deleted attachments: %v", err)
	}
	if len(deleted) != 1 || deleted[0].ID != created.ID {
		t.Fatalf("deleted attachments = %#v", deleted)
	}

	if err := RestoreAttachment(created.ID); err != nil {
		t.Fatalf("restore attachment: %v", err)
	}
	listJSON, err = ListAttachments()
	if err != nil {
		t.Fatalf("list attachments after restore: %v", err)
	}
	active = nil
	if err := json.Unmarshal([]byte(listJSON), &active); err != nil {
		t.Fatalf("unmarshal active after restore: %v", err)
	}
	if len(active) != 1 || active[0].ID != created.ID {
		t.Fatalf("active attachments after restore = %#v", active)
	}

	if err := SoftDeleteAttachment(created.ID); err != nil {
		t.Fatalf("soft delete attachment before delete: %v", err)
	}
	if err := DeleteAttachment(created.ID); err != nil {
		t.Fatalf("delete attachment permanently: %v", err)
	}
	deletedJSON, err = ListDeletedAttachments()
	if err != nil {
		t.Fatalf("list deleted attachments after permanent delete: %v", err)
	}
	deleted = nil
	if err := json.Unmarshal([]byte(deletedJSON), &deleted); err != nil {
		t.Fatalf("unmarshal deleted after permanent delete: %v", err)
	}
	if len(deleted) != 0 {
		t.Fatalf("deleted attachments after permanent delete = %#v, want empty", deleted)
	}
}
