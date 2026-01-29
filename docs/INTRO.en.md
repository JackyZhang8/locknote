# LockNote (Desktop)

LockNote is a **simple, reliable, offline-first** encrypted note app for desktop.

Your notes are encrypted locally using modern cryptography:
- Content is encrypted with **AES-256-GCM**
- Keys are derived from your password using **Argon2id**

**No accounts. No cloud. No network required.** Your data stays on your device.

## Who it's for

- Anyone who wants notes encrypted by default and fully owned by the user
- People who often work offline (travel, intranet, no-network environments)
- Users who prefer long-term local access with backups and portability

## Key features

- **Encrypted storage**
  - Note titles and content are encrypted at rest
  - SQLite stores metadata only (no plaintext content)
- **Offline-first**
  - Fully usable without an internet connection
- **Unlock on launch**
  - Notes are inaccessible before unlocking
  - Manual lock is supported
- **Markdown editing**
  - Markdown authoring with preview
- **Tags & organization**
  - Tag notes for filtering and organization
- **Full-text search**
  - Search titles, content, and tags
- **Version history**
  - Automatically saved versions with rollback
- **Backup & restore**
  - Manual backups under your control

## Security notes (summary)

- The master key only lives in memory after unlocking
- Each note uses an independent random `nonce`
- Ciphertext files are written atomically to reduce corruption risk

> If you lose both your login password and the recovery key, your data cannot be recovered.

## Tech stack

- Backend: Go + Wails v2
- Frontend: React + TypeScript + TailwindCSS
- Storage: SQLite (metadata) + local encrypted files (content)
- Crypto: AES-256-GCM + Argon2id

## Quick start (for developers)

### Requirements

- Go 1.21+
- Node.js 18+
- Wails CLI v2

### Install Wails CLI

```bash
go install github.com/wailsapp/wails/v2/cmd/wails@latest
```

### Development

```bash
cd frontend && npm install && cd ..
wails dev
```

### Build

```bash
wails build
```

For multi-platform builds and additional flags, see `build.md` and `build.sh` in the project root.

## Version

v1.0.1
