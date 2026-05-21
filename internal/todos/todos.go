package todos

import (
	"errors"
	"locknote/internal/crypto"
	"locknote/internal/database"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

const (
	PriorityLow    = "low"
	PriorityMedium = "medium"
	PriorityHigh   = "high"
)

type Service struct {
	db        *database.DB
	crypto    *crypto.Service
	masterKey []byte
	mu        sync.RWMutex
}

type Subtask struct {
	ID          string  `json:"id"`
	TodoID      string  `json:"todoId"`
	Title       string  `json:"title"`
	Completed   bool    `json:"completed"`
	SortOrder   int     `json:"sortOrder"`
	CreatedAt   string  `json:"createdAt"`
	UpdatedAt   string  `json:"updatedAt"`
	CompletedAt *string `json:"completedAt,omitempty"`
}

type Todo struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	Completed   bool      `json:"completed"`
	Priority    string    `json:"priority"`
	DueAt       *string   `json:"dueAt,omitempty"`
	SortOrder   int       `json:"sortOrder"`
	CreatedAt   string    `json:"createdAt"`
	UpdatedAt   string    `json:"updatedAt"`
	CompletedAt *string   `json:"completedAt,omitempty"`
	Subtasks    []Subtask `json:"subtasks"`
}

type CreateTodoInput struct {
	Title    string
	Priority string
	DueAt    *time.Time
}

type UpdateTodoInput struct {
	ID       string
	Title    string
	Priority string
	DueAt    *time.Time
}

func NewService(db *database.DB) *Service {
	return &Service{
		db:     db,
		crypto: crypto.NewService(),
	}
}

func formatTime(t time.Time) string {
	return t.Format(time.RFC3339Nano)
}

func formatTimePtr(t *time.Time) *string {
	if t == nil {
		return nil
	}
	text := t.Format(time.RFC3339Nano)
	return &text
}

func (s *Service) SetMasterKey(key []byte) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.masterKey != nil {
		for i := range s.masterKey {
			s.masterKey[i] = 0
		}
	}
	s.masterKey = key
}

func (s *Service) getMasterKey() ([]byte, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if s.masterKey == nil {
		return nil, errors.New("not unlocked")
	}
	return s.masterKey, nil
}

func normalizePriority(priority string) string {
	switch priority {
	case PriorityLow, PriorityMedium, PriorityHigh:
		return priority
	default:
		return PriorityMedium
	}
}

func trimTitle(title string) string {
	return strings.TrimSpace(title)
}

func (s *Service) encryptTitle(key []byte, title string) ([]byte, error) {
	return s.crypto.Encrypt(key, []byte(title))
}

func (s *Service) decryptTitle(key []byte, encrypted []byte) (string, error) {
	plaintext, err := s.crypto.Decrypt(key, encrypted)
	if err != nil {
		return "", err
	}
	return string(plaintext), nil
}

func (s *Service) subtaskFromMeta(key []byte, subtask *database.TodoSubtaskMeta) (Subtask, error) {
	title, err := s.decryptTitle(key, subtask.EncryptedTitle)
	if err != nil {
		return Subtask{}, err
	}
	return Subtask{
		ID:          subtask.ID,
		TodoID:      subtask.TodoID,
		Title:       title,
		Completed:   subtask.Completed,
		SortOrder:   subtask.SortOrder,
		CreatedAt:   formatTime(subtask.CreatedAt),
		UpdatedAt:   formatTime(subtask.UpdatedAt),
		CompletedAt: formatTimePtr(subtask.CompletedAt),
	}, nil
}

func (s *Service) todoFromMeta(key []byte, meta *database.TodoMeta) (*Todo, error) {
	title, err := s.decryptTitle(key, meta.EncryptedTitle)
	if err != nil {
		return nil, err
	}

	subtaskMetas, err := s.db.ListTodoSubtasks(meta.ID)
	if err != nil {
		return nil, err
	}
	subtasks := make([]Subtask, 0, len(subtaskMetas))
	for _, subtaskMeta := range subtaskMetas {
		subtask, err := s.subtaskFromMeta(key, subtaskMeta)
		if err != nil {
			return nil, err
		}
		subtasks = append(subtasks, subtask)
	}

	return &Todo{
		ID:          meta.ID,
		Title:       title,
		Completed:   meta.Completed,
		Priority:    meta.Priority,
		DueAt:       formatTimePtr(meta.DueAt),
		SortOrder:   meta.SortOrder,
		CreatedAt:   formatTime(meta.CreatedAt),
		UpdatedAt:   formatTime(meta.UpdatedAt),
		CompletedAt: formatTimePtr(meta.CompletedAt),
		Subtasks:    subtasks,
	}, nil
}

func (s *Service) Create(input CreateTodoInput) (*Todo, error) {
	key, err := s.getMasterKey()
	if err != nil {
		return nil, err
	}

	title := trimTitle(input.Title)
	if title == "" {
		return nil, errors.New("todo title is required")
	}

	encryptedTitle, err := s.encryptTitle(key, title)
	if err != nil {
		return nil, err
	}

	sortOrder, err := s.db.GetNextTodoSortOrder()
	if err != nil {
		sortOrder = 0
	}

	now := time.Now()
	meta := &database.TodoMeta{
		ID:             uuid.New().String(),
		EncryptedTitle: encryptedTitle,
		Completed:      false,
		Priority:       normalizePriority(input.Priority),
		DueAt:          input.DueAt,
		SortOrder:      sortOrder,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	if err := s.db.CreateTodo(meta); err != nil {
		return nil, err
	}

	return s.Get(meta.ID)
}

func (s *Service) Update(input UpdateTodoInput) (*Todo, error) {
	key, err := s.getMasterKey()
	if err != nil {
		return nil, err
	}

	meta, err := s.db.GetTodo(input.ID)
	if err != nil {
		return nil, err
	}

	title := trimTitle(input.Title)
	if title == "" {
		return nil, errors.New("todo title is required")
	}

	encryptedTitle, err := s.encryptTitle(key, title)
	if err != nil {
		return nil, err
	}

	meta.EncryptedTitle = encryptedTitle
	meta.Priority = normalizePriority(input.Priority)
	meta.DueAt = input.DueAt
	meta.UpdatedAt = time.Now()

	if err := s.db.UpdateTodo(meta); err != nil {
		return nil, err
	}
	return s.Get(meta.ID)
}

func (s *Service) SetCompleted(id string, completed bool) (*Todo, error) {
	meta, err := s.db.GetTodo(id)
	if err != nil {
		return nil, err
	}
	meta.Completed = completed
	meta.UpdatedAt = time.Now()
	if completed {
		now := time.Now()
		meta.CompletedAt = &now
	} else {
		meta.CompletedAt = nil
	}
	if err := s.db.UpdateTodo(meta); err != nil {
		return nil, err
	}
	return s.Get(id)
}

func (s *Service) Delete(id string) error {
	return s.db.DeleteTodo(id)
}

func (s *Service) Get(id string) (*Todo, error) {
	key, err := s.getMasterKey()
	if err != nil {
		return nil, err
	}
	meta, err := s.db.GetTodo(id)
	if err != nil {
		return nil, err
	}
	return s.todoFromMeta(key, meta)
}

func (s *Service) List() ([]*Todo, error) {
	key, err := s.getMasterKey()
	if err != nil {
		return nil, err
	}
	metas, err := s.db.ListTodos()
	if err != nil {
		return nil, err
	}
	todos := make([]*Todo, 0, len(metas))
	for _, meta := range metas {
		todo, err := s.todoFromMeta(key, meta)
		if err != nil {
			return nil, err
		}
		todos = append(todos, todo)
	}
	return todos, nil
}

func (s *Service) CreateSubtask(todoID, title string) (*Subtask, error) {
	key, err := s.getMasterKey()
	if err != nil {
		return nil, err
	}
	trimmedTitle := trimTitle(title)
	if trimmedTitle == "" {
		return nil, errors.New("subtask title is required")
	}

	encryptedTitle, err := s.encryptTitle(key, trimmedTitle)
	if err != nil {
		return nil, err
	}

	sortOrder, err := s.db.GetNextTodoSubtaskSortOrder(todoID)
	if err != nil {
		sortOrder = 0
	}

	now := time.Now()
	subtask := &database.TodoSubtaskMeta{
		ID:             uuid.New().String(),
		TodoID:         todoID,
		EncryptedTitle: encryptedTitle,
		Completed:      false,
		SortOrder:      sortOrder,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	if err := s.db.CreateTodoSubtask(subtask); err != nil {
		return nil, err
	}

	result, err := s.subtaskFromMeta(key, subtask)
	if err != nil {
		return nil, err
	}
	return &result, nil
}

func (s *Service) UpdateSubtask(id, title string) (*Subtask, error) {
	key, err := s.getMasterKey()
	if err != nil {
		return nil, err
	}
	subtask, err := s.db.GetTodoSubtask(id)
	if err != nil {
		return nil, err
	}
	trimmedTitle := trimTitle(title)
	if trimmedTitle == "" {
		return nil, errors.New("subtask title is required")
	}
	encryptedTitle, err := s.encryptTitle(key, trimmedTitle)
	if err != nil {
		return nil, err
	}
	subtask.EncryptedTitle = encryptedTitle
	subtask.UpdatedAt = time.Now()
	if err := s.db.UpdateTodoSubtask(subtask); err != nil {
		return nil, err
	}
	result, err := s.subtaskFromMeta(key, subtask)
	if err != nil {
		return nil, err
	}
	return &result, nil
}

func (s *Service) SetSubtaskCompleted(id string, completed bool) (*Subtask, error) {
	key, err := s.getMasterKey()
	if err != nil {
		return nil, err
	}
	subtask, err := s.db.GetTodoSubtask(id)
	if err != nil {
		return nil, err
	}
	subtask.Completed = completed
	subtask.UpdatedAt = time.Now()
	if completed {
		now := time.Now()
		subtask.CompletedAt = &now
	} else {
		subtask.CompletedAt = nil
	}
	if err := s.db.UpdateTodoSubtask(subtask); err != nil {
		return nil, err
	}
	result, err := s.subtaskFromMeta(key, subtask)
	if err != nil {
		return nil, err
	}
	return &result, nil
}

func (s *Service) DeleteSubtask(id string) error {
	return s.db.DeleteTodoSubtask(id)
}
