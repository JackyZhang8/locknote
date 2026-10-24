package fsutil

import (
	"os"
	"path/filepath"
	"runtime"
)

func WriteFileAtomic(path string, data []byte, perm os.FileMode) error {
	tempPath, err := WriteTemp(path, data, perm)
	if err != nil {
		return err
	}
	defer os.Remove(tempPath)
	return Commit(tempPath, path)
}

func WriteTemp(path string, data []byte, perm os.FileMode) (string, error) {
	dir := filepath.Dir(path)
	temp, err := os.CreateTemp(dir, filepath.Base(path)+".tmp-*")
	if err != nil {
		return "", err
	}
	tempPath := temp.Name()
	failed := true
	defer func() {
		if failed {
			_ = os.Remove(tempPath)
		}
	}()

	if _, err := temp.Write(data); err != nil {
		_ = temp.Close()
		return "", err
	}
	if err := temp.Sync(); err != nil {
		_ = temp.Close()
		return "", err
	}
	if err := temp.Close(); err != nil {
		return "", err
	}
	if err := os.Chmod(tempPath, perm); err != nil {
		return "", err
	}
	failed = false
	return tempPath, nil
}

func Commit(tempPath, path string) error {
	dir := filepath.Dir(path)
	if err := os.Rename(tempPath, path); err != nil {
		return err
	}

	if runtime.GOOS != "windows" {
		if directory, err := os.Open(dir); err == nil {
			_ = directory.Sync()
			_ = directory.Close()
		}
	}
	return nil
}
