package main

import (
	"bytes"
	"encoding/base64"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestParseImageDataURL(t *testing.T) {
	raw := []byte("image bytes")
	dataURL := "data:image/png;base64," + base64.StdEncoding.EncodeToString(raw)

	mimeType, data, err := parseImageDataURL(dataURL)
	if err != nil {
		t.Fatalf("parse image data URL: %v", err)
	}
	if mimeType != "image/png" {
		t.Fatalf("mime type = %q, want image/png", mimeType)
	}
	if !bytes.Equal(data, raw) {
		t.Fatalf("data = %q, want %q", data, raw)
	}
}

func TestParseImageDataURLRejectsNonImages(t *testing.T) {
	dataURL := "data:text/plain;base64," + base64.StdEncoding.EncodeToString([]byte("not an image"))

	if _, _, err := parseImageDataURL(dataURL); err == nil {
		t.Fatal("expected non-image data URL to be rejected")
	}
}

func TestFormatAssetsDirNameUsesMinuteTimestamp(t *testing.T) {
	now := time.Date(2026, 5, 1, 18, 38, 44, 0, time.FixedZone("CST", 8*60*60))

	if got := formatAssetsDirName(now); got != "assets_202605011838" {
		t.Fatalf("assets dir name = %q, want assets_202605011838", got)
	}
}

func TestRewriteMarkdownAttachmentLinksUsesRelativeAssetsPath(t *testing.T) {
	content := "![blockcell-logo.png](locknote-attachment://98d30eae-af3c-4651-b6d3-02c23276f386)"
	fileNames := map[string]string{
		"98d30eae-af3c-4651-b6d3-02c23276f386": "blockcell-logo.png",
	}

	rewritten := rewriteMarkdownAttachmentLinks(content, "assets_202605011838", fileNames)

	if rewritten != "![blockcell-logo.png](assets_202605011838/blockcell-logo.png)" {
		t.Fatalf("rewritten markdown = %q", rewritten)
	}
}

func TestCollectAttachmentIDsDeduplicatesInEncounterOrder(t *testing.T) {
	content := strings.Join([]string{
		"![first](locknote-attachment://a)",
		"![second](locknote-attachment://b)",
		"![again](locknote-attachment://a)",
	}, "\n")

	ids := collectAttachmentIDs(content)

	if strings.Join(ids, ",") != "a,b" {
		t.Fatalf("ids = %#v, want [a b]", ids)
	}
}

func TestSanitizeExportImageNameKeepsExtensionAndAvoidsPathTraversal(t *testing.T) {
	got := sanitizeExportImageName(filepath.Join("..", "blockcell logo.png"), "image/png", "98d30eae-af3c-4651-b6d3-02c23276f386")

	if got != "blockcell-logo.png" {
		t.Fatalf("sanitized name = %q, want blockcell-logo.png", got)
	}
}
