package main

import (
	"os"
	"strings"
	"testing"
)

func TestMobileExportsCollectionAndSmartViewAPIs(t *testing.T) {
	sourceBytes, err := os.ReadFile("mobile/mobile.go")
	if err != nil {
		t.Fatalf("read mobile source: %v", err)
	}
	source := string(sourceBytes)

	for _, functionName := range []string{
		"ReorderNotebooks",
		"SetNotesNotebook",
		"BatchDeleteNotes",
		"BatchAddTagToNotes",
		"ReorderNotes",
		"CreateSmartView",
		"UpdateSmartView",
		"DeleteSmartView",
		"ListSmartViews",
		"GetSmartView",
	} {
		if !strings.Contains(source, "func "+functionName+"(") {
			t.Fatalf("mobile API %s is not exported", functionName)
		}
	}
	if !strings.Contains(source, "coreInstance.Notebooks().ReorderNotebooks") {
		t.Fatal("mobile notebook reorder should use shared notebook service")
	}
	if !strings.Contains(source, "coreInstance.Notes().SetNotesNotebook") {
		t.Fatal("mobile batch notebook assignment should use shared note service")
	}
	if !strings.Contains(source, "coreInstance.Notes().BatchSoftDelete") {
		t.Fatal("mobile batch delete should use shared note service")
	}
	if !strings.Contains(source, "coreInstance.SmartViews().Create") {
		t.Fatal("mobile smart view creation should use shared smart view service")
	}
}
