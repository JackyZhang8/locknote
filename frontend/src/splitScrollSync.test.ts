import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const editorSource = readFileSync('src/components/NoteEditor.tsx', 'utf8');

test('split editor syncs scrolling from the markdown pane to the preview pane', () => {
  assert.equal(/const previewScrollRef = useRef<HTMLDivElement \| null>\(null\)/.test(editorSource), true);
  assert.equal(/onScroll=\{handleContentScroll\}/.test(editorSource), true);
  assert.equal(/onScroll=\{handlePreviewScroll\}/.test(editorSource), true);
  assert.equal(/ref=\{previewScrollRef\}/.test(editorSource), true);
});

test('scroll sync only runs in split mode and guards against scroll echo', () => {
  assert.equal(/import \{ computeSyncedScrollTop, shouldIgnoreScrollEcho, type ScrollSyncSource \} from '\.\.\/scrollSync'/.test(editorSource), true);
  assert.equal(/if \(editorMode === 'split'\) \{\s*syncScrollFrom\('editor'\);/.test(editorSource), true);
  assert.equal(/if \(editorMode === 'split'\) \{\s*syncScrollFrom\('preview'\);/.test(editorSource), true);
  assert.equal(/shouldIgnoreScrollEcho\(scrollSyncRef\.current, source, now\)/.test(editorSource), true);
  assert.equal(/scrollSyncRef\.current = \{ source, at: now \};/.test(editorSource), true);
});

test('split editor keeps the line number gutter in sync with the textarea', () => {
  assert.equal(/lineNumbers\.scrollTop = textarea\.scrollTop;/.test(editorSource), true);
});
