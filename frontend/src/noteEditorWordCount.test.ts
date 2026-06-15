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

test('note editor limits long titles and scales the title font by length', () => {
  assert.equal(/const MAX_TITLE_LENGTH = 80;/.test(editorSource), true);
  assert.equal(/const getLimitedTitle = \(value: string\) => value\.slice\(0, MAX_TITLE_LENGTH\);/.test(editorSource), true);
  assert.equal(/const getTitleFontSize = \(titleLength: number, scale: number\) => \{/.test(editorSource), true);
  assert.equal(/if \(titleLength > 60\) return `\$\{1\.25 \* scale\}rem`;/.test(editorSource), true);
  assert.equal(/if \(titleLength > 40\) return `\$\{1\.5 \* scale\}rem`;/.test(editorSource), true);
  assert.equal(/if \(titleLength > 20\) return `\$\{1\.75 \* scale\}rem`;/.test(editorSource), true);
  assert.equal(/return `\$\{2 \* scale\}rem`;/.test(editorSource), true);
  assert.equal(/const handleTitleChange = \(value: string\) => \{\s*setTitle\(getLimitedTitle\(value\)\);\s*\};/.test(editorSource), true);
  assert.equal(/onChange=\{\(e\) => handleTitleChange\(e\.target\.value\)\}/.test(editorSource), true);
});

test('history versions open in a right drawer with a scrollable list', () => {
  assert.equal(/className="fixed inset-0 z-50 flex justify-end bg-black\/40"/.test(editorSource), true);
  assert.equal(/className="flex h-full w-full max-w-\[420px\] flex-col bg-white shadow-2xl"/.test(editorSource), true);
  assert.equal(/className="min-h-0 flex-1 overflow-y-scroll"/.test(editorSource), true);
  assert.equal(/className="divide-y divide-gray-100"/.test(editorSource), true);
  assert.equal(/className="p-4 transition-colors hover:bg-gray-50"/.test(editorSource), true);
  assert.equal(/className="min-w-0 flex-1"/.test(editorSource), true);
  assert.equal(/className="truncate text-sm font-medium text-gray-800"/.test(editorSource), true);
});

test('history drawer displays total count and loads visible rows in batches', () => {
  assert.equal(/const HISTORY_BATCH_SIZE = 8;/.test(editorSource), true);
  assert.equal(/const \[visibleHistoryCount, setVisibleHistoryCount\] = useState\(HISTORY_BATCH_SIZE\)/.test(editorSource), true);
  assert.equal(/const visibleHistory = history\.slice\(0, visibleHistoryCount\);/.test(editorSource), true);
  assert.equal(/const hasMoreHistory = visibleHistoryCount < history\.length;/.test(editorSource), true);
  assert.equal(/const handleHistoryScroll = \(event: ReactUIEvent<HTMLDivElement>\) => \{/.test(editorSource), true);
  assert.equal(/setVisibleHistoryCount\(\(count\) => Math\.min\(count \+ HISTORY_BATCH_SIZE, history\.length\)\)/.test(editorSource), true);
  assert.equal(/formatMessage\(t\.editor\.historyCount, \{ count: history\.length \}\)/.test(editorSource), true);
  assert.equal(/onScroll=\{handleHistoryScroll\}/.test(editorSource), true);
  assert.equal(/\{visibleHistory\.map\(\(h\) =>/.test(editorSource), true);
});

test('history drawer can preview a read-only history version', () => {
  assert.equal(/const \[previewHistory, setPreviewHistory\] = useState<notes\.Note \| null>\(null\)/.test(editorSource), true);
  assert.equal(/onClick=\{\(\) => setPreviewHistory\(h\)\}/.test(editorSource), true);
  assert.equal(/\{t\.editor\.historyPreview\}/.test(editorSource), true);
  assert.equal(/\{t\.editor\.historyBackupTime\}/.test(editorSource), true);
  assert.equal(/<ReactMarkdown remarkPlugins=\{\[remarkGfm\]\} components=\{markdownComponents\} urlTransform=\{markdownUrlTransform\}>\{previewHistory\.content \|\| `\*\$\{t\.noteList\.noContent\}\*`\}<\/ReactMarkdown>/.test(editorSource), true);
});

test('history drawer count and preview labels are localized', () => {
  assert.equal(/historyCount:\s*'共 \{count\} 个版本'/.test(zhCNSource), true);
  assert.equal(/historyPreview:\s*'预览'/.test(zhCNSource), true);
  assert.equal(/historyBackupTime:\s*'备份时间'/.test(zhCNSource), true);
  assert.equal(/historyLoadMore:\s*'继续下拉加载更多'/.test(zhCNSource), true);
  assert.equal(/historyCount:\s*'共 \{count\} 個版本'/.test(zhTWSource), true);
  assert.equal(/historyPreview:\s*'預覽'/.test(zhTWSource), true);
  assert.equal(/historyBackupTime:\s*'備份時間'/.test(zhTWSource), true);
  assert.equal(/historyLoadMore:\s*'繼續下拉載入更多'/.test(zhTWSource), true);
  assert.equal(/historyCount:\s*'\{count\} versions'/.test(enUSSource), true);
  assert.equal(/historyPreview:\s*'Preview'/.test(enUSSource), true);
  assert.equal(/historyBackupTime:\s*'Backup time'/.test(enUSSource), true);
  assert.equal(/historyLoadMore:\s*'Scroll down to load more'/.test(enUSSource), true);
});

test('editor top-right icon buttons use localized hover names and accessible labels', () => {
  assert.equal(/title=\{formatMessage\(t\.editor\.zoomOutTooltip, \{ percent: fontPercent \}\)\}/.test(editorSource), true);
  assert.equal(/aria-label=\{formatMessage\(t\.editor\.zoomOutTooltip, \{ percent: fontPercent \}\)\}/.test(editorSource), true);
  assert.equal(/title=\{formatMessage\(t\.editor\.zoomInTooltip, \{ percent: fontPercent \}\)\}/.test(editorSource), true);
  assert.equal(/aria-label=\{formatMessage\(t\.editor\.zoomInTooltip, \{ percent: fontPercent \}\)\}/.test(editorSource), true);
  assert.equal(/title=\{showMarkdownToolbar \? t\.editor\.collapseMarkdownToolbar : t\.editor\.expandMarkdownToolbar\}/.test(editorSource), true);
  assert.equal(/aria-label=\{showMarkdownToolbar \? t\.editor\.collapseMarkdownToolbar : t\.editor\.expandMarkdownToolbar\}/.test(editorSource), true);
  assert.equal(/title=\{t\.editor\.tagsTooltip\}/.test(editorSource), true);
  assert.equal(/aria-label=\{t\.editor\.tagsTooltip\}/.test(editorSource), true);
  assert.equal(/title=\{t\.editor\.historyTooltip\}/.test(editorSource), true);
  assert.equal(/aria-label=\{t\.editor\.historyTooltip\}/.test(editorSource), true);
  assert.equal(/title=\{t\.editor\.exportTooltip\}/.test(editorSource), true);
  assert.equal(/aria-label=\{t\.editor\.exportTooltip\}/.test(editorSource), true);
});

test('editor top-right toolbar hover labels are localized', () => {
  assert.equal(/zoomOutTooltip:\s*'缩小字体（当前 \{percent\}）'/.test(zhCNSource), true);
  assert.equal(/zoomInTooltip:\s*'放大字体（当前 \{percent\}）'/.test(zhCNSource), true);
  assert.equal(/expandMarkdownToolbar:\s*'展开 Markdown 工具栏'/.test(zhCNSource), true);
  assert.equal(/collapseMarkdownToolbar:\s*'收起 Markdown 工具栏'/.test(zhCNSource), true);
  assert.equal(/tagsTooltip:\s*'标签'/.test(zhCNSource), true);
  assert.equal(/historyTooltip:\s*'历史版本'/.test(zhCNSource), true);
  assert.equal(/exportTooltip:\s*'导出'/.test(zhCNSource), true);

  assert.equal(/zoomOutTooltip:\s*'縮小字體（目前 \{percent\}）'/.test(zhTWSource), true);
  assert.equal(/zoomInTooltip:\s*'放大字體（目前 \{percent\}）'/.test(zhTWSource), true);
  assert.equal(/expandMarkdownToolbar:\s*'展開 Markdown 工具列'/.test(zhTWSource), true);
  assert.equal(/collapseMarkdownToolbar:\s*'收起 Markdown 工具列'/.test(zhTWSource), true);
  assert.equal(/tagsTooltip:\s*'標籤'/.test(zhTWSource), true);
  assert.equal(/historyTooltip:\s*'歷史版本'/.test(zhTWSource), true);
  assert.equal(/exportTooltip:\s*'匯出'/.test(zhTWSource), true);

  assert.equal(/zoomOutTooltip:\s*'Decrease font size \(current \{percent\}\)'/.test(enUSSource), true);
  assert.equal(/zoomInTooltip:\s*'Increase font size \(current \{percent\}\)'/.test(enUSSource), true);
  assert.equal(/expandMarkdownToolbar:\s*'Expand Markdown toolbar'/.test(enUSSource), true);
  assert.equal(/collapseMarkdownToolbar:\s*'Collapse Markdown toolbar'/.test(enUSSource), true);
  assert.equal(/tagsTooltip:\s*'Tags'/.test(enUSSource), true);
  assert.equal(/historyTooltip:\s*'Version history'/.test(enUSSource), true);
  assert.equal(/exportTooltip:\s*'Export'/.test(enUSSource), true);
});
