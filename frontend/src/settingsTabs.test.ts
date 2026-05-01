import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const sidebarSource = readFileSync('src/components/Sidebar.tsx', 'utf8');
const mainLayoutSource = readFileSync('src/components/MainLayout.tsx', 'utf8');
const settingsSource = readFileSync('src/components/SettingsView.tsx', 'utf8');
const backupSource = readFileSync('src/components/BackupView.tsx', 'utf8');
const trashSource = readFileSync('src/components/TrashView.tsx', 'utf8');
const zhSource = readFileSync('src/i18n/locales/zh-CN.ts', 'utf8');
const enSource = readFileSync('src/i18n/locales/en-US.ts', 'utf8');

test('sidebar no longer exposes backup or trash as primary navigation items', () => {
  assert.equal(/id:\s*'backup'/.test(sidebarSource), false);
  assert.equal(/id:\s*'trash'/.test(sidebarSource), false);
  assert.equal(/HardDrive/.test(sidebarSource), false);
  assert.equal(/Trash2/.test(sidebarSource), false);
});

test('main layout no longer renders backup or trash as standalone views', () => {
  assert.equal(/case 'backup'/.test(mainLayoutSource), false);
  assert.equal(/case 'trash'/.test(mainLayoutSource), false);
  assert.equal(/import \{ BackupView \}/.test(mainLayoutSource), false);
  assert.equal(/import \{ TrashView \}/.test(mainLayoutSource), false);
});

test('settings view owns settings, backup, and trash tabs', () => {
  assert.equal(/type SettingsTab = 'settings' \| 'backup' \| 'trash'/.test(settingsSource), true);
  assert.equal(/const settingsTabs: SettingsTabItem\[\]/.test(settingsSource), true);
  assert.equal(/<BackupView embedded \/>/.test(settingsSource), true);
  assert.equal(/<TrashView embedded \/>/.test(settingsSource), true);
  assert.equal(/tabSettings:\s*'设置'/.test(zhSource), true);
  assert.equal(/tabBackup:\s*'备份'/.test(zhSource), true);
  assert.equal(/tabTrash:\s*'回收站'/.test(zhSource), true);
  assert.equal(/tabSettings:\s*'Settings'/.test(enSource), true);
  assert.equal(/tabBackup:\s*'Backup'/.test(enSource), true);
  assert.equal(/tabTrash:\s*'Trash'/.test(enSource), true);
});

test('settings tabs are right aligned and visually elevated', () => {
  assert.equal(/sm:justify-between/.test(settingsSource), true);
  assert.equal(/sm:ml-auto/.test(settingsSource), true);
  assert.equal(/rounded-xl border border-gray-200 bg-gray-50 p-1 shadow-sm/.test(settingsSource), true);
  assert.equal(/min-w-\[92px\]/.test(settingsSource), true);
  assert.equal(/px-4 py-2\.5/.test(settingsSource), true);
  assert.equal(/shadow-sm ring-1 ring-primary-100/.test(settingsSource), true);
});

test('settings select controls use refined custom dropdown styling', () => {
  assert.equal(/ChevronDown/.test(settingsSource), true);
  assert.equal(/selectControlClassName/.test(settingsSource), true);
  assert.equal(/appearance-none/.test(settingsSource), true);
  assert.equal(/focus:ring-4 focus:ring-primary-100/.test(settingsSource), true);
  assert.equal(/pointer-events-none absolute right-3 top-1\/2/.test(settingsSource), true);
});

test('theme selector shows only right-aligned color swatches with centered checkmark', () => {
  assert.equal(/sm:flex-row sm:items-center sm:justify-between/.test(settingsSource), true);
  assert.equal(/themeSwatchLabel/.test(settingsSource), true);
  assert.equal(/aria-label=\{themeSwatchLabel\}/.test(settingsSource), true);
  assert.equal(/title=\{themeSwatchLabel\}/.test(settingsSource), true);
  assert.equal(/h-11 w-11/.test(settingsSource), true);
  assert.equal(/absolute inset-0 flex items-center justify-center/.test(settingsSource), true);
  assert.equal(/\{themeLabels\[option\.nameKey\]\}<\/div>/.test(settingsSource), false);
});

test('language selector is right aligned inside its settings row', () => {
  assert.equal(/sm:flex-row sm:items-center sm:justify-between[\s\S]*<Globe className="w-5 h-5 text-accent" \/>[\s\S]*relative w-full sm:w-\[220px\]/.test(settingsSource), true);
  assert.equal(/relative w-full sm:w-\[220px\]/.test(settingsSource), true);
});

test('password form and auto lock keep the original vertical settings layout', () => {
  assert.equal(/textInputControlClassName/.test(settingsSource), true);
  assert.equal(/sm:flex-row sm:items-center sm:justify-between[\s\S]*<Key className="w-5 h-5 text-accent" \/>/.test(settingsSource), true);
  assert.equal(/showChangePassword && \([\s\S]*<div className="mt-5 space-y-4">/.test(settingsSource), true);
  assert.equal(/grid gap-4 md:grid-cols-2/.test(settingsSource), false);
  assert.equal(/<Clock className="w-5 h-5 text-accent" \/>[\s\S]*<div className="space-y-4">[\s\S]*max-w-sm/.test(settingsSource), true);
  assert.equal(/grid gap-3 md:grid-cols-2/.test(settingsSource), false);
  assert.equal(/justify-end border-t border-gray-100 pt-4/.test(settingsSource), false);
});

test('backup and trash views support embedded tab rendering', () => {
  assert.equal(/interface BackupViewProps/.test(backupSource), true);
  assert.equal(/embedded = false/.test(backupSource), true);
  assert.equal(/interface TrashViewProps/.test(trashSource), true);
  assert.equal(/embedded = false/.test(trashSource), true);
});
