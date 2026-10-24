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

func TestNormalizeDisplayKey(t *testing.T) {
	cases := map[string]string{
		"abcdefghjkmnpqrs":     "ABCDEFGHJKMNPQRS",
		"ABCD-EFGH-JKMN-PQRS":  "ABCDEFGHJKMNPQRS",
		"  abcd efgh jkmn pqrs ": "ABCDEFGHJKMNPQRS",
		"ABCDEFGHJKMNPQIL":     "ABCDEFGHJKMNPQ11",
	}
	for input, want := range cases {
		got, err := NormalizeDisplayKey(input)
		if err != nil {
			t.Fatalf("NormalizeDisplayKey(%q): %v", input, err)
		}
		if got != want {
			t.Errorf("NormalizeDisplayKey(%q) = %q, want %q", input, got, want)
		}
	}

	for _, invalid := range []string{"", "1234", "ABCDEFGHJKMNPQR", "ABCDEFGHJKMNPQRSX", "ABCDEFGHJKMNPQR$"} {
		if _, err := NormalizeDisplayKey(invalid); err == nil {
			t.Errorf("NormalizeDisplayKey(%q) succeeded, want error", invalid)
		}
	}
}

func TestParseDisplayKeyV2RejectsWeakKeys(t *testing.T) {
	service := NewService()
	for _, weak := range []string{"12345", "abcde", "ABCDE"} {
		if _, err := service.ParseDisplayKeyV2(weak); err == nil {
			t.Errorf("ParseDisplayKeyV2(%q) succeeded, want error", weak)
		}
	}
	if _, err := service.ParseDisplayKeyV2("ABCDEFGHJKMNPQRS"); err != nil {
		t.Fatalf("valid key rejected: %v", err)
	}
}

func TestDataKeyCandidatesPreferCurrentDerivation(t *testing.T) {
	service := NewService()
	const key = "ABCDEFGHJKMNPQRS"

	candidates := service.DataKeyCandidates(key)
	if len(candidates) != 2 {
		t.Fatalf("candidates = %d, want 2", len(candidates))
	}
	if !bytes.Equal(candidates[0], service.DeriveDataKeyV2(key)) {
		t.Fatal("first candidate should use the current Argon2id derivation")
	}
	if !bytes.Equal(candidates[1], service.DeriveDataKey(key)) {
		t.Fatal("second candidate should use the legacy SHA-256 derivation")
	}
	if bytes.Equal(candidates[0], candidates[1]) {
		t.Fatal("current and legacy derivations must differ")
	}
}

func TestGenerateDataKeyAvoidsAmbiguousCharacters(t *testing.T) {
	service := NewService()
	for i := 0; i < 50; i++ {
		key, err := service.GenerateDataKey()
		if err != nil {
			t.Fatalf("generate data key: %v", err)
		}
		if _, err := NormalizeDisplayKey(key); err != nil {
			t.Fatalf("generated key %q does not normalize: %v", key, err)
		}
		for _, bad := range []string{"I", "L", "O", "U"} {
			if bytes.Contains([]byte(key), []byte(bad)) {
				t.Fatalf("generated key %q contains ambiguous character %q", key, bad)
			}
		}
	}
}
