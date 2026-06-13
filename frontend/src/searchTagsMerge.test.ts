import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const searchSource = readFileSync('src/components/SearchView.tsx', 'utf8');
const tagsSource = readFileSync('src/components/TagsView.tsx', 'utf8');
const sidebarSource = readFileSync('src/components/Sidebar.tsx', 'utf8');
const mainLayoutSource = readFileSync('src/components/MainLayout.tsx', 'utf8');
const storeSource = readFileSync('src/store/index.ts', 'utf8');

test('search view embeds the tag panel as a two column find workspace', () => {
  assert.equal(/import \{ TagsPanel \} from '\.\/TagsView';/.test(searchSource), true);
  assert.equal(/lg:grid-cols-\[minmax\(0,2fr\)_minmax\(280px,1fr\)\]/.test(searchSource), true);
  assert.equal(/<section className="min-w-0 flex flex-col overflow-hidden">/.test(searchSource), true);
  assert.equal(/<aside className="min-w-0 border-t border-gray-100 bg-gray-50\/60 lg:border-l lg:border-t-0">/.test(searchSource), true);
  assert.equal(/<TagsPanel embedded \/>/.test(searchSource), true);
  assert.equal(/ref=\{listContainerRef\}/.test(searchSource), true);
});

test('tag panel keeps tag management and routes tag clicks to filtered notes', () => {
  assert.equal(/interface TagsPanelProps/.test(tagsSource), true);
  assert.equal(/embedded = false/.test(tagsSource), true);
  assert.equal(/export function TagsPanel/.test(tagsSource), true);
  assert.equal(/export function TagsView\(\) \{[\s\S]*<TagsPanel \/>[\s\S]*\}/.test(tagsSource), true);
  assert.equal(/setSelectedTagId\(tagId\)/.test(tagsSource), true);
  assert.equal(/setCurrentView\('notes'\)/.test(tagsSource), true);
});

test('tag panel renders a compact list with edit mode controls hidden by default', () => {
  assert.equal(/const \[isEditingTags, setIsEditingTags\] = useState\(false\)/.test(tagsSource), true);
  assert.equal(/onClick=\{\(\) => setIsEditingTags\(\(editing\) => !editing\)\}/.test(tagsSource), true);
  assert.equal(/\{tags\.length > 0 && \([\s\S]*aria-pressed=\{isEditingTags\}/.test(tagsSource), true);
  assert.equal(/aria-pressed=\{isEditingTags\}/.test(tagsSource), true);
  assert.equal(/isEditingTags \? t\.common\.finish : t\.common\.edit/.test(tagsSource), true);
  assert.equal(/space-y-1\.5/.test(tagsSource), true);
  assert.equal(/onClick=\{\(\) => handleViewNotes\(tag\.id\)\}/.test(tagsSource), true);
  assert.equal(/getNoteCountForTag\(tag\.id\)/.test(tagsSource), true);
  assert.equal(/\{getNoteCountForTag\(tag\.id\)\}篇/.test(tagsSource), true);
  assert.equal(/text-xs tabular-nums text-gray-400/.test(tagsSource), true);
  assert.equal(/isEditingTags && \(/.test(tagsSource), true);
  assert.equal(/onClick=\{\(event\) => \{[\s\S]*event\.stopPropagation\(\);[\s\S]*openEditDialog\(tag\);[\s\S]*\}\}/.test(tagsSource), true);
  assert.equal(/onClick=\{\(event\) => \{[\s\S]*event\.stopPropagation\(\);[\s\S]*handleDeleteClick\(tag\.id\);[\s\S]*\}\}/.test(tagsSource), true);
});

test('sidebar and main layout no longer expose tags as a standalone page', () => {
  assert.equal(/id:\s*'tags'/.test(sidebarSource), false);
  assert.equal(/import \{ Tag \}/.test(sidebarSource), false);
  assert.equal(/case 'tags':/.test(mainLayoutSource), false);
  assert.equal(/import \{ TagsView \}/.test(mainLayoutSource), false);
  assert.equal(/'tags'/.test(storeSource), false);
});
