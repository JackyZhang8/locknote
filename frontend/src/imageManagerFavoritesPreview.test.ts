import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync('src/components/ImageManager.tsx', 'utf8');

test('image manager exposes favorite controls backed by the attachment API', () => {
  assert.equal(/Heart/.test(source), true);
  assert.equal(/showFavoritesOnly/.test(source), true);
  assert.equal(/filterFavoriteImages/.test(source), true);
  assert.equal(/SetAttachmentFavorite\(attachment\.id, !attachment\.favorite\)/.test(source), true);
  assert.equal(/aria-pressed=\{attachment\.favorite\}/.test(source), true);
});

test('image manager opens a modal preview when an image card is clicked', () => {
  assert.equal(/previewAttachment/.test(source), true);
  assert.equal(/setPreviewAttachment\(attachment\)/.test(source), true);
  assert.equal(/\{previewAttachment && previewDataURL && \(/.test(source), true);
  assert.equal(/onClick=\{\(\) => setPreviewAttachment\(null\)\}/.test(source), true);
});

test('image preview overlay is scoped to the image manager content area', () => {
  assert.equal(/className="relative flex-1 overflow-hidden bg-gray-50 flex flex-col"/.test(source), true);
  assert.equal(
    /\{previewAttachment && previewDataURL && \(\s*<div\s+className="absolute inset-0 z-40 flex items-center justify-center bg-black\/80 p-4"/s.test(source),
    true,
  );
  assert.equal(
    /\{previewAttachment && previewDataURL && \(\s*<div\s+className="fixed inset-0/s.test(source),
    false,
  );
});
