import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const editorSource = readFileSync('src/components/NoteEditor.tsx', 'utf8');
const mainLayoutSource = readFileSync('src/components/MainLayout.tsx', 'utf8');
const zhCNSource = readFileSync('src/i18n/locales/zh-CN.ts', 'utf8');
const zhTWSource = readFileSync('src/i18n/locales/zh-TW.ts', 'utf8');
const enUSSource = readFileSync('src/i18n/locales/en-US.ts', 'utf8');

test('note editor shows a localized body character count before zoom controls', () => {
  assert.equal(/const bodyCharacterCount = content\.trim\(\)\.length/.test(editorSource), true);
  assert.equal(/formatMessage\(t\.editor\.wordCount, \{ count: bodyCharacterCount \}\)/.test(editorSource), true);

  const toolbarStart = editorSource.indexOf('{isSaving &&');
  const zoomOutStart = editorSource.indexOf('onClick={handleZoomOut}', toolbarStart);
  const beforeZoomOutSource = editorSource.slice(toolbarStart, zoomOutStart);
  assert.equal(beforeZoomOutSource.includes('t.editor.wordCount'), true);
  assert.equal(beforeZoomOutSource.includes('handleZoomOut'), false);
});

test('word count labels are localized for Chinese and English', () => {
  assert.equal(/wordCount:\s*'\{count\} 字'/.test(zhCNSource), true);
  assert.equal(/wordCount:\s*'\{count\} 字'/.test(zhTWSource), true);
  assert.equal(/wordCount:\s*'Words \{count\}'/.test(enUSSource), true);
});

test('note editor can render optional line numbers beside the markdown textarea', () => {
  assert.equal(/const LINE_NUMBERS_STORAGE_KEY = 'locknote-editor-show-line-numbers';/.test(editorSource), true);
  assert.equal(/const \[showLineNumbers, setShowLineNumbers\] = useState\(true\)/.test(editorSource), true);
  assert.equal(/const editorLineNumbers = content\.split\('\\n'\)/.test(editorSource), true);
  assert.equal(/setShowLineNumbers\(saved !== 'false'\)/.test(editorSource), true);
  assert.equal(/window\.addEventListener\(LINE_NUMBERS_CHANGE_EVENT, readLineNumberPreference\)/.test(editorSource), true);
  assert.equal(/aria-hidden="true"[\s\S]*\{editorLineNumbers\.map/.test(editorSource), true);
});

test('split editor uses an explicit two column workspace that can shrink', () => {
  assert.equal(/variant === 'modal' \? 'flex h-full min-h-0 min-w-0' : 'flex-1 flex min-h-0 min-w-0 overflow-hidden'/.test(editorSource), true);
  assert.equal(/<main className="min-w-0 flex-1 flex overflow-hidden">/.test(mainLayoutSource), true);
  assert.equal(/<div className="flex min-w-0 flex-1 overflow-hidden">/.test(mainLayoutSource), true);
  assert.equal(/style=\{\{\s*gridTemplateColumns: editorMode === 'split' \? 'minmax\(0, 1fr\) minmax\(0, 1fr\)' : undefined,\s*\}\}/.test(editorSource), true);
  assert.equal(/data-editor-pane="markdown"/.test(editorSource), true);
  assert.equal(/data-editor-pane="preview"/.test(editorSource), true);
  assert.equal(/editorMode === 'split' \? 'min-w-0 border-r border-gray-100' : 'min-w-0 flex-1'/.test(editorSource), true);
  assert.equal(/className=\{`min-w-0 flex-1 resize-none/.test(editorSource), true);
});

test('markdown toolbar ends with a line number toggle action', () => {
  assert.equal(/import \{[\s\S]*Pilcrow[\s\S]*\} from 'lucide-react';/.test(editorSource), true);
  assert.equal(/const persistShowLineNumbers = \(value: boolean\) => \{/.test(editorSource), true);
  assert.equal(/setShowLineNumbers\(value\)/.test(editorSource), true);
  assert.equal(/localStorage\.setItem\(LINE_NUMBERS_STORAGE_KEY, value \? 'true' : 'false'\)/.test(editorSource), true);

  const toolbarStart = editorSource.indexOf('{markdownActions.map((action, index) => (');
  const toolbarEnd = editorSource.indexOf('</div>', toolbarStart);
  const toolbarSource = editorSource.slice(toolbarStart, toolbarEnd);
  assert.equal(toolbarSource.includes('onClick={() => persistShowLineNumbers(!showLineNumbers)}'), true);
  assert.equal(toolbarSource.includes('title={t.settings.showLineNumbers}'), true);
  assert.equal(toolbarSource.lastIndexOf('Pilcrow') > toolbarSource.lastIndexOf('{markdownActions.map'), true);
});

test('line number setting is localized in all supported languages', () => {
  assert.equal(/showLineNumbers:\s*'显示行号'/.test(zhCNSource), true);
  assert.equal(/showLineNumbers:\s*'顯示行號'/.test(zhTWSource), true);
  assert.equal(/showLineNumbers:\s*'Show line numbers'/.test(enUSSource), true);
});
