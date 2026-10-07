import test from 'node:test';
import assert from 'node:assert/strict';
import { indexMarkdownHeadings } from './markdownHeadings.ts';
const heading = (text: string, tagName = 'H2') => ({ id: '', textContent: text, tagName });

test('TOC IDs are assigned to actual heading elements', () => {
  const elements = [heading('Hello World'), heading('中文标题', 'H3')];
  const toc = indexMarkdownHeadings(elements, 'preview');
  assert.deepEqual(toc.map(({ id }) => id), ['preview-hello-world', 'preview-中文标题']);
  assert.equal(elements[0].id, toc[0].id);
  assert.equal(toc[1].element, elements[1]);
  assert.equal(toc[1].level, 3);
});

test('duplicate, empty and suffix-like headings get unique anchors', () => {
  const toc = indexMarkdownHeadings(['Test', 'Test', 'Test-2', '', '!!!'].map(text => heading(text)), 'p');
  assert.equal(new Set(toc.map(({ id }) => id)).size, 5);
});

test('unrelated insertions preserve IDs and preview instances do not collide', () => {
  const original = indexMarkdownHeadings([heading('Target')], 'workspace')[0].id;
  const updated = indexMarkdownHeadings([heading('New'), heading('Target')], 'workspace');
  assert.equal(updated[1].id, original);
  assert.equal(indexMarkdownHeadings([heading('Target')], 'history')[0].id === original, false);
});
