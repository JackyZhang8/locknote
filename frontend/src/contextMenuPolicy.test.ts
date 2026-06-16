import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync('src/App.tsx', 'utf8');
const editorSource = readFileSync('src/components/NoteEditor.tsx', 'utf8');
const mainSource = readFileSync('../main.go', 'utf8');
const zhCNSource = readFileSync('src/i18n/locales/zh-CN.ts', 'utf8');
const zhTWSource = readFileSync('src/i18n/locales/zh-TW.ts', 'utf8');
const enUSSource = readFileSync('src/i18n/locales/en-US.ts', 'utf8');

test('wails and app root suppress the default browser context menu globally', () => {
  assert.equal(/EnableDefaultContextMenu:\s*false/.test(mainSource), true);
  assert.equal(/const suppressDefaultContextMenu = \(event: MouseEvent\) => \{/.test(appSource), true);
  assert.equal(/event\.preventDefault\(\);/.test(appSource), true);
  assert.equal(/window\.addEventListener\('contextmenu', suppressDefaultContextMenu, \{ capture: true \}\)/.test(appSource), true);
  assert.equal(/window\.removeEventListener\('contextmenu', suppressDefaultContextMenu, \{ capture: true \}\)/.test(appSource), true);
});

test('note editor owns the only custom right-click menu surface', () => {
  assert.equal(/type EditorContextMenu = \{/.test(editorSource), true);
  assert.equal(/const \[contextMenu, setContextMenu\] = useState<EditorContextMenu \| null>\(null\)/.test(editorSource), true);
  assert.equal(/const handleEditorContextMenu = \(event: ReactMouseEvent<HTMLElement>\) => \{/.test(editorSource), true);
  assert.equal(/data-note-editor-surface="true"/.test(editorSource), true);
  assert.equal(/onContextMenu=\{handleEditorContextMenu\}/.test(editorSource), true);
  assert.equal(/role="menu"/.test(editorSource), true);
  assert.equal(/left: contextMenu\.x/.test(editorSource), true);
  assert.equal(/top: contextMenu\.y/.test(editorSource), true);
});

test('note editor context menu exposes editing and preview actions', () => {
  assert.equal(/handleCopyFromContextMenu/.test(editorSource), true);
  assert.equal(/handleCutFromContextMenu/.test(editorSource), true);
  assert.equal(/handlePasteFromContextMenu/.test(editorSource), true);
  assert.equal(/handleSelectAllFromContextMenu/.test(editorSource), true);
  assert.equal(/handleCopyMarkdownFromContextMenu/.test(editorSource), true);
  assert.equal(/handleExportFromContextMenu/.test(editorSource), true);
  assert.equal(/t\.editor\.contextCopy/.test(editorSource), true);
  assert.equal(/t\.editor\.contextCut/.test(editorSource), true);
  assert.equal(/t\.editor\.contextPaste/.test(editorSource), true);
  assert.equal(/t\.editor\.contextCopyMarkdown/.test(editorSource), true);
  assert.equal(/t\.editor\.contextShowHistory/.test(editorSource), true);
  assert.equal(/t\.editor\.contextExportMd/.test(editorSource), true);
});

test('note editor context menu labels are localized', () => {
  assert.equal(/contextCopy:\s*'复制'/.test(zhCNSource), true);
  assert.equal(/contextCut:\s*'剪切'/.test(zhCNSource), true);
  assert.equal(/contextPaste:\s*'粘贴'/.test(zhCNSource), true);
  assert.equal(/contextCopyMarkdown:\s*'复制 Markdown'/.test(zhCNSource), true);
  assert.equal(/contextShowHistory:\s*'历史版本'/.test(zhCNSource), true);
  assert.equal(/contextExportMd:\s*'导出md文件'/.test(zhCNSource), true);

  assert.equal(/contextCopy:\s*'複製'/.test(zhTWSource), true);
  assert.equal(/contextCut:\s*'剪下'/.test(zhTWSource), true);
  assert.equal(/contextPaste:\s*'貼上'/.test(zhTWSource), true);
  assert.equal(/contextCopyMarkdown:\s*'複製 Markdown'/.test(zhTWSource), true);
  assert.equal(/contextShowHistory:\s*'歷史版本'/.test(zhTWSource), true);
  assert.equal(/contextExportMd:\s*'匯出md檔案'/.test(zhTWSource), true);

  assert.equal(/contextCopy:\s*'Copy'/.test(enUSSource), true);
  assert.equal(/contextCut:\s*'Cut'/.test(enUSSource), true);
  assert.equal(/contextPaste:\s*'Paste'/.test(enUSSource), true);
  assert.equal(/contextCopyMarkdown:\s*'Copy Markdown'/.test(enUSSource), true);
  assert.equal(/contextShowHistory:\s*'Version history'/.test(enUSSource), true);
  assert.equal(/contextExportMd:\s*'Export MD file'/.test(enUSSource), true);
});

test('note editor supports Ctrl or Cmd Z undo for title and content edits', () => {
  assert.equal(/type EditorSnapshot = \{/.test(editorSource), true);
  assert.equal(/const undoStackRef = useRef<EditorSnapshot\[\]>\(\[\]\)/.test(editorSource), true);
  assert.equal(/const pushUndoSnapshot = \(\) => \{/.test(editorSource), true);
  assert.equal(/const undoLastEdit = \(target: EditableContextTarget \| null\) => \{/.test(editorSource), true);
  assert.equal(/const handleEditorUndoShortcut = \(event: ReactKeyboardEvent<EditableContextTarget>\) => \{/.test(editorSource), true);
  assert.equal(/\(event\.metaKey \|\| event\.ctrlKey\) && !event\.shiftKey && event\.key\.toLowerCase\(\) === 'z'/.test(editorSource), true);
  assert.equal(/const didUndo = undoLastEdit\(event\.currentTarget\);/.test(editorSource), true);
  assert.equal(/if \(!didUndo\) return false;[\s\S]*event\.preventDefault\(\);[\s\S]*return true;/.test(editorSource), true);
  assert.equal(/const handleTitleKeyDown = \(event: ReactKeyboardEvent<HTMLInputElement>\) => \{/.test(editorSource), true);
  assert.equal(/if \(handleEditorUndoShortcut\(event\)\) return;/.test(editorSource), true);
  assert.equal(/onKeyDown=\{handleTitleKeyDown\}/.test(editorSource), true);
  assert.equal(/onChange=\{\(e\) => handleContentChange\(e\.target\.value\)\}/.test(editorSource), true);
});
