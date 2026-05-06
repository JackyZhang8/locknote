package main

import (
	"os"
	"strings"
	"testing"
)

func TestMobileExportsTodoAPIs(t *testing.T) {
	sourceBytes, err := os.ReadFile("mobile/mobile.go")
	if err != nil {
		t.Fatalf("read mobile source: %v", err)
	}
	source := string(sourceBytes)

	for _, functionName := range []string{
		"ListTodos",
		"GetTodo",
		"CreateTodo",
		"UpdateTodo",
		"SetTodoCompleted",
		"DeleteTodo",
		"CreateTodoSubtask",
		"UpdateTodoSubtask",
		"SetTodoSubtaskCompleted",
		"DeleteTodoSubtask",
	} {
		if !strings.Contains(source, "func "+functionName+"(") {
			t.Fatalf("mobile API %s is not exported", functionName)
		}
	}
	if !strings.Contains(source, "coreInstance.Todos().Create") {
		t.Fatal("mobile todo creation should use shared todo service")
	}
}
