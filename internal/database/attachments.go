package database

import "time"

type AttachmentMeta struct {
	ID             string
	OriginalName   string
	MIMEType       string
	Size           int64
	Width          int
	Height         int
	CipherPath     string
	SHA256         string
	Favorite       bool
	CreatedAt      time.Time
	UpdatedAt      time.Time
	ReferenceCount int
}

func (d *DB) ensureAttachmentSchema() error {
	schema := `
	CREATE TABLE IF NOT EXISTS attachments (
		id TEXT PRIMARY KEY,
		original_name TEXT NOT NULL,
		mime_type TEXT NOT NULL,
		size INTEGER NOT NULL,
		width INTEGER DEFAULT 0,
		height INTEGER DEFAULT 0,
		cipher_path TEXT NOT NULL,
		sha256 TEXT DEFAULT '',
		favorite INTEGER NOT NULL DEFAULT 0,
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL
	);

	CREATE TABLE IF NOT EXISTS note_attachments (
		note_id TEXT NOT NULL,
		attachment_id TEXT NOT NULL,
		created_at DATETIME NOT NULL,
		PRIMARY KEY (note_id, attachment_id),
		FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
		FOREIGN KEY (attachment_id) REFERENCES attachments(id) ON DELETE CASCADE
	);

	CREATE INDEX IF NOT EXISTS idx_attachments_created_at ON attachments(created_at);
	CREATE INDEX IF NOT EXISTS idx_note_attachments_note_id ON note_attachments(note_id);
	CREATE INDEX IF NOT EXISTS idx_note_attachments_attachment_id ON note_attachments(attachment_id);
	`
	_, err := d.db.Exec(schema)
	if err != nil {
		return err
	}
	return d.ensureAttachmentFavoriteColumn()
}

func (d *DB) ensureAttachmentFavoriteColumn() error {
	var count int
	if err := d.db.QueryRow(`SELECT COUNT(*) FROM pragma_table_info('attachments') WHERE name='favorite'`).Scan(&count); err != nil {
		return err
	}
	if count == 0 {
		_, err := d.db.Exec(`ALTER TABLE attachments ADD COLUMN favorite INTEGER NOT NULL DEFAULT 0`)
		return err
	}
	return nil
}

func (d *DB) CreateAttachment(a *AttachmentMeta) error {
	_, err := d.db.Exec(`
		INSERT INTO attachments (id, original_name, mime_type, size, width, height, cipher_path, sha256, favorite, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, a.ID, a.OriginalName, a.MIMEType, a.Size, a.Width, a.Height, a.CipherPath, a.SHA256, boolToInt(a.Favorite), a.CreatedAt, a.UpdatedAt)
	return err
}

func (d *DB) GetAttachment(id string) (*AttachmentMeta, error) {
	var a AttachmentMeta
	var createdAtAny any
	var updatedAtAny any
	var favoriteInt int
	err := d.db.QueryRow(`
		SELECT a.id, a.original_name, a.mime_type, a.size, COALESCE(a.width, 0), COALESCE(a.height, 0),
			a.cipher_path, COALESCE(a.sha256, ''), COALESCE(a.favorite, 0), a.created_at, a.updated_at,
			(SELECT COUNT(*) FROM note_attachments na WHERE na.attachment_id = a.id)
		FROM attachments a
		WHERE a.id = ?
	`, id).Scan(&a.ID, &a.OriginalName, &a.MIMEType, &a.Size, &a.Width, &a.Height, &a.CipherPath, &a.SHA256, &favoriteInt, &createdAtAny, &updatedAtAny, &a.ReferenceCount)
	if err != nil {
		return nil, err
	}
	a.Favorite = favoriteInt != 0
	if a.CreatedAt, err = parseSQLiteTime(createdAtAny); err != nil {
		return nil, err
	}
	if a.UpdatedAt, err = parseSQLiteTime(updatedAtAny); err != nil {
		return nil, err
	}
	return &a, nil
}

func (d *DB) ListAttachments() ([]*AttachmentMeta, error) {
	rows, err := d.db.Query(`
		SELECT a.id, a.original_name, a.mime_type, a.size, COALESCE(a.width, 0), COALESCE(a.height, 0),
			a.cipher_path, COALESCE(a.sha256, ''), COALESCE(a.favorite, 0), a.created_at, a.updated_at,
			(SELECT COUNT(*) FROM note_attachments na WHERE na.attachment_id = a.id)
		FROM attachments a
		ORDER BY a.created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var attachments []*AttachmentMeta
	for rows.Next() {
		var a AttachmentMeta
		var createdAtAny any
		var updatedAtAny any
		var favoriteInt int
		if err := rows.Scan(&a.ID, &a.OriginalName, &a.MIMEType, &a.Size, &a.Width, &a.Height, &a.CipherPath, &a.SHA256, &favoriteInt, &createdAtAny, &updatedAtAny, &a.ReferenceCount); err != nil {
			return nil, err
		}
		a.Favorite = favoriteInt != 0
		if a.CreatedAt, err = parseSQLiteTime(createdAtAny); err != nil {
			return nil, err
		}
		if a.UpdatedAt, err = parseSQLiteTime(updatedAtAny); err != nil {
			return nil, err
		}
		attachments = append(attachments, &a)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return attachments, nil
}

func (d *DB) SetAttachmentFavorite(id string, favorite bool) error {
	_, err := d.db.Exec(`
		UPDATE attachments
		SET favorite = ?, updated_at = ?
		WHERE id = ?
	`, boolToInt(favorite), time.Now(), id)
	return err
}

func (d *DB) DeleteAttachment(id string) error {
	_, err := d.db.Exec(`DELETE FROM attachments WHERE id = ?`, id)
	return err
}

func (d *DB) AddNoteAttachment(noteID, attachmentID string) error {
	_, err := d.db.Exec(`
		INSERT OR IGNORE INTO note_attachments (note_id, attachment_id, created_at)
		VALUES (?, ?, ?)
	`, noteID, attachmentID, time.Now())
	return err
}

func (d *DB) RemoveNoteAttachment(noteID, attachmentID string) error {
	_, err := d.db.Exec(`DELETE FROM note_attachments WHERE note_id = ? AND attachment_id = ?`, noteID, attachmentID)
	return err
}
