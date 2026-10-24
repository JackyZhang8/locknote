package crypto

import (
	"bytes"
	"regexp"
	"testing"
)

func TestEncryptDecryptRoundTrip(t *testing.T) {
	service := NewService()
	key := bytes.Repeat([]byte{3}, 32)
	plaintext := []byte("secret note")
	ciphertext, err := service.Encrypt(key, plaintext)
	if err != nil {
		t.Fatalf("encrypt: %v", err)
	}
	got, err := service.Decrypt(key, ciphertext)
	if err != nil {
		t.Fatalf("decrypt: %v", err)
	}
	if !bytes.Equal(got, plaintext) {
		t.Fatalf("decrypted = %q, want %q", got, plaintext)
	}
}

func TestDecryptRejectsTamperedCiphertextAndWrongKey(t *testing.T) {
	service := NewService()
	key := bytes.Repeat([]byte{4}, 32)
	ciphertext, err := service.Encrypt(key, []byte("secret"))
	if err != nil {
		t.Fatalf("encrypt: %v", err)
	}
	tampered := append([]byte(nil), ciphertext...)
	tampered[len(tampered)-1] ^= 0xff
	if _, err := service.Decrypt(key, tampered); err == nil {
		t.Fatal("expected tampered ciphertext to fail")
	}
	if _, err := service.Decrypt(bytes.Repeat([]byte{5}, 32), ciphertext); err == nil {
		t.Fatal("expected wrong key to fail")
	}
	if _, err := service.Decrypt(key, []byte{}); err == nil {
		t.Fatal("expected too-short ciphertext to fail")
	}
}

func TestParseDisplayKeyBounds(t *testing.T) {
	service := NewService()
	for _, input := range []string{"1234", "123456789012345678901234567890123"} {
		if _, err := service.ParseDisplayKey(input); err == nil {
			t.Errorf("ParseDisplayKey(%q) succeeded outside bounds", input)
		}
	}
	for _, input := range []string{"12345", "12345678901234567890123456789012"} {
		if _, err := service.ParseDisplayKey(input); err != nil {
			t.Errorf("ParseDisplayKey(%q): %v", input, err)
		}
	}
}

func TestGenerateDataKeyFormat(t *testing.T) {
	key, err := NewService().GenerateDataKey()
	if err != nil {
		t.Fatalf("generate data key: %v", err)
	}
	if !regexp.MustCompile(`^[0-9A-Z]{16}$`).MatchString(key) {
		t.Fatalf("generated key %q does not match expected format", key)
	}
}
