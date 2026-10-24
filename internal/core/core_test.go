package core

import (
	"os"
	"path/filepath"
	"testing"
)

func newTestCore(t *testing.T) *Core {
	t.Helper()
	c, err := New(t.TempDir())
	if err != nil {
		t.Fatalf("create core: %v", err)
	}
	t.Cleanup(c.Close)
	return c
}

func TestSetupPasswordCannotOverwriteExistingVault(t *testing.T) {
	c := newTestCore(t)
	result, err := c.SetupPassword("original-pass", "", "ABCDEFGHJKMNPQRS")
	if err != nil {
		t.Fatalf("setup password: %v", err)
	}
	firstRun, err := c.IsFirstRun()
	if err != nil || firstRun {
		t.Fatalf("IsFirstRun() = %v, %v; want false, nil", firstRun, err)
	}
	if _, err := c.SetupPassword("replacement-pass", "", "23456789ABCDEFGH"); err == nil {
		t.Fatal("expected second setup to be rejected")
	}
	c.Lock()
	unlocked, err := c.Unlock("original-pass")
	if err != nil || !unlocked {
		t.Fatalf("original password unlock = %v, %v; want true, nil", unlocked, err)
	}
	if _, err := c.cryptoService.ParseDisplayKeyV2(result.DataKey); err != nil {
		t.Fatalf("setup returned invalid recovery key: %v", err)
	}
}

func TestSetupPasswordRejectsInvalidDisplayKeyWithoutVerifier(t *testing.T) {
	c := newTestCore(t)
	if _, err := c.SetupPassword("valid-pass", "", "1234"); err == nil {
		t.Fatal("expected invalid display key to be rejected")
	}
	firstRun, err := c.IsFirstRun()
	if err != nil || !firstRun {
		t.Fatalf("IsFirstRun() = %v, %v; want true, nil", firstRun, err)
	}
	if _, err := os.Stat(c.dataKeyVerifierFilePath()); !os.IsNotExist(err) {
		t.Fatalf("verifier file stat error = %v, want not-exist", err)
	}
}

func TestSetupPasswordVerifierWriteFailureLeavesVaultUninitialized(t *testing.T) {
	c := newTestCore(t)
	if err := os.Mkdir(c.dataKeyVerifierFilePath(), 0700); err != nil {
		t.Fatalf("create verifier directory: %v", err)
	}
	if _, err := c.SetupPassword("valid-pass", "", "ABCDEFGHJKMNPQRS"); err == nil {
		t.Fatal("expected verifier write failure")
	}
	firstRun, err := c.IsFirstRun()
	if err != nil || !firstRun {
		t.Fatalf("IsFirstRun() = %v, %v; want true, nil", firstRun, err)
	}
}

func TestUnlockChangePasswordResetAndLock(t *testing.T) {
	c := newTestCore(t)
	setup, err := c.SetupPassword("original-pass", "", "ABCDEFGHJKMNPQRS")
	if err != nil {
		t.Fatalf("setup password: %v", err)
	}
	c.Lock()
	if unlocked, err := c.Unlock("wrong-pass"); err != nil || unlocked {
		t.Fatalf("wrong password unlock = %v, %v; want false, nil", unlocked, err)
	}
	if err := c.ChangePassword("original-pass", "changed-pass", "new hint"); err != nil {
		t.Fatalf("change password: %v", err)
	}
	c.Lock()
	if unlocked, err := c.Unlock("changed-pass"); err != nil || !unlocked {
		t.Fatalf("changed password unlock = %v, %v; want true, nil", unlocked, err)
	}
	c.Lock()
	if err := c.ResetPasswordWithDataKey(setup.DataKey, "reset-pass", "reset hint"); err != nil {
		t.Fatalf("reset password: %v", err)
	}
	c.Lock()
	if unlocked, err := c.Unlock("reset-pass"); err != nil || !unlocked {
		t.Fatalf("reset password unlock = %v, %v; want true, nil", unlocked, err)
	}
	c.Lock()
	if c.IsUnlocked() {
		t.Fatal("core remained unlocked after Lock")
	}
}

func TestSetupPasswordVerifierPathIsInDataDirectory(t *testing.T) {
	c := newTestCore(t)
	if filepath.Dir(c.dataKeyVerifierFilePath()) != c.dataDir {
		t.Fatalf("verifier path %q is not in data directory %q", c.dataKeyVerifierFilePath(), c.dataDir)
	}
}

func TestVerifyDataKeyNormalizesInput(t *testing.T) {
	c := newTestCore(t)
	const key = "ABCDEFGHJKMNPQRS"
	if _, err := c.SetupPassword("valid-pass", "", key); err != nil {
		t.Fatalf("setup password: %v", err)
	}

	for _, variant := range []string{"abcdefghjkmnpqrs", "ABCD-EFGH-JKMN-PQRS", " abcdefgh jkmn pqrs "} {
		ok, err := c.VerifyDataKey(variant)
		if err != nil || !ok {
			t.Fatalf("VerifyDataKey(%q) = %v, %v; want true, nil", variant, ok, err)
		}
	}

	if ok, err := c.VerifyDataKey("ABCDEFGHJKMNPQRT"); err != nil || ok {
		t.Fatalf("wrong key verification = %v, %v; want false, nil", ok, err)
	}
}

// TestVerifyDataKeyFallsBackToLegacyDerivation 模拟 1.1.0 之前创建的密码库：
// 校验文件由历史派生方式（单次 SHA-256）加密，验证逻辑应仍能识别。
func TestVerifyDataKeyFallsBackToLegacyDerivation(t *testing.T) {
	c := newTestCore(t)
	const key = "ABCDEFGHJKMNPQRS"
	if _, err := c.SetupPassword("valid-pass", "", key); err != nil {
		t.Fatalf("setup password: %v", err)
	}

	legacyKey := c.cryptoService.DeriveDataKey(key)
	ciphertext, err := c.cryptoService.Encrypt(legacyKey, []byte(dataKeyVerifierPlaintext))
	if err != nil {
		t.Fatalf("encrypt legacy verifier: %v", err)
	}
	if err := os.WriteFile(c.dataKeyVerifierFilePath(), ciphertext, 0600); err != nil {
		t.Fatalf("write legacy verifier: %v", err)
	}

	ok, err := c.VerifyDataKey(key)
	if err != nil || !ok {
		t.Fatalf("legacy verifier verification = %v, %v; want true, nil", ok, err)
	}
}

func TestSetupPasswordRejectsShortRecoveryKey(t *testing.T) {
	c := newTestCore(t)
	if _, err := c.SetupPassword("valid-pass", "", "ABCDE"); err == nil {
		t.Fatal("expected 5-character recovery key to be rejected")
	}
	firstRun, err := c.IsFirstRun()
	if err != nil || !firstRun {
		t.Fatalf("IsFirstRun() = %v, %v; want true, nil", firstRun, err)
	}
}
