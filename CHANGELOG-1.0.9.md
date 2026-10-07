# LockNote v1.0.9 Release Notes

Release Date: October 7, 2026

## New Features

### Mermaid Flowcharts
- Markdown preview now supports `mermaid` and `flowchart` fenced code blocks.
- Added diagram/source switching, zoom, reset, and SVG save-as actions.
- Mermaid diagrams can be previewed directly in split editor mode.

### Markdown Table of Contents
- Automatically builds a table of contents from h1-h6 Markdown headings.
- Added collapse, expand, and precise heading navigation controls.
- Generates stable, unique anchors for duplicate, Chinese, and empty headings.

## Improvements

### Markdown Editor
- Fixed split mode sizing and independent scrolling for the editor and preview panes.
- Serialized auto-save requests so a stale request cannot overwrite newer edits.
- The editor now waits for the current draft to finish saving before closing.
- Localized Markdown toolbar labels for Simplified Chinese, Traditional Chinese, and English.
- Added accessible labels to toolbar buttons for keyboard and assistive technology users.

### Project Structure
- Moved Markdown title extraction into `internal/markdown`.
- Organized source contract tests under `tests/source`.
- Removed redundant root-level file I/O wrappers in favor of the standard library.

### Documentation
- Made the Chinese README the default README.
- Added a separate English README with cross-language navigation links.
- Added documentation for Mermaid diagrams, the preview table of contents, and the project structure.

## Compatibility

- This version keeps the existing local data format compatible with previous 1.0.x releases.
- Existing notes, todos, images, settings, and backups are preserved.

## Download

Visit [https://locknote.app](https://locknote.app) or GitHub Releases for download links.

---

**Full Changelog**: https://github.com/JackyZhang8/locknote/compare/v1.0.8...v1.0.9
