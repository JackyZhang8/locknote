package main

import (
	"encoding/xml"
	"errors"
	"strings"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// ExportDiagramSVG uses a native save dialog, since WebView blob downloads do
// not open a save dialog consistently on desktop platforms.
func (a *App) ExportDiagramSVG(svg string) (string, error) {
	a.UpdateActivity()
	return saveDiagramSVG(svg, func() (string, error) {
		return runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
			Title:           "流程图另存为",
			DefaultFilename: "flowchart.svg",
			Filters: []runtime.FileFilter{
				{DisplayName: "SVG 图表", Pattern: "*.svg"},
			},
		})
	})
}

func saveDiagramSVG(svg string, choosePath func() (string, error)) (string, error) {
	var root struct{ XMLName xml.Name }
	if err := xml.Unmarshal([]byte(svg), &root); err != nil || root.XMLName.Local != "svg" {
		return "", errors.New("图表不是有效的 SVG，无法保存")
	}
	path, err := choosePath()
	if err != nil || path == "" {
		return "", err
	}
	if !strings.HasSuffix(strings.ToLower(path), ".svg") {
		path += ".svg"
	}
	if err := writeFileAtomic(path, []byte(svg)); err != nil {
		return "", err
	}
	return path, nil
}
