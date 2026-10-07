package main

import (
	"errors"
	"os"
	"path/filepath"
	"testing"
)

const testDiagramSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="900" viewBox="0 0 640 900"><text>用户输入</text></svg>`

func TestSaveDiagramSVGWritesSelectedFile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "流程图.svg")
	got, err := saveDiagramSVG(testDiagramSVG, func() (string, error) { return path, nil })
	if err != nil || got != path {
		t.Fatalf("save returned %q, %v", got, err)
	}
	data, err := os.ReadFile(path)
	if err != nil || string(data) != testDiagramSVG {
		t.Fatalf("saved SVG differs: %s, %v", data, err)
	}
}

func TestSaveDiagramSVGCancelDoesNotWrite(t *testing.T) {
	got, err := saveDiagramSVG(testDiagramSVG, func() (string, error) { return "", nil })
	if got != "" || err != nil {
		t.Fatalf("cancel returned %q, %v", got, err)
	}
}

func TestSaveDiagramSVGAddsMissingExtension(t *testing.T) {
	path := filepath.Join(t.TempDir(), "流程图")
	got, err := saveDiagramSVG(testDiagramSVG, func() (string, error) { return path, nil })
	if err != nil || got != path+".svg" {
		t.Fatalf("save returned %q, %v", got, err)
	}
}

func TestSaveDiagramSVGReportsDialogAndWriteErrors(t *testing.T) {
	want := errors.New("dialog failed")
	if _, err := saveDiagramSVG(testDiagramSVG, func() (string, error) { return "", want }); !errors.Is(err, want) {
		t.Fatalf("dialog error: %v", err)
	}
	path := filepath.Join(t.TempDir(), "missing", "flowchart.svg")
	if _, err := saveDiagramSVG(testDiagramSVG, func() (string, error) { return path, nil }); err == nil {
		t.Fatal("expected a file write error")
	}
}

func TestSaveDiagramSVGRejectsInvalidContentBeforeOpeningDialog(t *testing.T) {
	for _, svg := range []string{"", "<html>invalid</html>", "<svg><broken></svg>"} {
		opened := false
		_, err := saveDiagramSVG(svg, func() (string, error) { opened = true; return "", nil })
		if err == nil || opened {
			t.Fatalf("invalid SVG %q: error=%v, opened=%v", svg, err, opened)
		}
	}
}
