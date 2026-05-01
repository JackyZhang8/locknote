package todos

import (
	"encoding/json"
	"path/filepath"
	"testing"
	"time"

	"locknote/internal/crypto"
	"locknote/internal/database"
)

func TestTodoServiceCreatesStandaloneTodosAndSubtasks(t *testing.T) {
	tempDir := t.TempDir()

	db, err := database.New(filepath.Join(tempDir, "locknote-test.db"))
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer db.Close()

	dataKey := crypto.NewService().DeriveDataKey("TODO-TEST-KEY")

	todoService := NewService(db)
	todoService.SetMasterKey(dataKey)

	dueAt := time.Date(2026, 4, 30, 12, 0, 0, 0, time.UTC)
	todo, err := todoService.Create(CreateTodoInput{
		Title:    "Pay bills",
		Priority: PriorityHigh,
		DueAt:    &dueAt,
	})
	if err != nil {
		t.Fatalf("create todo: %v", err)
	}

	if todo.Title != "Pay bills" {
		t.Fatalf("unexpected todo title: %q", todo.Title)
	}
	if todo.Priority != PriorityHigh {
		t.Fatalf("unexpected priority: %q", todo.Priority)
	}

	subtask, err := todoService.CreateSubtask(todo.ID, "Check account balance")
	if err != nil {
		t.Fatalf("create subtask: %v", err)
	}
	if subtask.Title != "Check account balance" {
		t.Fatalf("unexpected subtask title: %q", subtask.Title)
	}

	updated, err := todoService.SetCompleted(todo.ID, true)
	if err != nil {
		t.Fatalf("complete todo: %v", err)
	}
	if !updated.Completed {
		t.Fatalf("todo should be completed")
	}
	if updated.CompletedAt == nil {
		t.Fatalf("completed todo should have completedAt")
	}

	loaded, err := todoService.Get(todo.ID)
	if err != nil {
		t.Fatalf("get todo: %v", err)
	}
	if len(loaded.Subtasks) != 1 {
		t.Fatalf("expected 1 subtask, got %d", len(loaded.Subtasks))
	}
}

func TestTodoServiceReturnsStandaloneTodoPayload(t *testing.T) {
	tempDir := t.TempDir()

	db, err := database.New(filepath.Join(tempDir, "locknote-test.db"))
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer db.Close()

	todoService := NewService(db)
	todoService.SetMasterKey(crypto.NewService().DeriveDataKey("TODO-TEST-KEY"))

	todo, err := todoService.Create(CreateTodoInput{
		Title:    "Standalone",
		Priority: PriorityMedium,
	})
	if err != nil {
		t.Fatalf("create todo: %v", err)
	}

	if todo.Subtasks == nil {
		t.Fatalf("subtasks should be an empty slice, got nil")
	}
	payload, err := json.Marshal(todo)
	if err != nil {
		t.Fatalf("marshal todo: %v", err)
	}
	var raw map[string]any
	if err := json.Unmarshal(payload, &raw); err != nil {
		t.Fatalf("unmarshal todo payload: %v", err)
	}
	if raw["subtasks"] == nil {
		t.Fatalf("subtasks should marshal as [], got null in %s", payload)
	}
	if _, ok := raw["noteIds"]; ok {
		t.Fatalf("standalone todo payload should not expose noteIds: %s", payload)
	}
	if _, ok := raw["projectId"]; ok {
		t.Fatalf("standalone todo payload should not expose projectId: %s", payload)
	}
}

func TestTodoServiceListsNewestTodosFirst(t *testing.T) {
	tempDir := t.TempDir()

	db, err := database.New(filepath.Join(tempDir, "locknote-test.db"))
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer db.Close()

	todoService := NewService(db)
	todoService.SetMasterKey(crypto.NewService().DeriveDataKey("TODO-TEST-KEY"))

	first, err := todoService.Create(CreateTodoInput{
		Title:    "First",
		Priority: PriorityMedium,
	})
	if err != nil {
		t.Fatalf("create first todo: %v", err)
	}
	second, err := todoService.Create(CreateTodoInput{
		Title:    "Second",
		Priority: PriorityMedium,
	})
	if err != nil {
		t.Fatalf("create second todo: %v", err)
	}

	listed, err := todoService.List()
	if err != nil {
		t.Fatalf("list todos: %v", err)
	}
	if len(listed) != 2 {
		t.Fatalf("expected 2 todos, got %d", len(listed))
	}
	if listed[0].ID != second.ID {
		t.Fatalf("newest todo should be first, got %q before %q", listed[0].Title, second.Title)
	}
	if listed[1].ID != first.ID {
		t.Fatalf("oldest todo should be second, got %q before %q", listed[1].Title, first.Title)
	}
}
