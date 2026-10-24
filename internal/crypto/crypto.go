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
	"math/big"
	"strings"
	"unicode/utf8"

	"golang.org/x/crypto/argon2"
)

const (
	// displayKeyLength 是恢复密钥的固定长度。
	displayKeyLength = 16
	// displayKeyAlphabet 是 Crockford Base32：去掉 I、L、O、U，避免与 1、0 混淆。
	displayKeyAlphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
	// dataKeySaltV2 是 v2 密钥派生的固定盐。
	// 恢复密钥需要在没有本地状态的新设备上派生出同一个 dataKey，因此盐必须是常量。
	dataKeySaltV2 = "locknote.datakey.v2"
)

// ErrInvalidDisplayKey 表示恢复密钥格式不符合要求。
var ErrInvalidDisplayKey = errors.New("invalid key format")

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
	key := make([]byte, displayKeyLength)
	alphabetLen := big.NewInt(int64(len(displayKeyAlphabet)))
	for i := range key {
		idx, err := rand.Int(rand.Reader, alphabetLen)
		if err != nil {
			return "", err
		}
		key[i] = displayKeyAlphabet[idx.Int64()]
	}
	return string(key), nil
}

// NormalizeDisplayKey 归一化用户输入的恢复密钥：去掉空白与分隔符、转大写，
// 并把易混淆字符按 Crockford 规则映射（I/L→1，O→0）。
func NormalizeDisplayKey(input string) (string, error) {
	replacer := strings.NewReplacer("-", "", " ", "", "\t", "", "_", "")
	normalized := strings.ToUpper(replacer.Replace(strings.TrimSpace(input)))
	normalized = strings.NewReplacer("I", "1", "L", "1", "O", "0").Replace(normalized)

	if len(normalized) != displayKeyLength {
		return "", ErrInvalidDisplayKey
	}
	for _, r := range normalized {
		if !strings.ContainsRune(displayKeyAlphabet, r) {
			return "", ErrInvalidDisplayKey
		}
	}
	return normalized, nil
}

// DeriveDataKeyV2 使用 Argon2id 从恢复密钥派生 dataKey（当前版本）。
func (s *Service) DeriveDataKeyV2(displayKey string) []byte {
	return argon2.IDKey([]byte(displayKey), []byte(dataKeySaltV2), 3, 64*1024, 4, 32)
}

// ParseDisplayKeyV2 校验格式后按当前版本派生 dataKey。
// 新建密码库只接受 16 位 Crockford Base32 密钥。
func (s *Service) ParseDisplayKeyV2(displayKey string) ([]byte, error) {
	normalized, err := NormalizeDisplayKey(displayKey)
	if err != nil {
		return nil, err
	}
	return s.DeriveDataKeyV2(normalized), nil
}

// DataKeyCandidates 返回用于校验恢复密钥的候选 dataKey，顺序为：
// 当前版本（Argon2id）在前，历史版本（单次 SHA-256）在后。
// 历史版本仅用于兼容 1.1.0 之前创建的密码库，不做任何内容重加密。
func (s *Service) DataKeyCandidates(displayKey string) [][]byte {
	candidates := make([][]byte, 0, 2)
	if normalized, err := NormalizeDisplayKey(displayKey); err == nil {
		candidates = append(candidates, s.DeriveDataKeyV2(normalized))
	}
	if legacy, err := s.ParseDisplayKey(displayKey); err == nil {
		candidates = append(candidates, legacy)
	}
	return candidates
}

// DeriveDataKey 是历史版本的派生方式：单次 SHA-256，无盐、无 KDF。
// 仅用于读取 1.1.0 之前创建的密码库。
func (s *Service) DeriveDataKey(displayKey string) []byte {
	hash := sha256.Sum256([]byte(displayKey))
	return hash[:]
}

// ParseDisplayKey 是历史版本的宽松校验：只限制 5-32 个字符，不限制字符集。
// 保留它是为了让旧密码库仍能用恢复密钥重置密码或导入备份。
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
