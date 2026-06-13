import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const editorSource = readFileSync('src/components/NoteEditor.tsx', 'utf8');

test('note editor tag menu has a bounded list and a create tag entry', () => {
  assert.equal(/const TAG_COLORS = \[/.test(editorSource), true);
  assert.equal(/const \[showCreateTagDialog, setShowCreateTagDialog\] = useState\(false\)/.test(editorSource), true);
  assert.equal(/const \[newTagName, setNewTagName\] = useState\(''\)/.test(editorSource), true);
  assert.equal(/const \[newTagColor, setNewTagColor\] = useState\(TAG_COLORS\[0\]\)/.test(editorSource), true);
  assert.equal(/setTags,/.test(editorSource), true);
  assert.equal(/max-h-\[24rem\] overflow-y-auto/.test(editorSource), true);
  assert.equal(/onClick=\{\(\) => setShowCreateTagDialog\(true\)\}/.test(editorSource), true);
  assert.equal(/\{t\.tags\.newTag\}/.test(editorSource), true);
});

test('creating a tag from the editor refreshes tags and attaches it to the current note', () => {
  assert.equal(/const closeCreateTagDialog = \(\) => \{/.test(editorSource), true);
  assert.equal(/const handleCreateTagFromEditor = async \(\) => \{/.test(editorSource), true);

  const createStart = editorSource.indexOf('const handleCreateTagFromEditor = async () =>');
  const createEnd = editorSource.indexOf('const modeButtons', createStart);
  const createSource = editorSource.slice(createStart, createEnd);

  assert.equal(/if \(!selectedNote \|\| !newTagName\.trim\(\)\) return;/.test(createSource), true);
  assert.equal(/const createdTag = await App\.CreateTag\(newTagName\.trim\(\), newTagColor\)/.test(createSource), true);
  assert.equal(/const updatedTags = await App\.ListTags\(\)/.test(createSource), true);
  assert.equal(/setTags\(updatedTags \|\| \[\]\)/.test(createSource), true);
  assert.equal(/await App\.AddTagToNote\(selectedNote\.id, createdTag\.id\)/.test(createSource), true);
  assert.equal(/const updated = await App\.GetNote\(selectedNote\.id\)/.test(createSource), true);
  assert.equal(/updateSelectedNote\(updated\)/.test(createSource), true);
  assert.equal(/const notesList = await App\.ListNotes\(\)/.test(createSource), true);
  assert.equal(/setNotes\(safeNotes\)/.test(createSource), true);
  assert.equal(/onNotesReloaded\?\.\(safeNotes\)/.test(createSource), true);
  assert.equal(/closeCreateTagDialog\(\)/.test(createSource), true);
});

test('editor create tag dialog reuses tag name and color controls', () => {
  assert.equal(/\{showCreateTagDialog && \(/.test(editorSource), true);
  assert.equal(/role="dialog"/.test(editorSource), true);
  assert.equal(/aria-modal="true"/.test(editorSource), true);
  assert.equal(/placeholder=\{t\.tags\.tagNamePlaceholder\}/.test(editorSource), true);
  assert.equal(/\{TAG_COLORS\.map\(\(c\) => \(/.test(editorSource), true);
  assert.equal(/onClick=\{\(\) => setNewTagColor\(c\)\}/.test(editorSource), true);
  assert.equal(/disabled=\{!newTagName\.trim\(\)\}/.test(editorSource), true);
  assert.equal(/onClick=\{handleCreateTagFromEditor\}/.test(editorSource), true);
});
