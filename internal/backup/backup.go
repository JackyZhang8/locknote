// https://github.com/JackyZhang8/locknote
// 一个简单、可靠、离线优先的桌面加密笔记软件。
// A simple, reliable, offline-first encrypted note-taking desktop app.
package backup

import (
	"archive/zip"
	"errors"
	"fmt"
	"io"
	"locknote/internal/crypto"
	"locknote/internal/fsutil"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"
)

var (
	maxZipFileSize  int64 = 500 * 1024 * 1024
	maxZipTotalSize int64 = 4 * 1024 * 1024 * 1024
	maxZipEntries         = 100000

	// restoreSnapshotKeep 是保留的恢复快照数量。快照是整库副本，只用于
	// 恢复失败时回滚，保留最近几次即可，避免长期占用磁盘。
	restoreSnapshotKeep = 3

	sensitiveFiles = map[string]bool{
		"locknote.db":         true,
		"locknote.db-journal": true,
		"locknote.db-wal":     true,
		"locknote.db-shm":     true,
		"notebase.db":         true,
		"notebase.db-journal": true,
		"notebase.db-wal":     true,
		"notebase.db-shm":     true,
		"data_key_verifier":   true,
	}
)

type Service struct {
	dataDir string
}

func NewService(dataDir string) *Service {
	return &Service{dataDir: dataDir}
}

func skippedBackupPath(name string) bool {
	name = filepath.ToSlash(filepath.Clean(name))
	if sensitiveFiles[filepath.Base(name)] {
		return true
	}
	return name == "restore-snapshots" || strings.HasPrefix(name, "restore-snapshots/")
}

func safeZipDestination(root, name string) (string, string, bool) {
	if filepath.IsAbs(name) {
		return "", "", false
	}
	cleanName := filepath.Clean(filepath.FromSlash(name))
	if cleanName == "." || cleanName == ".." || strings.HasPrefix(cleanName, ".."+string(os.PathSeparator)) {
		return "", "", false
	}
	if skippedBackupPath(cleanName) {
		return "", "", false
	}
	destination := filepath.Join(root, cleanName)
	relative, err := filepath.Rel(root, destination)
	if err != nil || relative == ".." || strings.HasPrefix(relative, ".."+string(os.PathSeparator)) {
		return "", "", false
	}
	return destination, relative, true
}

func (s *Service) ExtractBackupToTemp(inputPath string) (string, error) {
	tempDir, err := os.MkdirTemp("", "locknote-import-*")
	if err != nil {
		return "", err
	}
	if err := extractZip(inputPath, tempDir); err != nil {
		_ = os.RemoveAll(tempDir)
		return "", err
	}
	return tempDir, nil
}

func extractZip(inputPath, destinationDir string) error {
	reader, err := zip.OpenReader(inputPath)
	if err != nil {
		return err
	}
	defer reader.Close()

	if len(reader.File) > maxZipEntries {
		return fmt.Errorf("zip contains too many entries (%d)", len(reader.File))
	}

	var totalSize int64
	for _, file := range reader.File {
		destination, _, safe := safeZipDestination(destinationDir, file.Name)
		if !safe {
			continue
		}
		if file.FileInfo().IsDir() {
			if err := os.MkdirAll(destination, 0700); err != nil {
				return err
			}
			continue
		}
		if maxZipFileSize < 0 || file.UncompressedSize64 > uint64(maxZipFileSize) {
			return fmt.Errorf("file %s exceeds size limit (%d bytes)", file.Name, maxZipFileSize)
		}
		if err := os.MkdirAll(filepath.Dir(destination), 0700); err != nil {
			return err
		}

		source, err := file.Open()
		if err != nil {
			return err
		}
		output, err := os.OpenFile(destination, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0600)
		if err != nil {
			_ = source.Close()
			return err
		}
		remaining := maxZipTotalSize - totalSize
		limit := maxZipFileSize + 1
		if remaining < limit {
			limit = remaining + 1
		}
		if limit < 0 {
			limit = 0
		}
		copied, copyErr := io.Copy(output, io.LimitReader(source, limit))
		sourceCloseErr := source.Close()
		outputCloseErr := output.Close()
		if copyErr != nil {
			return copyErr
		}
		if sourceCloseErr != nil {
			return sourceCloseErr
		}
		if outputCloseErr != nil {
			return outputCloseErr
		}
		if copied > maxZipFileSize {
			return fmt.Errorf("file %s exceeds size limit (%d bytes)", file.Name, maxZipFileSize)
		}
		totalSize += copied
		if totalSize > maxZipTotalSize {
			return fmt.Errorf("zip exceeds total size limit (%d bytes)", maxZipTotalSize)
		}
	}
	return nil
}

func (s *Service) CleanupTempDir(tempDir string) {
	_ = os.RemoveAll(tempDir)
}

func (s *Service) restoreSnapshotRoot() string {
	return filepath.Join(s.dataDir, "restore-snapshots")
}

// pruneRestoreSnapshots 只保留最近 keep 个恢复快照目录。
// 快照目录名是 UnixNano 时间戳，按数值倒序排列后删除多余的。
func (s *Service) pruneRestoreSnapshots(keep int) {
	if keep < 0 {
		keep = 0
	}
	entries, err := os.ReadDir(s.restoreSnapshotRoot())
	if err != nil {
		return
	}

	type snapshot struct {
		name    string
		created int64
	}
	snapshots := make([]snapshot, 0, len(entries))
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		created, err := strconv.ParseInt(entry.Name(), 10, 64)
		if err != nil {
			continue
		}
		snapshots = append(snapshots, snapshot{name: entry.Name(), created: created})
	}
	if len(snapshots) <= keep {
		return
	}

	sort.Slice(snapshots, func(i, j int) bool { return snapshots[i].created > snapshots[j].created })
	for _, stale := range snapshots[keep:] {
		_ = os.RemoveAll(filepath.Join(s.restoreSnapshotRoot(), stale.name))
	}
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

		relPath, err := filepath.Rel(s.dataDir, path)
		if err != nil {
			return err
		}
		if info.IsDir() {
			if relPath == "restore-snapshots" {
				return filepath.SkipDir
			}
			return nil
		}
		if skippedBackupPath(relPath) {
			return nil
		}

		header, err := zip.FileInfoHeader(info)
		if err != nil {
			return err
		}
		header.Name = filepath.ToSlash(relPath)
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

func (s *Service) RestoreBackup(inputPath string, cryptoService *crypto.Service, key []byte) error {
	if key == nil {
		return errors.New("请先解锁")
	}
	tempDir, err := s.ExtractBackupToTemp(inputPath)
	if err != nil {
		return err
	}
	defer s.CleanupTempDir(tempDir)

	notesDir := filepath.Join(tempDir, "notes")
	if _, err := os.Stat(notesDir); err != nil {
		if os.IsNotExist(err) {
			return errors.New("备份中没有笔记")
		}
		return err
	}
	noteFiles := 0
	err = filepath.Walk(notesDir, func(path string, info os.FileInfo, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if info.IsDir() || filepath.Ext(info.Name()) != ".enc" {
			return nil
		}
		noteFiles++
		ciphertext, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		if _, err := cryptoService.Decrypt(key, ciphertext); err != nil {
			return errors.New("该备份不属于当前密码库，请使用「用恢复密钥导入」")
		}
		return nil
	})
	if err != nil {
		return err
	}
	if noteFiles == 0 {
		return errors.New("备份中没有笔记")
	}

	// 清理上次异常退出可能残留的快照，并给本次快照腾出位置。
	s.pruneRestoreSnapshots(restoreSnapshotKeep - 1)

	snapshotDir := filepath.Join(s.restoreSnapshotRoot(), strconv.FormatInt(time.Now().UnixNano(), 10))
	if err := os.MkdirAll(snapshotDir, 0700); err != nil {
		return err
	}

	var applied []string
	snapshots := make(map[string]string)
	newFiles := make(map[string]bool)
	rollback := func(cause error) error {
		var rollbackErr error
		for i := len(applied) - 1; i >= 0; i-- {
			destination := applied[i]
			if snapshotPath, ok := snapshots[destination]; ok {
				data, err := os.ReadFile(snapshotPath)
				if err == nil {
					err = fsutil.WriteFileAtomic(destination, data, 0600)
				}
				if err != nil {
					rollbackErr = errors.Join(rollbackErr, err)
				}
			} else if newFiles[destination] {
				if err := os.Remove(destination); err != nil && !os.IsNotExist(err) {
					rollbackErr = errors.Join(rollbackErr, err)
				}
			}
		}
		_ = os.RemoveAll(snapshotDir)
		return errors.Join(cause, rollbackErr)
	}

	err = filepath.Walk(tempDir, func(path string, info os.FileInfo, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if info.IsDir() {
			return nil
		}
		relPath, err := filepath.Rel(tempDir, path)
		if err != nil {
			return err
		}
		if skippedBackupPath(relPath) {
			return nil
		}
		destination := filepath.Join(s.dataDir, relPath)
		if err := os.MkdirAll(filepath.Dir(destination), 0700); err != nil {
			return err
		}
		snapshotPath := filepath.Join(snapshotDir, relPath)
		if _, err := os.Stat(destination); err == nil {
			if err := os.MkdirAll(filepath.Dir(snapshotPath), 0700); err != nil {
				return err
			}
			source, err := os.Open(destination)
			if err != nil {
				return err
			}
			snapshot, err := os.OpenFile(snapshotPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0600)
			if err != nil {
				_ = source.Close()
				return err
			}
			_, copyErr := io.Copy(snapshot, source)
			sourceCloseErr := source.Close()
			snapshotCloseErr := snapshot.Close()
			if copyErr != nil {
				return copyErr
			}
			if sourceCloseErr != nil {
				return sourceCloseErr
			}
			if snapshotCloseErr != nil {
				return snapshotCloseErr
			}
			snapshots[destination] = snapshotPath
		} else if os.IsNotExist(err) {
			newFiles[destination] = true
		} else {
			return err
		}
		data, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		if err := fsutil.WriteFileAtomic(destination, data, 0600); err != nil {
			return err
		}
		applied = append(applied, destination)
		return nil
	})
	if err != nil {
		return rollback(err)
	}
	s.pruneRestoreSnapshots(restoreSnapshotKeep)
	return nil
}
