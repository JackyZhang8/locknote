// https://github.com/JackyZhang8/locknote
// 一个简单、可靠、离线优先的桌面加密笔记软件。
// A simple, reliable, offline-first encrypted note-taking desktop app.
package database

import (
	"database/sql"
	"fmt"
	"strings"
	"time"

	_ "modernc.org/sqlite"
)

type DB struct {
	db *sql.DB
}

type MasterPassword struct {
	Salt             []byte
	Verifier         []byte
	Hint             string
	EncryptedDataKey []byte
}

type NoteMeta struct {
	ID               string
	CipherPath       string
	CreatedAt        time.Time
	UpdatedAt        time.Time
	Pinned           bool
	DeletedAt        *time.Time
	NotebookID       *string
	SortOrder        int
	EncryptedTitle   []byte
	EncryptedPreview []byte
}

type Tag struct {
	ID    string
	Name  string
	Color string
}

type NoteTag struct {
	NoteID string
	TagID  string
}

type Settings struct {
	AutoLockMinutes int
	LockOnMinimize  bool
	LockOnSleep     bool
}

type NoteHistory struct {
	ID         string
	NoteID     string
	CipherPath string
	CreatedAt  time.Time
}

type Notebook struct {
	ID        string
	Name      string
	Icon      string
	SortOrder int
	Pinned    bool
}

type SmartView struct {
	ID         string
	Name       string
	Icon       string
	FilterJSON string
	SortOrder  int
}

func New(dbPath string) (*DB, error) {
	dsn := fmt.Sprintf("%s?_foreign_keys=on", dbPath)
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}

	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)

	// Ensure FK constraints are enforced.
	if _, err := db.Exec(`PRAGMA foreign_keys = ON;`); err != nil {
		_ = db.Close()
		return nil, err
	}

	d := &DB{db: db}
	if err := d.migrate(); err != nil {
		return nil, err
	}

	return d, nil
}

func (d *DB) Close() error {
	return d.db.Close()
}

func (d *DB) migrate() error {
	schema := `
	CREATE TABLE IF NOT EXISTS master_password (
		id INTEGER PRIMARY KEY CHECK (id = 1),
		salt BLOB NOT NULL,
		verifier BLOB NOT NULL,
		hint TEXT DEFAULT '',
		encrypted_data_key BLOB NOT NULL
	);

	CREATE TABLE IF NOT EXISTS notes (
		id TEXT PRIMARY KEY,
		cipher_path TEXT NOT NULL,
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL,
		pinned INTEGER DEFAULT 0,
		deleted_at DATETIME
	);

	CREATE TABLE IF NOT EXISTS tags (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL UNIQUE,
		color TEXT DEFAULT '#10b981'
	);

	CREATE TABLE IF NOT EXISTS note_tags (
		note_id TEXT NOT NULL,
		tag_id TEXT NOT NULL,
		PRIMARY KEY (note_id, tag_id),
		FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
		FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS settings (
		id INTEGER PRIMARY KEY CHECK (id = 1),
		auto_lock_minutes INTEGER DEFAULT 5,
		lock_on_minimize INTEGER DEFAULT 0,
		lock_on_sleep INTEGER DEFAULT 1
	);

	CREATE TABLE IF NOT EXISTS note_history (
		id TEXT PRIMARY KEY,
		note_id TEXT NOT NULL,
		cipher_path TEXT NOT NULL,
		created_at DATETIME NOT NULL,
		FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
	);

	CREATE INDEX IF NOT EXISTS idx_notes_deleted_at ON notes(deleted_at);
	CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at);
	CREATE INDEX IF NOT EXISTS idx_notes_pinned ON notes(pinned);
	CREATE INDEX IF NOT EXISTS idx_note_history_note_id ON note_history(note_id);
	CREATE INDEX IF NOT EXISTS idx_note_tags_note_id ON note_tags(note_id);
	CREATE INDEX IF NOT EXISTS idx_note_tags_tag_id ON note_tags(tag_id);

	INSERT OR IGNORE INTO settings (id, auto_lock_minutes, lock_on_minimize, lock_on_sleep) VALUES (1, 5, 0, 1);
	`
	_, err := d.db.Exec(schema)
	if err != nil {
		return err
	}

	notebookSchema := `
	CREATE TABLE IF NOT EXISTS notebooks (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		icon TEXT DEFAULT '📓',
		sort_order INTEGER DEFAULT 0,
		pinned INTEGER DEFAULT 0
	);

	CREATE TABLE IF NOT EXISTS smart_views (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		icon TEXT DEFAULT '🔍',
		filter_json TEXT NOT NULL,
		sort_order INTEGER DEFAULT 0
	);

	CREATE INDEX IF NOT EXISTS idx_notebooks_sort_order ON notebooks(sort_order);
	CREATE INDEX IF NOT EXISTS idx_smart_views_sort_order ON smart_views(sort_order);
	`
	_, err = d.db.Exec(notebookSchema)
	if err != nil {
		return err
	}

	d.addNotebookIdColumn()

	return nil
}

func (d *DB) addNotebookIdColumn() {
	var count int
	err := d.db.QueryRow(`SELECT COUNT(*) FROM pragma_table_info('notes') WHERE name='notebook_id'`).Scan(&count)
	if err != nil || count == 0 {
		d.db.Exec(`ALTER TABLE notes ADD COLUMN notebook_id TEXT REFERENCES notebooks(id) ON DELETE SET NULL`)
		d.db.Exec(`CREATE INDEX IF NOT EXISTS idx_notes_notebook_id ON notes(notebook_id)`)
	}

	err = d.db.QueryRow(`SELECT COUNT(*) FROM pragma_table_info('notes') WHERE name='sort_order'`).Scan(&count)
	if err != nil || count == 0 {
		d.db.Exec(`ALTER TABLE notes ADD COLUMN sort_order INTEGER DEFAULT 0`)
		d.db.Exec(`CREATE INDEX IF NOT EXISTS idx_notes_sort_order ON notes(sort_order)`)
	}

	// Add pinned column to notebooks table if not exists
	err = d.db.QueryRow(`SELECT COUNT(*) FROM pragma_table_info('notebooks') WHERE name='pinned'`).Scan(&count)
	if err != nil || count == 0 {
		d.db.Exec(`ALTER TABLE notebooks ADD COLUMN pinned INTEGER DEFAULT 0`)
		d.db.Exec(`CREATE INDEX IF NOT EXISTS idx_notebooks_pinned ON notebooks(pinned)`)
	}

	// Add encrypted_title and encrypted_preview columns for list performance
	err = d.db.QueryRow(`SELECT COUNT(*) FROM pragma_table_info('notes') WHERE name='encrypted_title'`).Scan(&count)
	if err != nil || count == 0 {
		d.db.Exec(`ALTER TABLE notes ADD COLUMN encrypted_title BLOB`)
		d.db.Exec(`ALTER TABLE notes ADD COLUMN encrypted_preview BLOB`)
	}

	// Add composite index for list query optimization
	d.db.Exec(`CREATE INDEX IF NOT EXISTS idx_notes_list ON notes(deleted_at, pinned DESC, sort_order ASC, updated_at DESC)`)
}

func (d *DB) HasMasterPassword() bool {
	var count int
	d.db.QueryRow("SELECT COUNT(*) FROM master_password").Scan(&count)
	return count > 0
}

func (d *DB) SaveMasterPassword(salt, verifier []byte, hint string, encryptedDataKey []byte) error {
	_, err := d.db.Exec(`
		INSERT OR REPLACE INTO master_password (id, salt, verifier, hint, encrypted_data_key)
		VALUES (1, ?, ?, ?, ?)
	`, salt, verifier, hint, encryptedDataKey)
	return err
}

func (d *DB) GetMasterPassword() (*MasterPassword, error) {
	var mp MasterPassword
	err := d.db.QueryRow(`
		SELECT salt, verifier, hint, encrypted_data_key FROM master_password WHERE id = 1
	`).Scan(&mp.Salt, &mp.Verifier, &mp.Hint, &mp.EncryptedDataKey)
	if err != nil {
		return nil, err
	}
	return &mp, nil
}

func (d *DB) CreateNote(note *NoteMeta) error {
	_, err := d.db.Exec(`
		INSERT INTO notes (id, cipher_path, created_at, updated_at, pinned, notebook_id, encrypted_title, encrypted_preview)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, note.ID, note.CipherPath, note.CreatedAt, note.UpdatedAt, note.Pinned, note.NotebookID, note.EncryptedTitle, note.EncryptedPreview)
	return err
}

func (d *DB) UpdateNote(note *NoteMeta) error {
	_, err := d.db.Exec(`
		UPDATE notes SET cipher_path = ?, updated_at = ?, pinned = ?, deleted_at = ?, notebook_id = ?, encrypted_title = ?, encrypted_preview = ?
		WHERE id = ?
	`, note.CipherPath, note.UpdatedAt, note.Pinned, note.DeletedAt, note.NotebookID, note.EncryptedTitle, note.EncryptedPreview, note.ID)
	return err
}

func (d *DB) UpdateNoteAndCreateHistory(note *NoteMeta, h *NoteHistory) error {
	tx, err := d.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	_, err = tx.Exec(`
		UPDATE notes SET cipher_path = ?, updated_at = ?, pinned = ?, deleted_at = ?, notebook_id = ?, encrypted_title = ?, encrypted_preview = ?
		WHERE id = ?
	`, note.CipherPath, note.UpdatedAt, note.Pinned, note.DeletedAt, note.NotebookID, note.EncryptedTitle, note.EncryptedPreview, note.ID)
	if err != nil {
		return err
	}

	if h != nil {
		_, err = tx.Exec(`
			INSERT INTO note_history (id, note_id, cipher_path, created_at)
			VALUES (?, ?, ?, ?)
		`, h.ID, h.NoteID, h.CipherPath, h.CreatedAt)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (d *DB) GetNote(id string) (*NoteMeta, error) {
	var note NoteMeta
	err := d.db.QueryRow(`
		SELECT id, cipher_path, created_at, updated_at, pinned, deleted_at, notebook_id, COALESCE(sort_order, 0)
		FROM notes WHERE id = ?
	`, id).Scan(&note.ID, &note.CipherPath, &note.CreatedAt, &note.UpdatedAt, &note.Pinned, &note.DeletedAt, &note.NotebookID, &note.SortOrder)
	if err != nil {
		return nil, err
	}
	return &note, nil
}

func (d *DB) ListNotes(includeDeleted bool) ([]*NoteMeta, error) {
	query := `SELECT id, cipher_path, created_at, updated_at, pinned, deleted_at, notebook_id, COALESCE(sort_order, 0), encrypted_title, encrypted_preview FROM notes`
	if !includeDeleted {
		query += ` WHERE deleted_at IS NULL`
	}
	query += ` ORDER BY pinned DESC, sort_order ASC, updated_at DESC`

	rows, err := d.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var notes []*NoteMeta
	for rows.Next() {
		var note NoteMeta
		if err := rows.Scan(&note.ID, &note.CipherPath, &note.CreatedAt, &note.UpdatedAt, &note.Pinned, &note.DeletedAt, &note.NotebookID, &note.SortOrder, &note.EncryptedTitle, &note.EncryptedPreview); err != nil {
			return nil, err
		}
		notes = append(notes, &note)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return notes, nil
}

func (d *DB) ListNotesPaginated(limit, offset int) ([]*NoteMeta, int, error) {
	var total int
	err := d.db.QueryRow(`SELECT COUNT(*) FROM notes WHERE deleted_at IS NULL`).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	query := `SELECT id, cipher_path, created_at, updated_at, pinned, deleted_at, notebook_id, COALESCE(sort_order, 0), encrypted_title, encrypted_preview 
		FROM notes WHERE deleted_at IS NULL 
		ORDER BY pinned DESC, sort_order ASC, updated_at DESC 
		LIMIT ? OFFSET ?`

	rows, err := d.db.Query(query, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var notes []*NoteMeta
	for rows.Next() {
		var note NoteMeta
		if err := rows.Scan(&note.ID, &note.CipherPath, &note.CreatedAt, &note.UpdatedAt, &note.Pinned, &note.DeletedAt, &note.NotebookID, &note.SortOrder, &note.EncryptedTitle, &note.EncryptedPreview); err != nil {
			return nil, 0, err
		}
		notes = append(notes, &note)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}
	return notes, total, nil
}

func (d *DB) ListDeletedNotes() ([]*NoteMeta, error) {
	rows, err := d.db.Query(`
		SELECT id, cipher_path, created_at, updated_at, pinned, deleted_at, notebook_id, COALESCE(sort_order, 0), encrypted_title, encrypted_preview
		FROM notes WHERE deleted_at IS NOT NULL
		ORDER BY deleted_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var notes []*NoteMeta
	for rows.Next() {
		var note NoteMeta
		if err := rows.Scan(&note.ID, &note.CipherPath, &note.CreatedAt, &note.UpdatedAt, &note.Pinned, &note.DeletedAt, &note.NotebookID, &note.SortOrder, &note.EncryptedTitle, &note.EncryptedPreview); err != nil {
			return nil, err
		}
		notes = append(notes, &note)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return notes, nil
}

func (d *DB) DeleteNotePermanently(id string) error {
	_, err := d.db.Exec(`DELETE FROM notes WHERE id = ?`, id)
	return err
}

func (d *DB) ReorderNotes(ids []string) error {
	tx, err := d.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	for i, id := range ids {
		_, err := tx.Exec(`UPDATE notes SET sort_order = ? WHERE id = ?`, i, id)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (d *DB) CreateTag(tag *Tag) error {
	_, err := d.db.Exec(`INSERT INTO tags (id, name, color) VALUES (?, ?, ?)`, tag.ID, tag.Name, tag.Color)
	return err
}

func (d *DB) UpdateTag(tag *Tag) error {
	_, err := d.db.Exec(`UPDATE tags SET name = ?, color = ? WHERE id = ?`, tag.Name, tag.Color, tag.ID)
	return err
}

func (d *DB) DeleteTag(id string) error {
	_, err := d.db.Exec(`DELETE FROM tags WHERE id = ?`, id)
	return err
}

func (d *DB) ListTags() ([]*Tag, error) {
	rows, err := d.db.Query(`SELECT id, name, color FROM tags ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tags []*Tag
	for rows.Next() {
		var tag Tag
		if err := rows.Scan(&tag.ID, &tag.Name, &tag.Color); err != nil {
			return nil, err
		}
		tags = append(tags, &tag)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return tags, nil
}

func (d *DB) AddNoteTag(noteID, tagID string) error {
	_, err := d.db.Exec(`INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?)`, noteID, tagID)
	return err
}

func (d *DB) RemoveNoteTag(noteID, tagID string) error {
	_, err := d.db.Exec(`DELETE FROM note_tags WHERE note_id = ? AND tag_id = ?`, noteID, tagID)
	return err
}

func (d *DB) RemoveTagFromAllNotes(tagID string) error {
	_, err := d.db.Exec(`DELETE FROM note_tags WHERE tag_id = ?`, tagID)
	return err
}

func (d *DB) DeleteTagWithAssociations(tagID string) error {
	tx, err := d.db.Begin()
	if err != nil {
		return err
	}

	if _, err := tx.Exec(`DELETE FROM note_tags WHERE tag_id = ?`, tagID); err != nil {
		_ = tx.Rollback()
		return err
	}
	if _, err := tx.Exec(`DELETE FROM tags WHERE id = ?`, tagID); err != nil {
		_ = tx.Rollback()
		return err
	}

	return tx.Commit()
}

func (d *DB) GetNoteTags(noteID string) ([]*Tag, error) {
	rows, err := d.db.Query(`
		SELECT t.id, t.name, t.color FROM tags t
		INNER JOIN note_tags nt ON t.id = nt.tag_id
		WHERE nt.note_id = ?
		ORDER BY t.name
	`, noteID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tags []*Tag
	for rows.Next() {
		var tag Tag
		if err := rows.Scan(&tag.ID, &tag.Name, &tag.Color); err != nil {
			return nil, err
		}
		tags = append(tags, &tag)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return tags, nil
}

func (d *DB) GetNoteTagsBatch(noteIDs []string) (map[string][]*Tag, error) {
	if len(noteIDs) == 0 {
		return make(map[string][]*Tag), nil
	}

	placeholders := make([]string, len(noteIDs))
	args := make([]interface{}, len(noteIDs))
	for i, id := range noteIDs {
		placeholders[i] = "?"
		args[i] = id
	}

	query := fmt.Sprintf(`
		SELECT nt.note_id, t.id, t.name, t.color FROM tags t
		INNER JOIN note_tags nt ON t.id = nt.tag_id
		WHERE nt.note_id IN (%s)
		ORDER BY t.name
	`, strings.Join(placeholders, ","))

	rows, err := d.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make(map[string][]*Tag)
	for rows.Next() {
		var noteID string
		var tag Tag
		if err := rows.Scan(&noteID, &tag.ID, &tag.Name, &tag.Color); err != nil {
			return nil, err
		}
		result[noteID] = append(result[noteID], &tag)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return result, nil
}

func (d *DB) GetNotesByTag(tagID string) ([]*NoteMeta, error) {
	rows, err := d.db.Query(`
		SELECT n.id, n.cipher_path, n.created_at, n.updated_at, n.pinned, n.deleted_at, n.notebook_id
		FROM notes n
		INNER JOIN note_tags nt ON n.id = nt.note_id
		WHERE nt.tag_id = ? AND n.deleted_at IS NULL
		ORDER BY n.pinned DESC, n.updated_at DESC
	`, tagID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var notes []*NoteMeta
	for rows.Next() {
		var note NoteMeta
		if err := rows.Scan(&note.ID, &note.CipherPath, &note.CreatedAt, &note.UpdatedAt, &note.Pinned, &note.DeletedAt, &note.NotebookID); err != nil {
			return nil, err
		}
		notes = append(notes, &note)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return notes, nil
}

func (d *DB) GetSettings() (*Settings, error) {
	var s Settings
	err := d.db.QueryRow(`
		SELECT auto_lock_minutes, lock_on_minimize, lock_on_sleep FROM settings WHERE id = 1
	`).Scan(&s.AutoLockMinutes, &s.LockOnMinimize, &s.LockOnSleep)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func (d *DB) UpdateSettings(s *Settings) error {
	_, err := d.db.Exec(`
		UPDATE settings SET auto_lock_minutes = ?, lock_on_minimize = ?, lock_on_sleep = ? WHERE id = 1
	`, s.AutoLockMinutes, s.LockOnMinimize, s.LockOnSleep)
	return err
}

func (d *DB) CreateNoteHistory(h *NoteHistory) error {
	_, err := d.db.Exec(`
		INSERT INTO note_history (id, note_id, cipher_path, created_at)
		VALUES (?, ?, ?, ?)
	`, h.ID, h.NoteID, h.CipherPath, h.CreatedAt)
	return err
}

func (d *DB) GetNoteHistory(noteID string) ([]*NoteHistory, error) {
	rows, err := d.db.Query(`
		SELECT id, note_id, cipher_path, created_at
		FROM note_history WHERE note_id = ?
		ORDER BY created_at DESC
	`, noteID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var history []*NoteHistory
	for rows.Next() {
		var h NoteHistory
		if err := rows.Scan(&h.ID, &h.NoteID, &h.CipherPath, &h.CreatedAt); err != nil {
			return nil, err
		}
		history = append(history, &h)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return history, nil
}

func (d *DB) DeleteNoteHistory(noteID string) error {
	_, err := d.db.Exec(`DELETE FROM note_history WHERE note_id = ?`, noteID)
	return err
}

func (d *DB) DeleteSingleHistory(historyID string) error {
	_, err := d.db.Exec(`DELETE FROM note_history WHERE id = ?`, historyID)
	return err
}

func (d *DB) CreateNotebook(notebook *Notebook) error {
	_, err := d.db.Exec(`INSERT INTO notebooks (id, name, icon, sort_order, pinned) VALUES (?, ?, ?, ?, ?)`,
		notebook.ID, notebook.Name, notebook.Icon, notebook.SortOrder, notebook.Pinned)
	return err
}

func (d *DB) GetNotebook(id string) (*Notebook, error) {
	var notebook Notebook
	err := d.db.QueryRow(`SELECT id, name, icon, sort_order, COALESCE(pinned, 0) FROM notebooks WHERE id = ?`, id).
		Scan(&notebook.ID, &notebook.Name, &notebook.Icon, &notebook.SortOrder, &notebook.Pinned)
	if err != nil {
		return nil, err
	}
	return &notebook, nil
}

func (d *DB) UpdateNotebook(notebook *Notebook) error {
	_, err := d.db.Exec(`UPDATE notebooks SET name = ?, icon = ?, sort_order = ?, pinned = ? WHERE id = ?`,
		notebook.Name, notebook.Icon, notebook.SortOrder, notebook.Pinned, notebook.ID)
	return err
}

func (d *DB) DeleteNotebook(id string) error {
	_, err := d.db.Exec(`DELETE FROM notebooks WHERE id = ?`, id)
	return err
}

func (d *DB) ListNotebooks() ([]*Notebook, error) {
	rows, err := d.db.Query(`SELECT id, name, icon, sort_order, COALESCE(pinned, 0) FROM notebooks ORDER BY pinned DESC, sort_order, name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var notebooks []*Notebook
	for rows.Next() {
		var n Notebook
		if err := rows.Scan(&n.ID, &n.Name, &n.Icon, &n.SortOrder, &n.Pinned); err != nil {
			return nil, err
		}
		notebooks = append(notebooks, &n)
	}
	return notebooks, rows.Err()
}

func (d *DB) SetNotebookPinned(id string, pinned bool) error {
	_, err := d.db.Exec(`UPDATE notebooks SET pinned = ? WHERE id = ?`, pinned, id)
	return err
}

func (d *DB) GetNextNotebookSortOrder() (int, error) {
	var maxOrder sql.NullInt64
	err := d.db.QueryRow(`SELECT MAX(sort_order) FROM notebooks`).Scan(&maxOrder)
	if err != nil {
		return 0, err
	}
	if !maxOrder.Valid {
		return 0, nil
	}
	return int(maxOrder.Int64) + 1, nil
}

func (d *DB) UpdateNotebookSortOrder(id string, sortOrder int) error {
	_, err := d.db.Exec(`UPDATE notebooks SET sort_order = ? WHERE id = ?`, sortOrder, id)
	return err
}

func (d *DB) ReorderNotebooks(ids []string) error {
	tx, err := d.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	for i, id := range ids {
		if _, err := tx.Exec(`UPDATE notebooks SET sort_order = ? WHERE id = ?`, i, id); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (d *DB) SetNoteNotebook(noteID string, notebookID *string) error {
	_, err := d.db.Exec(`UPDATE notes SET notebook_id = ? WHERE id = ?`, notebookID, noteID)
	return err
}

func (d *DB) SetNotesNotebook(noteIDs []string, notebookID *string) error {
	if len(noteIDs) == 0 {
		return nil
	}
	tx, err := d.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	for _, noteID := range noteIDs {
		if _, err := tx.Exec(`UPDATE notes SET notebook_id = ? WHERE id = ?`, notebookID, noteID); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (d *DB) CreateSmartView(sv *SmartView) error {
	_, err := d.db.Exec(`INSERT INTO smart_views (id, name, icon, filter_json, sort_order) VALUES (?, ?, ?, ?, ?)`,
		sv.ID, sv.Name, sv.Icon, sv.FilterJSON, sv.SortOrder)
	return err
}

func (d *DB) GetSmartView(id string) (*SmartView, error) {
	var sv SmartView
	err := d.db.QueryRow(`SELECT id, name, icon, filter_json, sort_order FROM smart_views WHERE id = ?`, id).
		Scan(&sv.ID, &sv.Name, &sv.Icon, &sv.FilterJSON, &sv.SortOrder)
	if err != nil {
		return nil, err
	}
	return &sv, nil
}

func (d *DB) UpdateSmartView(sv *SmartView) error {
	_, err := d.db.Exec(`UPDATE smart_views SET name = ?, icon = ?, filter_json = ?, sort_order = ? WHERE id = ?`,
		sv.Name, sv.Icon, sv.FilterJSON, sv.SortOrder, sv.ID)
	return err
}

func (d *DB) DeleteSmartView(id string) error {
	_, err := d.db.Exec(`DELETE FROM smart_views WHERE id = ?`, id)
	return err
}

func (d *DB) ListSmartViews() ([]*SmartView, error) {
	rows, err := d.db.Query(`SELECT id, name, icon, filter_json, sort_order FROM smart_views ORDER BY sort_order, name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var views []*SmartView
	for rows.Next() {
		var sv SmartView
		if err := rows.Scan(&sv.ID, &sv.Name, &sv.Icon, &sv.FilterJSON, &sv.SortOrder); err != nil {
			return nil, err
		}
		views = append(views, &sv)
	}
	return views, rows.Err()
}

func (d *DB) GetNextSmartViewSortOrder() (int, error) {
	var maxOrder sql.NullInt64
	err := d.db.QueryRow(`SELECT MAX(sort_order) FROM smart_views`).Scan(&maxOrder)
	if err != nil {
		return 0, err
	}
	if !maxOrder.Valid {
		return 0, nil
	}
	return int(maxOrder.Int64) + 1, nil
}
