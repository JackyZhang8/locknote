// https://github.com/JackyZhang8/locknote
// 一个简单、可靠、离线优先的桌面加密笔记软件。
// A simple, reliable, offline-first encrypted note-taking desktop app.
package smartviews

import (
	"encoding/json"
	"locknote/internal/database"

	"github.com/google/uuid"
)

type Service struct {
	db *database.DB
}

type SmartView struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Icon      string `json:"icon"`
	Filter    Filter `json:"filter"`
	SortOrder int    `json:"sortOrder"`
}

type FilterCondition struct {
	Field    string `json:"field"`
	Operator string `json:"operator"`
	Value    string `json:"value"`
}

type Filter struct {
	Conditions  []FilterCondition `json:"conditions,omitempty"`
	TagIDs      []string          `json:"tagIds,omitempty"`
	NotebookID  *string           `json:"notebookId,omitempty"`
	DaysRecent  *int              `json:"daysRecent,omitempty"`
	SearchQuery *string           `json:"searchQuery,omitempty"`
}

func NewService(db *database.DB) *Service {
	return &Service{db: db}
}

func (s *Service) Create(name, icon string, filter Filter) (*SmartView, error) {
	if icon == "" {
		icon = "🔍"
	}

	filterJSON, err := json.Marshal(filter)
	if err != nil {
		return nil, err
	}

	sortOrder, err := s.db.GetNextSmartViewSortOrder()
	if err != nil {
		sortOrder = 0
	}

	sv := &database.SmartView{
		ID:         uuid.New().String(),
		Name:       name,
		Icon:       icon,
		FilterJSON: string(filterJSON),
		SortOrder:  sortOrder,
	}

	if err := s.db.CreateSmartView(sv); err != nil {
		return nil, err
	}

	return &SmartView{
		ID:        sv.ID,
		Name:      sv.Name,
		Icon:      sv.Icon,
		Filter:    filter,
		SortOrder: sv.SortOrder,
	}, nil
}

func (s *Service) Update(id, name, icon string, filter Filter) (*SmartView, error) {
	sv, err := s.db.GetSmartView(id)
	if err != nil {
		return nil, err
	}

	filterJSON, err := json.Marshal(filter)
	if err != nil {
		return nil, err
	}

	sv.Name = name
	if icon != "" {
		sv.Icon = icon
	}
	sv.FilterJSON = string(filterJSON)

	if err := s.db.UpdateSmartView(sv); err != nil {
		return nil, err
	}

	return &SmartView{
		ID:        sv.ID,
		Name:      sv.Name,
		Icon:      sv.Icon,
		Filter:    filter,
		SortOrder: sv.SortOrder,
	}, nil
}

func (s *Service) Delete(id string) error {
	return s.db.DeleteSmartView(id)
}

func (s *Service) List() ([]*SmartView, error) {
	dbViews, err := s.db.ListSmartViews()
	if err != nil {
		return nil, err
	}

	views := make([]*SmartView, 0, len(dbViews))
	for _, sv := range dbViews {
		var filter Filter
		if err := json.Unmarshal([]byte(sv.FilterJSON), &filter); err != nil {
			continue
		}

		views = append(views, &SmartView{
			ID:        sv.ID,
			Name:      sv.Name,
			Icon:      sv.Icon,
			Filter:    filter,
			SortOrder: sv.SortOrder,
		})
	}

	return views, nil
}

func (s *Service) Get(id string) (*SmartView, error) {
	sv, err := s.db.GetSmartView(id)
	if err != nil {
		return nil, err
	}

	var filter Filter
	if err := json.Unmarshal([]byte(sv.FilterJSON), &filter); err != nil {
		return nil, err
	}

	return &SmartView{
		ID:        sv.ID,
		Name:      sv.Name,
		Icon:      sv.Icon,
		Filter:    filter,
		SortOrder: sv.SortOrder,
	}, nil
}
