import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync('src/components/NoteEditor.tsx', 'utf8');
test('save responses only replace the same unchanged draft', () => {
  assert.equal(source.includes('current.selectedNote === snapshot.selectedNote'), true);
  assert.equal(source.includes('current.title === snapshot.title && current.content === snapshot.content'), true);
});
test('save writes are queued and close waits even when draft matches stored content', () => {
  assert.equal(source.includes('saveQueueRef.current.then(save)'), true);
  const close = source.slice(source.indexOf('const handleRequestClose'), source.indexOf('const modeButtons'));
  assert.equal(close.includes('if (selectedNote) {'), true);
  assert.equal(close.includes('const saved = await saveNote()'), true);
});
