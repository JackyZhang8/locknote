// https://github.com/JackyZhang8/locknote
// 一个简单、可靠、离线优先的桌面加密笔记软件。
// A simple, reliable, offline-first encrypted note-taking desktop app.
package tags

import (
	"fmt"
	"locknote/internal/database"

	"github.com/google/uuid"
)

type Service struct {
	db *database.DB
}

type Tag struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Color string `json:"color"`
}

func NewService(db *database.DB) *Service {
	return &Service{db: db}
}

func (s *Service) Create(name, color string) (*Tag, error) {
	if color == "" {
		color = "#10b981"
	}

	tag := &database.Tag{
		ID:    uuid.New().String(),
		Name:  name,
		Color: color,
	}

	if err := s.db.CreateTag(tag); err != nil {
		return nil, err
	}

	return &Tag{
		ID:    tag.ID,
		Name:  tag.Name,
		Color: tag.Color,
	}, nil
}

func (s *Service) Update(id, name, color string) (*Tag, error) {
	tag := &database.Tag{
		ID:    id,
		Name:  name,
		Color: color,
	}

	if err := s.db.UpdateTag(tag); err != nil {
		return nil, err
	}

	return &Tag{
		ID:    tag.ID,
		Name:  tag.Name,
		Color: tag.Color,
	}, nil
}

func (s *Service) Delete(id string) error {
	if err := s.db.DeleteTagWithAssociations(id); err != nil {
		return fmt.Errorf("delete tag failed (id=%s): %w", id, err)
	}
	return nil
}

func (s *Service) List() ([]*Tag, error) {
	dbTags, err := s.db.ListTags()
	if err != nil {
		return nil, err
	}

	tags := make([]*Tag, len(dbTags))
	for i, t := range dbTags {
		tags[i] = &Tag{
			ID:    t.ID,
			Name:  t.Name,
			Color: t.Color,
		}
	}

	return tags, nil
}

func (s *Service) AddToNote(noteID, tagID string) error {
	return s.db.AddNoteTag(noteID, tagID)
}

func (s *Service) RemoveFromNote(noteID, tagID string) error {
	return s.db.RemoveNoteTag(noteID, tagID)
}
