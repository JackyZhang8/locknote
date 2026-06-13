import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync('src/components/TagsView.tsx', 'utf8');

test('tag create and edit use the same modal dialog instead of an inline page form', () => {
  assert.equal(/const \[tagDialogMode, setTagDialogMode\]/.test(source), true);
  assert.equal(/const openCreateDialog = \(\) =>/.test(source), true);
  assert.equal(/const openEditDialog = \(tag:/.test(source), true);
  assert.equal(/const closeTagDialog = \(\) =>/.test(source), true);
  assert.equal(/\{tagDialogMode && \(/.test(source), true);
  assert.equal(/fixed inset-0 z-50 flex items-center justify-center bg-black\/30/.test(source), true);
  assert.equal(/onClick=\{closeTagDialog\}/.test(source), true);
  assert.equal(/onClick=\{\(e\) => e\.stopPropagation\(\)\}/.test(source), true);
  assert.equal(/aria-label=\{t\.common\.close\}/.test(source), true);
  assert.equal(/showCreate/.test(source), false);
  assert.equal(/editingId/.test(source), false);
});

test('tag create and update refresh page data after saving from the modal', () => {
  assert.equal(/const refreshTagPageData = async \(\) =>/.test(source), true);
  assert.equal(/const updatedTags = await App\.ListTags\(\)/.test(source), true);
  assert.equal(/const notesList = await App\.ListNotes\(\)/.test(source), true);
  assert.equal(/if \(selectedNote\) \{[\s\S]*const updated = await App\.GetNote\(selectedNote\.id\)/.test(source), true);

  const createStart = source.indexOf('const handleCreate = async () =>');
  const createEnd = source.indexOf('const handleUpdate = async () =>', createStart);
  const createSource = source.slice(createStart, createEnd);
  assert.equal(/await App\.CreateTag\(name\.trim\(\), color\)/.test(createSource), true);
  assert.equal(/await refreshTagPageData\(\)/.test(createSource), true);
  assert.equal(/closeTagDialog\(\)/.test(createSource), true);

  const updateStart = source.indexOf('const handleUpdate = async () =>');
  const updateEnd = source.indexOf('const handleDeleteClick', updateStart);
  const updateSource = source.slice(updateStart, updateEnd);
  assert.equal(/if \(!editingTagId \|\| !name\.trim\(\)\) return;/.test(updateSource), true);
  assert.equal(/await App\.UpdateTag\(editingTagId, name\.trim\(\), color\)/.test(updateSource), true);
  assert.equal(/await refreshTagPageData\(\)/.test(updateSource), true);
  assert.equal(/closeTagDialog\(\)/.test(updateSource), true);
});
