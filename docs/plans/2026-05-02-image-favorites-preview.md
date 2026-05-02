# Image Favorites Preview Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Persist image favorites in the attachments table and add favorites filtering plus image preview in the image manager.

**Architecture:** Add `favorite` to attachment database metadata and expose it through the Wails API. Keep frontend behavior local to `ImageManager`, using the returned attachment state for filtering and modal preview.

**Tech Stack:** Go, SQLite via `modernc.org/sqlite`, Wails bindings, React, TypeScript, Node test runner.

---

### Task 1: Backend Favorite Persistence

**Files:**
- Modify: `internal/database/attachments.go`
- Modify: `internal/attachments/attachments.go`
- Modify: `api.go`
- Modify: `frontend/wailsjs/go/models.ts`
- Modify: `frontend/wailsjs/go/main/App.d.ts`
- Modify: `frontend/wailsjs/go/main/App.js`
- Test: `internal/database/attachments_test.go`
- Test: `internal/attachments/attachments_test.go`

**Steps:**
1. Write failing tests for adding the favorite column and toggling an attachment favorite.
2. Run focused Go tests and confirm they fail because the field/API does not exist.
3. Add the database column, scan/write favorite values, and expose `SetAttachmentFavorite`.
4. Update generated frontend bindings manually to match the new Wails API surface.
5. Run focused Go tests until they pass.

### Task 2: Frontend Filter And Preview

**Files:**
- Modify: `frontend/src/imageGrid.ts`
- Modify: `frontend/src/imageGrid.test.ts`
- Modify: `frontend/src/components/ImageManager.tsx`
- Modify: `frontend/src/imageManagerDeletion.test.ts`
- Modify: `frontend/src/i18n/locales/zh-CN.ts`
- Modify: `frontend/src/i18n/locales/en-US.ts`

**Steps:**
1. Write a failing test for filtering favorite images.
2. Add the minimal helper implementation and use it in `ImageManager`.
3. Add heart controls, backend toggle handling, header filter, and preview modal.
4. Extend source-level tests for the key UI structures.
5. Run TypeScript test compilation and node tests.

### Task 3: Verification

**Files:**
- Verify all changed files.

**Steps:**
1. Run focused Go tests.
2. Run frontend test compilation and affected node tests.
3. Run the frontend production build.
