package mobile

import (
	"encoding/json"
	"testing"
)

type mobileNote struct {
	ID         string  `json:"id"`
	Title      string  `json:"title"`
	NotebookID *string `json:"notebookId"`
	DeletedAt  *string `json:"deletedAt"`
	Tags       []struct {
		ID string `json:"id"`
	} `json:"tags"`
}

type mobileNotebook struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	SortOrder int    `json:"sortOrder"`
}

type mobileSmartView struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Icon   string `json:"icon"`
	Filter struct {
		TagIDs     []string `json:"tagIds"`
		NotebookID *string  `json:"notebookId"`
		DaysRecent *int     `json:"daysRecent"`
	} `json:"filter"`
}

func setupUnlockedMobileCore(t *testing.T) {
	t.Helper()

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
}

func jsonIDs(t *testing.T, ids ...string) string {
	t.Helper()

	data, err := json.Marshal(ids)
	if err != nil {
		t.Fatalf("marshal ids: %v", err)
	}
	return string(data)
}

func TestMobileCollectionAPIsUseSharedCore(t *testing.T) {
	setupUnlockedMobileCore(t)

	firstJSON, err := CreateNote("First", "one")
	if err != nil {
		t.Fatalf("create first note: %v", err)
	}
	secondJSON, err := CreateNote("Second", "two")
	if err != nil {
		t.Fatalf("create second note: %v", err)
	}
	var first, second mobileNote
	if err := json.Unmarshal([]byte(firstJSON), &first); err != nil {
		t.Fatalf("unmarshal first note: %v", err)
	}
	if err := json.Unmarshal([]byte(secondJSON), &second); err != nil {
		t.Fatalf("unmarshal second note: %v", err)
	}

	notebookJSON, err := CreateNotebook("Work", "W")
	if err != nil {
		t.Fatalf("create notebook: %v", err)
	}
	var notebook mobileNotebook
	if err := json.Unmarshal([]byte(notebookJSON), &notebook); err != nil {
		t.Fatalf("unmarshal notebook: %v", err)
	}

	if err := SetNotesNotebook(jsonIDs(t, first.ID, second.ID), notebook.ID); err != nil {
		t.Fatalf("set notes notebook: %v", err)
	}
	notesJSON, err := ListNotes()
	if err != nil {
		t.Fatalf("list notes: %v", err)
	}
	var listed []mobileNote
	if err := json.Unmarshal([]byte(notesJSON), &listed); err != nil {
		t.Fatalf("unmarshal notes: %v", err)
	}
	for _, note := range listed {
		if note.NotebookID == nil || *note.NotebookID != notebook.ID {
			t.Fatalf("note %#v should be assigned to notebook %s", note, notebook.ID)
		}
	}

	tagJSON, err := CreateTag("Focus", "#f00")
	if err != nil {
		t.Fatalf("create tag: %v", err)
	}
	var tag struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal([]byte(tagJSON), &tag); err != nil {
		t.Fatalf("unmarshal tag: %v", err)
	}
	if err := BatchAddTagToNotes(jsonIDs(t, first.ID, second.ID), tag.ID); err != nil {
		t.Fatalf("batch add tag: %v", err)
	}
	notesJSON, err = ListNotes()
	if err != nil {
		t.Fatalf("list tagged notes: %v", err)
	}
	listed = nil
	if err := json.Unmarshal([]byte(notesJSON), &listed); err != nil {
		t.Fatalf("unmarshal tagged notes: %v", err)
	}
	for _, note := range listed {
		if len(note.Tags) != 1 || note.Tags[0].ID != tag.ID {
			t.Fatalf("note %#v should include tag %s", note, tag.ID)
		}
	}

	if err := ReorderNotes(jsonIDs(t, second.ID, first.ID)); err != nil {
		t.Fatalf("reorder notes: %v", err)
	}
	notesJSON, err = ListNotes()
	if err != nil {
		t.Fatalf("list reordered notes: %v", err)
	}
	listed = nil
	if err := json.Unmarshal([]byte(notesJSON), &listed); err != nil {
		t.Fatalf("unmarshal reordered notes: %v", err)
	}
	if len(listed) < 2 || listed[0].ID != second.ID || listed[1].ID != first.ID {
		t.Fatalf("reordered notes = %#v", listed)
	}

	if err := BatchDeleteNotes(jsonIDs(t, first.ID, second.ID)); err != nil {
		t.Fatalf("batch delete notes: %v", err)
	}
	deletedJSON, err := ListDeletedNotes()
	if err != nil {
		t.Fatalf("list deleted notes: %v", err)
	}
	var deleted []mobileNote
	if err := json.Unmarshal([]byte(deletedJSON), &deleted); err != nil {
		t.Fatalf("unmarshal deleted notes: %v", err)
	}
	if len(deleted) != 2 {
		t.Fatalf("deleted notes = %#v, want 2", deleted)
	}
}

func TestMobileSmartViewAPIsUseSharedCore(t *testing.T) {
	setupUnlockedMobileCore(t)

	tagJSON, err := CreateTag("Ideas", "#0f0")
	if err != nil {
		t.Fatalf("create tag: %v", err)
	}
	var tag struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal([]byte(tagJSON), &tag); err != nil {
		t.Fatalf("unmarshal tag: %v", err)
	}

	filterJSON := `{"tagIds":["` + tag.ID + `"],"daysRecent":7}`
	createdJSON, err := CreateSmartView("Recent Ideas", "R", filterJSON)
	if err != nil {
		t.Fatalf("create smart view: %v", err)
	}
	var created mobileSmartView
	if err := json.Unmarshal([]byte(createdJSON), &created); err != nil {
		t.Fatalf("unmarshal created smart view: %v", err)
	}
	if created.ID == "" || created.Name != "Recent Ideas" || created.Icon != "R" || created.Filter.DaysRecent == nil || *created.Filter.DaysRecent != 7 {
		t.Fatalf("created smart view = %#v", created)
	}

	updatedJSON, err := UpdateSmartView(created.ID, "Updated", "U", `{"tagIds":[]}`)
	if err != nil {
		t.Fatalf("update smart view: %v", err)
	}
	var updated mobileSmartView
	if err := json.Unmarshal([]byte(updatedJSON), &updated); err != nil {
		t.Fatalf("unmarshal updated smart view: %v", err)
	}
	if updated.Name != "Updated" || updated.Icon != "U" || len(updated.Filter.TagIDs) != 0 {
		t.Fatalf("updated smart view = %#v", updated)
	}

	gotJSON, err := GetSmartView(created.ID)
	if err != nil {
		t.Fatalf("get smart view: %v", err)
	}
	var got mobileSmartView
	if err := json.Unmarshal([]byte(gotJSON), &got); err != nil {
		t.Fatalf("unmarshal got smart view: %v", err)
	}
	if got.ID != created.ID || got.Name != "Updated" {
		t.Fatalf("got smart view = %#v", got)
	}

	listJSON, err := ListSmartViews()
	if err != nil {
		t.Fatalf("list smart views: %v", err)
	}
	var listed []mobileSmartView
	if err := json.Unmarshal([]byte(listJSON), &listed); err != nil {
		t.Fatalf("unmarshal listed smart views: %v", err)
	}
	if len(listed) != 1 || listed[0].ID != created.ID {
		t.Fatalf("listed smart views = %#v", listed)
	}

	if err := DeleteSmartView(created.ID); err != nil {
		t.Fatalf("delete smart view: %v", err)
	}
	listJSON, err = ListSmartViews()
	if err != nil {
		t.Fatalf("list smart views after delete: %v", err)
	}
	listed = nil
	if err := json.Unmarshal([]byte(listJSON), &listed); err != nil {
		t.Fatalf("unmarshal listed smart views after delete: %v", err)
	}
	if len(listed) != 0 {
		t.Fatalf("listed smart views after delete = %#v, want empty", listed)
	}
}
