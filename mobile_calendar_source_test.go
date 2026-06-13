package main

import (
	"os"
	"strings"
	"testing"
)

func TestMobileExportsCalendarAPIs(t *testing.T) {
	sourceBytes, err := os.ReadFile("mobile/mobile.go")
	if err != nil {
		t.Fatalf("read mobile source: %v", err)
	}
	source := string(sourceBytes)

	for _, functionName := range []string{
		"CreateNote",
		"CreateTodo",
		"GetNote",
		"GetTodo",
		"ListNotes",
		"ListTodos",
	} {
		if !strings.Contains(source, "func "+functionName+"(") {
			t.Fatalf("mobile calendar API %s is not exported", functionName)
		}
	}
}
