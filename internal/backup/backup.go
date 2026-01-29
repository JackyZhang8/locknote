// https://github.com/JackyZhang8/locknote
// 一个简单、可靠、离线优先的桌面加密笔记软件。
// A simple, reliable, offline-first encrypted note-taking desktop app.
package backup

import (
	"archive/zip"
	"io"
	"os"
	"path/filepath"
	"strings"
)

type Service struct {
	dataDir string
}

func NewService(dataDir string) *Service {
	return &Service{dataDir: dataDir}
}

func (s *Service) ExtractBackupToTemp(inputPath string) (string, error) {
	tempDir, err := os.MkdirTemp("", "locknote-import-*")
	if err != nil {
		return "", err
	}

	reader, err := zip.OpenReader(inputPath)
	if err != nil {
		os.RemoveAll(tempDir)
		return "", err
	}
	defer reader.Close()

	for _, file := range reader.File {
		destPath := filepath.Join(tempDir, file.Name)
		cleanDestPath := filepath.Clean(destPath)

		if !strings.HasPrefix(cleanDestPath, filepath.Clean(tempDir)+string(os.PathSeparator)) {
			continue
		}

		if file.FileInfo().IsDir() {
			os.MkdirAll(cleanDestPath, 0700)
			continue
		}

		if err := os.MkdirAll(filepath.Dir(cleanDestPath), 0700); err != nil {
			os.RemoveAll(tempDir)
			return "", err
		}

		destFile, err := os.OpenFile(cleanDestPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0600)
		if err != nil {
			os.RemoveAll(tempDir)
			return "", err
		}

		srcFile, err := file.Open()
		if err != nil {
			destFile.Close()
			os.RemoveAll(tempDir)
			return "", err
		}

		_, err = io.Copy(destFile, srcFile)
		srcFile.Close()
		destFile.Close()

		if err != nil {
			os.RemoveAll(tempDir)
			return "", err
		}
	}

	return tempDir, nil
}

func (s *Service) CleanupTempDir(tempDir string) {
	os.RemoveAll(tempDir)
}

func (s *Service) CreateBackup(outputPath string) error {
	zipFile, err := os.Create(outputPath)
	if err != nil {
		return err
	}
	defer zipFile.Close()

	zipWriter := zip.NewWriter(zipFile)
	defer zipWriter.Close()

	err = filepath.Walk(s.dataDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		if info.IsDir() {
			return nil
		}

		relPath, err := filepath.Rel(s.dataDir, path)
		if err != nil {
			return err
		}

		header, err := zip.FileInfoHeader(info)
		if err != nil {
			return err
		}
		header.Name = relPath
		header.Method = zip.Deflate

		writer, err := zipWriter.CreateHeader(header)
		if err != nil {
			return err
		}

		file, err := os.Open(path)
		if err != nil {
			return err
		}

		_, copyErr := io.Copy(writer, file)
		closeErr := file.Close()
		if copyErr != nil {
			return copyErr
		}
		return closeErr
	})

	return err
}

func (s *Service) RestoreBackup(inputPath string) error {
	reader, err := zip.OpenReader(inputPath)
	if err != nil {
		return err
	}
	defer reader.Close()

	for _, file := range reader.File {
		destPath := filepath.Join(s.dataDir, file.Name)
		cleanDestPath := filepath.Clean(destPath)

		if !strings.HasPrefix(cleanDestPath, filepath.Clean(s.dataDir)+string(os.PathSeparator)) {
			continue
		}

		if file.FileInfo().IsDir() {
			os.MkdirAll(cleanDestPath, 0700)
			continue
		}

		if err := os.MkdirAll(filepath.Dir(cleanDestPath), 0700); err != nil {
			return err
		}

		destFile, err := os.OpenFile(cleanDestPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0600)
		if err != nil {
			return err
		}

		srcFile, err := file.Open()
		if err != nil {
			destFile.Close()
			return err
		}

		_, err = io.Copy(destFile, srcFile)
		srcFile.Close()
		destFile.Close()

		if err != nil {
			return err
		}
	}

	return nil
}
