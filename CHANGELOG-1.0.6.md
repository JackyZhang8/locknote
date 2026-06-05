# LockNote v1.0.6 Release Notes

Release Date: June 5, 2026

## New Features

### Calendar Workspace
- Added a Calendar entry in the main sidebar.
- Added month calendar browsing for note activity and todo schedules.
- Added day details for note creation/edit activity, due todos, and todos completed on the selected day.
- Added calendar actions to create notes and todos directly from the selected date.

### Activity HeatMap
- Added a GitHub-style HeatMap based on daily note activity and completed todos.
- HeatMap is collapsed by default and can be expanded on demand.
- HeatMap dynamically adapts to the available width and keeps the newest days right aligned.
- Added quick hover tooltips for daily activity details.

### First-Run Startup Experience
- Added a startup progress screen for cold starts.
- First-run users now see a feature introduction before password setup.
- Added a five-page onboarding carousel covering encrypted storage, notes, todos, calendar, and images/backups.
- The first-run progress screen remains visible briefly even when initialization is fast, so users can see startup progress.

## Improvements

### Windows Startup
- Moved core initialization to a background process to reduce UI blocking during the first Windows launch.
- The frontend now waits for Wails runtime and core readiness before entering the setup or unlock flow.
- Startup errors are exposed to the frontend for clearer progress feedback.

### Calendar Details
- Note activity appears on both created and edited dates.
- Detail lists now show created/edited time metadata.
- Due todo rows show priority, subtask progress, and created time.

### Image Manager
- Continued image manager refinements for compact browsing, favorite controls, modal preview, and safer deletion confirmation.

## Compatibility

- This version keeps the existing local data format compatible with previous 1.0.x releases.
- Existing notes, todos, images, settings, and backups are preserved.

## Download

Visit [https://locknote.app](https://locknote.app) or GitHub Releases for download links.

---

**Full Changelog**: https://github.com/JackyZhang8/locknote/compare/v1.0.5...v1.0.6
