package database

import "time"

type TodoMeta struct {
	ID             string
	EncryptedTitle []byte
	Completed      bool
	Priority       string
	DueAt          *time.Time
	SortOrder      int
	CreatedAt      time.Time
	UpdatedAt      time.Time
	CompletedAt    *time.Time
}

type TodoSubtaskMeta struct {
	ID             string
	TodoID         string
	EncryptedTitle []byte
	Completed      bool
	SortOrder      int
	CreatedAt      time.Time
	UpdatedAt      time.Time
	CompletedAt    *time.Time
}

func (d *DB) ensureTodoSchema() error {
	schema := `
	CREATE TABLE IF NOT EXISTS todo_projects (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		sort_order INTEGER DEFAULT 0,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS todos (
		id TEXT PRIMARY KEY,
		project_id TEXT REFERENCES todo_projects(id) ON DELETE SET NULL,
		encrypted_title BLOB NOT NULL,
		completed INTEGER DEFAULT 0,
		priority TEXT NOT NULL DEFAULT 'medium',
		due_at DATETIME,
		sort_order INTEGER DEFAULT 0,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		completed_at DATETIME
	);

	CREATE TABLE IF NOT EXISTS todo_subtasks (
		id TEXT PRIMARY KEY,
		todo_id TEXT NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
		encrypted_title BLOB NOT NULL,
		completed INTEGER DEFAULT 0,
		sort_order INTEGER DEFAULT 0,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		completed_at DATETIME
	);

	CREATE TABLE IF NOT EXISTS todo_note_links (
		todo_id TEXT NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
		note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
		sort_order INTEGER DEFAULT 0,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		PRIMARY KEY (todo_id, note_id)
	);

	CREATE INDEX IF NOT EXISTS idx_todo_projects_sort_order ON todo_projects(sort_order);
	CREATE INDEX IF NOT EXISTS idx_todos_project_id ON todos(project_id);
	CREATE INDEX IF NOT EXISTS idx_todos_completed ON todos(completed);
	CREATE INDEX IF NOT EXISTS idx_todos_sort_order ON todos(sort_order);
	CREATE INDEX IF NOT EXISTS idx_todos_due_at ON todos(due_at);
	CREATE INDEX IF NOT EXISTS idx_todo_subtasks_todo_id ON todo_subtasks(todo_id);
	CREATE INDEX IF NOT EXISTS idx_todo_subtasks_sort_order ON todo_subtasks(todo_id, sort_order);
	CREATE INDEX IF NOT EXISTS idx_todo_note_links_note_id ON todo_note_links(note_id);
	CREATE INDEX IF NOT EXISTS idx_todo_note_links_sort_order ON todo_note_links(todo_id, sort_order);
	`

	_, err := d.db.Exec(schema)
	return err
}

func nullableTimePtr(value any) (*time.Time, error) {
	if value == nil {
		return nil, nil
	}
	parsed, err := parseSQLiteTime(value)
	if err != nil {
		return nil, err
	}
	return &parsed, nil
}

func (d *DB) CreateTodo(todo *TodoMeta) error {
	_, err := d.db.Exec(`
		INSERT INTO todos (id, encrypted_title, completed, priority, due_at, sort_order, created_at, updated_at, completed_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, todo.ID, todo.EncryptedTitle, boolToInt(todo.Completed), todo.Priority, todo.DueAt, todo.SortOrder, todo.CreatedAt, todo.UpdatedAt, todo.CompletedAt)
	return err
}

func (d *DB) UpdateTodo(todo *TodoMeta) error {
	_, err := d.db.Exec(`
		UPDATE todos
		SET encrypted_title = ?, completed = ?, priority = ?, due_at = ?, sort_order = ?, updated_at = ?, completed_at = ?
		WHERE id = ?
	`, todo.EncryptedTitle, boolToInt(todo.Completed), todo.Priority, todo.DueAt, todo.SortOrder, todo.UpdatedAt, todo.CompletedAt, todo.ID)
	return err
}

func (d *DB) DeleteTodo(id string) error {
	_, err := d.db.Exec(`DELETE FROM todos WHERE id = ?`, id)
	return err
}

func (d *DB) GetTodo(id string) (*TodoMeta, error) {
	var todo TodoMeta
	var dueAtAny any
	var createdAtAny any
	var updatedAtAny any
	var completedAtAny any
	var completedInt int
	err := d.db.QueryRow(`
		SELECT id, encrypted_title, COALESCE(completed, 0), priority, due_at, COALESCE(sort_order, 0), created_at, updated_at, completed_at
		FROM todos
		WHERE id = ?
	`, id).Scan(&todo.ID, &todo.EncryptedTitle, &completedInt, &todo.Priority, &dueAtAny, &todo.SortOrder, &createdAtAny, &updatedAtAny, &completedAtAny)
	if err != nil {
		return nil, err
	}
	todo.Completed = completedInt != 0
	if todo.DueAt, err = nullableTimePtr(dueAtAny); err != nil {
		return nil, err
	}
	if todo.CreatedAt, err = parseSQLiteTime(createdAtAny); err != nil {
		return nil, err
	}
	if todo.UpdatedAt, err = parseSQLiteTime(updatedAtAny); err != nil {
		return nil, err
	}
	if todo.CompletedAt, err = nullableTimePtr(completedAtAny); err != nil {
		return nil, err
	}
	return &todo, nil
}

func (d *DB) ListTodos() ([]*TodoMeta, error) {
	rows, err := d.db.Query(`
		SELECT id, encrypted_title, COALESCE(completed, 0), priority, due_at, COALESCE(sort_order, 0), created_at, updated_at, completed_at
		FROM todos
		ORDER BY COALESCE(completed, 0) ASC, sort_order DESC, created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var todos []*TodoMeta
	for rows.Next() {
		var todo TodoMeta
		var dueAtAny any
		var createdAtAny any
		var updatedAtAny any
		var completedAtAny any
		var completedInt int
		if err := rows.Scan(&todo.ID, &todo.EncryptedTitle, &completedInt, &todo.Priority, &dueAtAny, &todo.SortOrder, &createdAtAny, &updatedAtAny, &completedAtAny); err != nil {
			return nil, err
		}
		todo.Completed = completedInt != 0
		if todo.DueAt, err = nullableTimePtr(dueAtAny); err != nil {
			return nil, err
		}
		if todo.CreatedAt, err = parseSQLiteTime(createdAtAny); err != nil {
			return nil, err
		}
		if todo.UpdatedAt, err = parseSQLiteTime(updatedAtAny); err != nil {
			return nil, err
		}
		if todo.CompletedAt, err = nullableTimePtr(completedAtAny); err != nil {
			return nil, err
		}
		todos = append(todos, &todo)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return todos, nil
}

func (d *DB) GetNextTodoSortOrder() (int, error) {
	var next int
	err := d.db.QueryRow(`SELECT COALESCE(MAX(sort_order), -1) + 1 FROM todos`).Scan(&next)
	return next, err
}

func (d *DB) CreateTodoSubtask(subtask *TodoSubtaskMeta) error {
	_, err := d.db.Exec(`
		INSERT INTO todo_subtasks (id, todo_id, encrypted_title, completed, sort_order, created_at, updated_at, completed_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, subtask.ID, subtask.TodoID, subtask.EncryptedTitle, boolToInt(subtask.Completed), subtask.SortOrder, subtask.CreatedAt, subtask.UpdatedAt, subtask.CompletedAt)
	return err
}

func (d *DB) UpdateTodoSubtask(subtask *TodoSubtaskMeta) error {
	_, err := d.db.Exec(`
		UPDATE todo_subtasks
		SET encrypted_title = ?, completed = ?, sort_order = ?, updated_at = ?, completed_at = ?
		WHERE id = ?
	`, subtask.EncryptedTitle, boolToInt(subtask.Completed), subtask.SortOrder, subtask.UpdatedAt, subtask.CompletedAt, subtask.ID)
	return err
}

func (d *DB) DeleteTodoSubtask(id string) error {
	_, err := d.db.Exec(`DELETE FROM todo_subtasks WHERE id = ?`, id)
	return err
}

func (d *DB) GetTodoSubtask(id string) (*TodoSubtaskMeta, error) {
	var subtask TodoSubtaskMeta
	var createdAtAny any
	var updatedAtAny any
	var completedAtAny any
	var completedInt int
	err := d.db.QueryRow(`
		SELECT id, todo_id, encrypted_title, COALESCE(completed, 0), COALESCE(sort_order, 0), created_at, updated_at, completed_at
		FROM todo_subtasks
		WHERE id = ?
	`, id).Scan(&subtask.ID, &subtask.TodoID, &subtask.EncryptedTitle, &completedInt, &subtask.SortOrder, &createdAtAny, &updatedAtAny, &completedAtAny)
	if err != nil {
		return nil, err
	}
	subtask.Completed = completedInt != 0
	if subtask.CreatedAt, err = parseSQLiteTime(createdAtAny); err != nil {
		return nil, err
	}
	if subtask.UpdatedAt, err = parseSQLiteTime(updatedAtAny); err != nil {
		return nil, err
	}
	if subtask.CompletedAt, err = nullableTimePtr(completedAtAny); err != nil {
		return nil, err
	}
	return &subtask, nil
}

func (d *DB) ListTodoSubtasks(todoID string) ([]*TodoSubtaskMeta, error) {
	rows, err := d.db.Query(`
		SELECT id, todo_id, encrypted_title, COALESCE(completed, 0), COALESCE(sort_order, 0), created_at, updated_at, completed_at
		FROM todo_subtasks
		WHERE todo_id = ?
		ORDER BY COALESCE(completed, 0) ASC, sort_order ASC, created_at ASC
	`, todoID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var subtasks []*TodoSubtaskMeta
	for rows.Next() {
		var subtask TodoSubtaskMeta
		var createdAtAny any
		var updatedAtAny any
		var completedAtAny any
		var completedInt int
		if err := rows.Scan(&subtask.ID, &subtask.TodoID, &subtask.EncryptedTitle, &completedInt, &subtask.SortOrder, &createdAtAny, &updatedAtAny, &completedAtAny); err != nil {
			return nil, err
		}
		subtask.Completed = completedInt != 0
		if subtask.CreatedAt, err = parseSQLiteTime(createdAtAny); err != nil {
			return nil, err
		}
		if subtask.UpdatedAt, err = parseSQLiteTime(updatedAtAny); err != nil {
			return nil, err
		}
		if subtask.CompletedAt, err = nullableTimePtr(completedAtAny); err != nil {
			return nil, err
		}
		subtasks = append(subtasks, &subtask)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return subtasks, nil
}

func (d *DB) GetNextTodoSubtaskSortOrder(todoID string) (int, error) {
	var next int
	err := d.db.QueryRow(`SELECT COALESCE(MAX(sort_order), -1) + 1 FROM todo_subtasks WHERE todo_id = ?`, todoID).Scan(&next)
	return next, err
}
