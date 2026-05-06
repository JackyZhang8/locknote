package mobile

import (
	"encoding/json"
	"testing"
)

type mobileTodo struct {
	ID        string          `json:"id"`
	Title     string          `json:"title"`
	Completed bool            `json:"completed"`
	Priority  string          `json:"priority"`
	DueAt     *string         `json:"dueAt"`
	Subtasks  []mobileSubtask `json:"subtasks"`
}

type mobileSubtask struct {
	ID        string `json:"id"`
	TodoID    string `json:"todoId"`
	Title     string `json:"title"`
	Completed bool   `json:"completed"`
}

func TestMobileTodoAPIsUseSharedCore(t *testing.T) {
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

	createdJSON, err := CreateTodo("Pay bills", "high", "2026-05-02")
	if err != nil {
		t.Fatalf("create todo: %v", err)
	}
	var created mobileTodo
	if err := json.Unmarshal([]byte(createdJSON), &created); err != nil {
		t.Fatalf("unmarshal created todo: %v", err)
	}
	if created.ID == "" || created.Title != "Pay bills" || created.Priority != "high" || created.Completed {
		t.Fatalf("created todo = %#v", created)
	}
	if created.DueAt == nil {
		t.Fatal("created todo should include dueAt")
	}

	subtaskJSON, err := CreateTodoSubtask(created.ID, "Check account")
	if err != nil {
		t.Fatalf("create subtask: %v", err)
	}
	var subtask mobileSubtask
	if err := json.Unmarshal([]byte(subtaskJSON), &subtask); err != nil {
		t.Fatalf("unmarshal created subtask: %v", err)
	}
	if subtask.ID == "" || subtask.TodoID != created.ID || subtask.Title != "Check account" {
		t.Fatalf("created subtask = %#v", subtask)
	}

	if _, err := SetTodoSubtaskCompleted(subtask.ID, true); err != nil {
		t.Fatalf("complete subtask: %v", err)
	}
	updatedJSON, err := SetTodoCompleted(created.ID, true)
	if err != nil {
		t.Fatalf("complete todo: %v", err)
	}
	var updated mobileTodo
	if err := json.Unmarshal([]byte(updatedJSON), &updated); err != nil {
		t.Fatalf("unmarshal completed todo: %v", err)
	}
	if !updated.Completed {
		t.Fatalf("updated todo = %#v, want completed", updated)
	}

	listJSON, err := ListTodos()
	if err != nil {
		t.Fatalf("list todos: %v", err)
	}
	var listed []mobileTodo
	if err := json.Unmarshal([]byte(listJSON), &listed); err != nil {
		t.Fatalf("unmarshal listed todos: %v", err)
	}
	if len(listed) != 1 || listed[0].ID != created.ID || len(listed[0].Subtasks) != 1 || !listed[0].Subtasks[0].Completed {
		t.Fatalf("listed todos = %#v", listed)
	}

	if err := DeleteTodoSubtask(subtask.ID); err != nil {
		t.Fatalf("delete subtask: %v", err)
	}
	if err := DeleteTodo(created.ID); err != nil {
		t.Fatalf("delete todo: %v", err)
	}
	listJSON, err = ListTodos()
	if err != nil {
		t.Fatalf("list todos after delete: %v", err)
	}
	listed = nil
	if err := json.Unmarshal([]byte(listJSON), &listed); err != nil {
		t.Fatalf("unmarshal listed todos after delete: %v", err)
	}
	if len(listed) != 0 {
		t.Fatalf("listed todos after delete = %#v, want empty", listed)
	}
}
