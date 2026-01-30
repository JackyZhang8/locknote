// https://github.com/JackyZhang8/locknote
// 一个简单、可靠、离线优先的桌面加密笔记软件。
// A simple, reliable, offline-first encrypted note-taking desktop app.
package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"errors"
	"io"
	"unicode/utf8"

	"golang.org/x/crypto/argon2"
)

type Service struct{}

func NewService() *Service {
	return &Service{}
}

func (s *Service) GenerateSalt() ([]byte, error) {
	salt := make([]byte, 16)
	_, err := io.ReadFull(rand.Reader, salt)
	return salt, err
}

func (s *Service) DeriveKey(password string, salt []byte) []byte {
	return argon2.IDKey([]byte(password), salt, 3, 64*1024, 4, 32)
}

func (s *Service) GenerateDataKey() (string, error) {
	const charset = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
	const length = 16
	key := make([]byte, length)
	rnd := make([]byte, length)
	_, err := io.ReadFull(rand.Reader, rnd)
	if err != nil {
		return "", err
	}
	for i, b := range rnd {
		key[i] = charset[int(b)%len(charset)]
	}
	return string(key), nil
}

func (s *Service) DeriveDataKey(displayKey string) []byte {
	hash := sha256.Sum256([]byte(displayKey))
	return hash[:]
}

func (s *Service) ParseDisplayKey(displayKey string) ([]byte, error) {
	runeCount := utf8.RuneCountInString(displayKey)
	if runeCount < 5 || runeCount > 32 {
		return nil, errors.New("invalid key length")
	}
	return s.DeriveDataKey(displayKey), nil
}

func (s *Service) Encrypt(key, plaintext []byte) ([]byte, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}

	ciphertext := gcm.Seal(nonce, nonce, plaintext, nil)
	return ciphertext, nil
}

func (s *Service) Decrypt(key, ciphertext []byte) ([]byte, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	if len(ciphertext) < gcm.NonceSize() {
		return nil, errors.New("ciphertext too short")
	}

	nonce, ciphertext := ciphertext[:gcm.NonceSize()], ciphertext[gcm.NonceSize():]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, errors.New("decryption failed: invalid password or corrupted data")
	}

	return plaintext, nil
}

func (s *Service) EncryptFile(key, plaintext []byte) ([]byte, error) {
	return s.Encrypt(key, plaintext)
}

func (s *Service) DecryptFile(key, ciphertext []byte) ([]byte, error) {
	return s.Decrypt(key, ciphertext)
}
