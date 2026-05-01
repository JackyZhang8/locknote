import test from 'node:test';
import assert from 'node:assert/strict';

import { attachmentMarkdown, markdownUrlTransform, parseAttachmentId } from './imageAttachments.js';

test('attachmentMarkdown creates stable LockNote image references', () => {
  assert.equal(
    attachmentMarkdown({ id: 'abc-123', originalName: 'Screenshot 1.png' }),
    '![Screenshot 1.png](locknote-attachment://abc-123)',
  );
});

test('parseAttachmentId only accepts LockNote attachment URLs', () => {
  assert.equal(parseAttachmentId('locknote-attachment://abc-123'), 'abc-123');
  assert.equal(parseAttachmentId('https://example.com/image.png'), null);
  assert.equal(parseAttachmentId(undefined), null);
});

test('markdownUrlTransform preserves LockNote attachment image URLs', () => {
  assert.equal(
    markdownUrlTransform('locknote-attachment://abc-123'),
    'locknote-attachment://abc-123',
  );
});

test('markdownUrlTransform keeps normal safe URLs and strips unsafe protocols', () => {
  assert.equal(markdownUrlTransform('https://example.com/image.png'), 'https://example.com/image.png');
  assert.equal(markdownUrlTransform('/relative/image.png'), '/relative/image.png');
  assert.equal(markdownUrlTransform('javascript:alert(1)'), '');
});
