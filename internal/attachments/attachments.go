package attachments

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"locknote/internal/crypto"
	"locknote/internal/database"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

type Service struct {
	db        *database.DB
	dataDir   string
	crypto    *crypto.Service
	masterKey []byte
	mu        sync.RWMutex
}

type CreateImageInput struct {
	OriginalName string
	MIMEType     string
	Data         []byte
	NoteID       string
	Width        int
	Height       int
}

type Attachment struct {
	ID             string `json:"id"`
	OriginalName   string `json:"originalName"`
	MIMEType       string `json:"mimeType"`
	Size           int64  `json:"size"`
	Width          int    `json:"width"`
	Height         int    `json:"height"`
	CipherPath     string `json:"cipherPath"`
	SHA256         string `json:"sha256"`
	CreatedAt      string `json:"createdAt"`
	UpdatedAt      string `json:"updatedAt"`
	ReferenceCount int    `json:"referenceCount"`
}

func NewService(db *database.DB, dataDir string) *Service {
	return &Service{
		db:      db,
		dataDir: dataDir,
		crypto:  crypto.NewService(),
	}
}

func (s *Service) SetMasterKey(key []byte) {
	s.mu.Lock()
	defer s.mu.Unlock()
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

func formatTime(t time.Time) string {
	return t.Format(time.RFC3339Nano)
}

func attachmentFromMeta(meta *database.AttachmentMeta) *Attachment {
	return &Attachment{
		ID:             meta.ID,
		OriginalName:   meta.OriginalName,
		MIMEType:       meta.MIMEType,
		Size:           meta.Size,
		Width:          meta.Width,
		Height:         meta.Height,
		CipherPath:     meta.CipherPath,
		SHA256:         meta.SHA256,
		CreatedAt:      formatTime(meta.CreatedAt),
		UpdatedAt:      formatTime(meta.UpdatedAt),
		ReferenceCount: meta.ReferenceCount,
	}
}

func normalizeImageMIME(mimeType string) (string, error) {
	mimeType = strings.ToLower(strings.TrimSpace(mimeType))
	switch mimeType {
	case "image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif":
		if mimeType == "image/jpg" {
			return "image/jpeg", nil
		}
		return mimeType, nil
	default:
		return "", fmt.Errorf("unsupported image type: %s", mimeType)
	}
}

func sanitizeName(name string) string {
	name = strings.TrimSpace(filepath.Base(name))
	if name == "." || name == string(filepath.Separator) || name == "" {
		return "image"
	}
	return name
}

func buildCipherPath(id string) string {
	return filepath.Join("attachments", id[:2], id[2:4], id+".enc")
}

func (s *Service) CreateImage(input CreateImageInput) (*Attachment, error) {
	key, err := s.getMasterKey()
	if err != nil {
		return nil, err
	}
	if len(input.Data) == 0 {
		return nil, errors.New("image data is required")
	}
	mimeType, err := normalizeImageMIME(input.MIMEType)
	if err != nil {
		return nil, err
	}

	ciphertext, err := s.crypto.Encrypt(key, input.Data)
	if err != nil {
		return nil, err
	}

	id := uuid.New().String()
	cipherPath := buildCipherPath(id)
	fullPath := filepath.Join(s.dataDir, cipherPath)
	if err := os.MkdirAll(filepath.Dir(fullPath), 0700); err != nil {
		return nil, err
	}
	tempPath := fullPath + ".tmp"
	if err := os.WriteFile(tempPath, ciphertext, 0600); err != nil {
		return nil, err
	}
	if err := os.Rename(tempPath, fullPath); err != nil {
		_ = os.Remove(tempPath)
		return nil, err
	}

	sum := sha256.Sum256(input.Data)
	now := time.Now()
	meta := &database.AttachmentMeta{
		ID:           id,
		OriginalName: sanitizeName(input.OriginalName),
		MIMEType:     mimeType,
		Size:         int64(len(input.Data)),
		Width:        input.Width,
		Height:       input.Height,
		CipherPath:   cipherPath,
		SHA256:       hex.EncodeToString(sum[:]),
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	if err := s.db.CreateAttachment(meta); err != nil {
		_ = os.Remove(fullPath)
		return nil, err
	}
	if input.NoteID != "" {
		if err := s.db.AddNoteAttachment(input.NoteID, id); err != nil {
			_ = s.db.DeleteAttachment(id)
			_ = os.Remove(fullPath)
			return nil, err
		}
		meta.ReferenceCount = 1
	}

	return attachmentFromMeta(meta), nil
}

func (s *Service) GetDataURL(id string) (string, error) {
	attachment, plaintext, err := s.GetData(id)
	if err != nil {
		return "", err
	}
	return "data:" + attachment.MIMEType + ";base64," + base64.StdEncoding.EncodeToString(plaintext), nil
}

func (s *Service) GetData(id string) (*Attachment, []byte, error) {
	key, err := s.getMasterKey()
	if err != nil {
		return nil, nil, err
	}
	meta, err := s.db.GetAttachment(id)
	if err != nil {
		return nil, nil, err
	}
	ciphertext, err := os.ReadFile(filepath.Join(s.dataDir, meta.CipherPath))
	if err != nil {
		return nil, nil, err
	}
	plaintext, err := s.crypto.Decrypt(key, ciphertext)
	if err != nil {
		return nil, nil, err
	}
	return attachmentFromMeta(meta), plaintext, nil
}

func (s *Service) ListImages() ([]*Attachment, error) {
	items, err := s.db.ListAttachments()
	if err != nil {
		return nil, err
	}
	result := make([]*Attachment, 0, len(items))
	for _, item := range items {
		result = append(result, attachmentFromMeta(item))
	}
	return result, nil
}

func (s *Service) Delete(id string) error {
	meta, err := s.db.GetAttachment(id)
	if err != nil {
		return err
	}
	if err := s.db.DeleteAttachment(id); err != nil {
		return err
	}
	if err := os.Remove(filepath.Join(s.dataDir, meta.CipherPath)); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}

func (s *Service) AttachToNote(noteID, attachmentID string) error {
	return s.db.AddNoteAttachment(noteID, attachmentID)
}

func (s *Service) DetachFromNote(noteID, attachmentID string) error {
	return s.db.RemoveNoteAttachment(noteID, attachmentID)
}
