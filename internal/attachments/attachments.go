package attachments

import (
	"bytes"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"image"
	"image/color"
	imagedraw "image/draw"
	_ "image/gif"
	"image/jpeg"
	_ "image/png"
	"locknote/internal/crypto"
	"locknote/internal/database"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	xdraw "golang.org/x/image/draw"
	_ "golang.org/x/image/webp"
)

type Service struct {
	db        *database.DB
	dataDir   string
	crypto    *crypto.Service
	masterKey []byte
	mu        sync.RWMutex
}

const thumbnailMaxPixelSize = 384

type CreateImageInput struct {
	OriginalName string
	MIMEType     string
	Data         []byte
	NoteID       string
	Width        int
	Height       int
}

type Attachment struct {
	ID             string  `json:"id"`
	OriginalName   string  `json:"originalName"`
	MIMEType       string  `json:"mimeType"`
	Size           int64   `json:"size"`
	Width          int     `json:"width"`
	Height         int     `json:"height"`
	CipherPath     string  `json:"cipherPath"`
	SHA256         string  `json:"sha256"`
	Favorite       bool    `json:"favorite"`
	CreatedAt      string  `json:"createdAt"`
	UpdatedAt      string  `json:"updatedAt"`
	DeletedAt      *string `json:"deletedAt,omitempty"`
	ReferenceCount int     `json:"referenceCount"`
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

func formatTimePtr(t *time.Time) *string {
	if t == nil {
		return nil
	}
	formatted := t.Format(time.RFC3339Nano)
	return &formatted
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
		Favorite:       meta.Favorite,
		CreatedAt:      formatTime(meta.CreatedAt),
		UpdatedAt:      formatTime(meta.UpdatedAt),
		DeletedAt:      formatTimePtr(meta.DeletedAt),
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

func ParseImageDataURL(dataURL string) (string, []byte, error) {
	const base64Marker = ";base64,"
	if !strings.HasPrefix(dataURL, "data:") {
		return "", nil, errors.New("invalid image data URL")
	}
	parts := strings.SplitN(strings.TrimPrefix(dataURL, "data:"), base64Marker, 2)
	if len(parts) != 2 {
		return "", nil, errors.New("invalid image data URL")
	}
	mimeType := strings.ToLower(strings.TrimSpace(parts[0]))
	if !strings.HasPrefix(mimeType, "image/") {
		return "", nil, errors.New("data URL is not an image")
	}
	data, err := base64.StdEncoding.DecodeString(parts[1])
	if err != nil {
		return "", nil, err
	}
	return mimeType, data, nil
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

func buildThumbnailCipherPath(id string) string {
	return filepath.Join("attachments", id[:2], id[2:4], id+".thumb.enc")
}

func normalizeThumbnailImageBounds(bounds image.Rectangle, maxPixelSize int) image.Rectangle {
	width := bounds.Dx()
	height := bounds.Dy()
	if width <= 0 || height <= 0 {
		return image.Rect(0, 0, 0, 0)
	}
	if maxPixelSize <= 0 || (width <= maxPixelSize && height <= maxPixelSize) {
		return image.Rect(0, 0, width, height)
	}

	if width >= height {
		scaledHeight := int(float64(height) * float64(maxPixelSize) / float64(width))
		if scaledHeight < 1 {
			scaledHeight = 1
		}
		return image.Rect(0, 0, maxPixelSize, scaledHeight)
	}

	scaledWidth := int(float64(width) * float64(maxPixelSize) / float64(height))
	if scaledWidth < 1 {
		scaledWidth = 1
	}
	return image.Rect(0, 0, scaledWidth, maxPixelSize)
}

func decodeThumbnailSource(data []byte) (image.Image, error) {
	img, _, err := image.Decode(bytes.NewReader(data))
	return img, err
}

func encodeThumbnailJPEG(src image.Image, maxPixelSize int) ([]byte, error) {
	bounds := src.Bounds()
	dstBounds := normalizeThumbnailImageBounds(bounds, maxPixelSize)
	if dstBounds.Empty() {
		return nil, errors.New("image is empty")
	}

	dst := image.NewRGBA(dstBounds)
	imagedraw.Draw(dst, dst.Bounds(), &image.Uniform{C: color.White}, image.Point{}, imagedraw.Src)
	xdraw.ApproxBiLinear.Scale(dst, dst.Bounds(), src, bounds, xdraw.Over, nil)

	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, dst, &jpeg.Options{Quality: 82}); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func makeThumbnailBytes(data []byte, maxPixelSize int) ([]byte, error) {
	src, err := decodeThumbnailSource(data)
	if err != nil {
		return nil, err
	}
	return encodeThumbnailJPEG(src, maxPixelSize)
}

func (s *Service) writeEncryptedBytes(cipherPath string, key []byte, plaintext []byte) error {
	ciphertext, err := s.crypto.Encrypt(key, plaintext)
	if err != nil {
		return err
	}

	fullPath := filepath.Join(s.dataDir, cipherPath)
	if err := os.MkdirAll(filepath.Dir(fullPath), 0700); err != nil {
		return err
	}

	tempPath := fullPath + "." + uuid.NewString() + ".tmp"
	if err := os.WriteFile(tempPath, ciphertext, 0600); err != nil {
		return err
	}
	if err := os.Rename(tempPath, fullPath); err != nil {
		_ = os.Remove(tempPath)
		return err
	}
	return nil
}

func (s *Service) readEncryptedBytes(cipherPath string, key []byte) ([]byte, error) {
	ciphertext, err := os.ReadFile(filepath.Join(s.dataDir, cipherPath))
	if err != nil {
		return nil, err
	}
	return s.crypto.Decrypt(key, ciphertext)
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

	if thumbnailBytes, err := makeThumbnailBytes(input.Data, thumbnailMaxPixelSize); err == nil {
		_ = s.writeEncryptedBytes(buildThumbnailCipherPath(id), key, thumbnailBytes)
	}

	return attachmentFromMeta(meta), nil
}

func (s *Service) CreateImageFromDataURL(noteID, originalName, dataURL string) (*Attachment, error) {
	mimeType, data, err := ParseImageDataURL(dataURL)
	if err != nil {
		return nil, err
	}
	return s.CreateImage(CreateImageInput{
		OriginalName: originalName,
		MIMEType:     mimeType,
		Data:         data,
		NoteID:       noteID,
	})
}

func (s *Service) GetDataURL(id string) (string, error) {
	attachment, plaintext, err := s.GetData(id)
	if err != nil {
		return "", err
	}
	return "data:" + attachment.MIMEType + ";base64," + base64.StdEncoding.EncodeToString(plaintext), nil
}

func (s *Service) GetThumbnailDataURL(id string) (string, error) {
	key, err := s.getMasterKey()
	if err != nil {
		return "", err
	}

	if _, err := s.db.GetAttachment(id); err != nil {
		return "", err
	}

	if plaintext, err := s.readEncryptedBytes(buildThumbnailCipherPath(id), key); err == nil {
		return "data:image/jpeg;base64," + base64.StdEncoding.EncodeToString(plaintext), nil
	}

	_, originalData, err := s.GetData(id)
	if err != nil {
		return "", err
	}
	thumbnailBytes, err := makeThumbnailBytes(originalData, thumbnailMaxPixelSize)
	if err != nil {
		return s.GetDataURL(id)
	}
	_ = s.writeEncryptedBytes(buildThumbnailCipherPath(id), key, thumbnailBytes)
	return "data:image/jpeg;base64," + base64.StdEncoding.EncodeToString(thumbnailBytes), nil
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

func (s *Service) ListDeletedImages() ([]*Attachment, error) {
	items, err := s.db.ListDeletedAttachments()
	if err != nil {
		return nil, err
	}
	result := make([]*Attachment, 0, len(items))
	for _, item := range items {
		result = append(result, attachmentFromMeta(item))
	}
	return result, nil
}

func (s *Service) SoftDelete(id string) error {
	return s.db.SoftDeleteAttachment(id)
}

func (s *Service) Restore(id string) error {
	return s.db.RestoreAttachment(id)
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
	if err := os.Remove(filepath.Join(s.dataDir, buildThumbnailCipherPath(id))); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}

func (s *Service) SetFavorite(id string, favorite bool) error {
	return s.db.SetAttachmentFavorite(id, favorite)
}

func (s *Service) AttachToNote(noteID, attachmentID string) error {
	return s.db.AddNoteAttachment(noteID, attachmentID)
}

func (s *Service) DetachFromNote(noteID, attachmentID string) error {
	return s.db.RemoveNoteAttachment(noteID, attachmentID)
}
