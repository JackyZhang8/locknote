package attachments

import (
	"bytes"
	"strings"
	"testing"
)

func TestImageUploadLimitsAreCheckedBeforeDecodeOrWrite(t *testing.T) {
	originalLimit := maxImageBytes
	maxImageBytes = 3
	t.Cleanup(func() { maxImageBytes = originalLimit })

	if _, _, err := ParseImageDataURL("data:image/png;base64," + strings.Repeat("A", maxImageBytes*4/3+17)); err == nil {
		t.Fatal("expected oversized base64 payload to be rejected")
	}

	service := NewService(nil, "")
	service.SetMasterKey(bytes.Repeat([]byte{1}, 32))
	if _, err := service.CreateImage(CreateImageInput{MIMEType: "image/png", Data: []byte{1, 2, 3, 4}}); err == nil {
		t.Fatal("expected oversized image bytes to be rejected")
	}
}
