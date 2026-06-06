import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const editorSource = readFileSync('src/components/NoteEditor.tsx', 'utf8');
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
