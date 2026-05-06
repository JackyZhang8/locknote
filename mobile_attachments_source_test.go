package main

import (
	"os"
	"strings"
	"testing"
)

func TestMobileExportsAttachmentAPIs(t *testing.T) {
	sourceBytes, err := os.ReadFile("mobile/mobile.go")
	if err != nil {
		t.Fatalf("read mobile source: %v", err)
	}
	source := string(sourceBytes)

	for _, functionName := range []string{
		"CreateImageFromDataURL",
		"GetAttachmentDataURL",
		"GetAttachmentThumbnailDataURL",
		"ListAttachments",
		"ListDeletedAttachments",
		"SoftDeleteAttachment",
		"RestoreAttachment",
		"DeleteAttachment",
		"SetAttachmentFavorite",
		"AttachAttachmentToNote",
		"DetachAttachmentFromNote",
	} {
		if !strings.Contains(source, "func "+functionName+"(") {
			t.Fatalf("mobile API %s is not exported", functionName)
		}
	}
	if !strings.Contains(source, "coreInstance.Attachments().CreateImageFromDataURL") {
		t.Fatal("mobile image creation should use shared attachment service data URL logic")
	}
	if !strings.Contains(source, "coreInstance.Attachments().GetThumbnailDataURL") {
		t.Fatal("mobile thumbnail lookup should use shared attachment service thumbnail logic")
	}
	if !strings.Contains(source, "coreInstance.Attachments().SoftDelete") {
		t.Fatal("mobile soft delete should use shared attachment service trash logic")
	}
	if !strings.Contains(source, "coreInstance.Attachments().Restore") {
		t.Fatal("mobile restore should use shared attachment service trash logic")
	}
}
