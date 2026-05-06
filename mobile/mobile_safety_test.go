package mobile

import (
	"fmt"
	"locknote/internal/core"
	"os"
	"regexp"
	"strings"
	"sync"
	"testing"
)

func TestMobileAPIsRecoverPanicsAsErrors(t *testing.T) {
	coreInstance = &core.Core{}
	t.Cleanup(func() {
		coreInstance = nil
	})

	defer func() {
		if recovered := recover(); recovered != nil {
			t.Fatalf("mobile panic escaped gomobile boundary: %v", recovered)
		}
	}()

	_, err := ListNotes()
	if err == nil {
		t.Fatal("ListNotes returned nil error after internal panic")
	}
	if !strings.Contains(err.Error(), "panic") {
		t.Fatalf("ListNotes error = %q, want panic context", err.Error())
	}
}

func TestAllMobileExportsUseSafetyWrapper(t *testing.T) {
	sourceBytes, err := os.ReadFile("mobile.go")
	if err != nil {
		t.Fatalf("read mobile source: %v", err)
	}
	source := string(sourceBytes)

	exportedFuncPattern := regexp.MustCompile(`(?m)^func ([A-Z][A-Za-z0-9_]*)\([^)]*\)(?: \([^)]*\)| [^{]+)? \{`)
	matches := exportedFuncPattern.FindAllStringSubmatchIndex(source, -1)
	if len(matches) == 0 {
		t.Fatal("no exported mobile APIs found")
	}

	for i, match := range matches {
		name := source[match[2]:match[3]]
		bodyStart := match[1]
		bodyEnd := len(source)
		if i+1 < len(matches) {
			bodyEnd = matches[i+1][0]
		}
		body := source[bodyStart:bodyEnd]
		if !strings.Contains(body, "mobileCall") {
			t.Fatalf("mobile API %s must use a mobileCall safety wrapper", name)
		}
	}
}

func TestMobileSafetyWrappersLockAndRecover(t *testing.T) {
	sourceBytes, err := os.ReadFile("mobile.go")
	if err != nil {
		t.Fatalf("read mobile source: %v", err)
	}
	source := string(sourceBytes)

	for _, wrapper := range []string{
		"mobileCall",
		"mobileCallError",
		"mobileCallValue",
		"mobileCallVoid",
	} {
		start := strings.Index(source, "func "+wrapper)
		if start < 0 {
			t.Fatalf("%s wrapper not found", wrapper)
		}
		bodyEnd := len(source)
		if next := strings.Index(source[start+1:], "\nfunc "); next >= 0 {
			bodyEnd = start + 1 + next
		}
		body := source[start:bodyEnd]
		if !strings.Contains(body, "mobileMu.Lock()") || !strings.Contains(body, "defer mobileMu.Unlock()") {
			t.Fatalf("%s must serialize gomobile calls with mobileMu", wrapper)
		}
		if !strings.Contains(body, "recover()") {
			t.Fatalf("%s must recover panics at the gomobile boundary", wrapper)
		}
	}
}

func TestMobileAPIsAreSafeForConcurrentCalls(t *testing.T) {
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

	var wg sync.WaitGroup
	errCh := make(chan error, 96)
	for worker := 0; worker < 16; worker++ {
		worker := worker
		wg.Add(1)
		go func() {
			defer wg.Done()
			for iteration := 0; iteration < 6; iteration++ {
				title := fmt.Sprintf("worker-%02d-note-%02d", worker, iteration)
				if _, err := CreateNote(title, "content"); err != nil {
					errCh <- fmt.Errorf("create note: %w", err)
					return
				}
				if _, err := ListNotes(); err != nil {
					errCh <- fmt.Errorf("list notes: %w", err)
					return
				}
				if _, err := GetSettings(); err != nil {
					errCh <- fmt.Errorf("get settings: %w", err)
					return
				}
				UpdateActivity()
				_ = IsUnlocked()
			}
		}()
	}
	wg.Wait()
	close(errCh)

	for err := range errCh {
		t.Fatal(err)
	}
}
