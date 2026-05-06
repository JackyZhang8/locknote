import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync('src/components/ImageManager.tsx', 'utf8');

test('image manager moves images to trash only after an in-app confirmation dialog', () => {
  assert.equal(/window\.confirm/.test(source), false);
  assert.equal(/confirmDeleteAttachment/.test(source), true);
  assert.equal(/setConfirmDeleteAttachment\(attachment\)/.test(source), true);
  assert.equal(/handleConfirmDelete/.test(source), true);
  assert.equal(/App\.SoftDeleteAttachment\(attachment\.id\)/.test(source), true);
  assert.equal(/App\.DeleteAttachment\(attachment\.id\)/.test(source), false);
  assert.equal(/t\.attachments\.movedToTrash/.test(source), true);
  assert.equal(/\{confirmDeleteAttachment && \(/.test(source), true);
  assert.equal(/\{t\.attachments\.deleteTitle\}/.test(source), true);
  assert.equal(/\{t\.attachments\.deleteDesc\}/.test(source), true);
});
