import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { zhCN } from './i18n/locales/zh-CN.ts';
import { zhTW } from './i18n/locales/zh-TW.ts';
import { enUS } from './i18n/locales/en-US.ts';

const keys = ['heading1', 'heading2', 'bold', 'italic', 'unorderedList', 'orderedList', 'quote', 'inlineCode', 'link', 'image'] as const;
const source = readFileSync('src/components/NoteEditor.tsx', 'utf8');

test('every markdown toolbar action uses a localized title and accessible label', () => {
  const actions = source.slice(source.indexOf('const markdownActions ='), source.indexOf('const titleFontSize =', source.indexOf('const markdownActions =')));
  for (const key of keys) {
    assert.equal(actions.includes('title: t.editor.markdownToolbar.' + key + ','), true);
  }
  assert.equal(source.includes('title={action.title}'), true);
  assert.equal(source.includes('aria-label={action.title}'), true);
});

test('markdown toolbar labels are translated in all three languages', () => {
  const expected = [
    [zhCN, ['一级标题', '二级标题', '加粗', '斜体', '无序列表', '有序列表', '引用', '行内代码', '链接', '图片']],
    [zhTW, ['一級標題', '二級標題', '粗體', '斜體', '無序列表', '有序列表', '引用', '行內程式碼', '連結', '圖片']],
    [enUS, ['Heading 1', 'Heading 2', 'Bold', 'Italic', 'Bullet List', 'Numbered List', 'Blockquote', 'Inline Code', 'Link', 'Image']],
  ] as const;
  for (const [locale, labels] of expected) {
    assert.deepEqual(keys.map(key => locale.editor.markdownToolbar[key]), [...labels]);
  }
});
