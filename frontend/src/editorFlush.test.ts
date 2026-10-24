import test from 'node:test';
import assert from 'node:assert/strict';
import { flushEditor, registerEditorFlush } from './editorFlush.js';

test('flushEditor awaits the registered editor save and unregister removes it', async () => {
  let completed = false;
  const unregister = registerEditorFlush(async () => {
    await Promise.resolve();
    completed = true;
  });

  await flushEditor();
  assert.equal(completed, true);

  unregister();
  completed = false;
  await flushEditor();
  assert.equal(completed, false);
});

test('flushEditor swallows save errors', async () => {
  const unregister = registerEditorFlush(async () => {
    throw new Error('save failed');
  });
  let rejected = false;
  try {
    await flushEditor();
  } catch {
    rejected = true;
  } finally {
    unregister();
  }
  assert.equal(rejected, false);
});
