import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeTextBytes, detectTextEncoding, getDroppedTextTitle, isSupportedTextFile } from './droppedTextFile.ts';

test('recognizes supported text extensions without relying on MIME type', () => {
  assert.equal(isSupportedTextFile('draft.MD'), true);
  assert.equal(isSupportedTextFile('notes.markdown'), true);
  assert.equal(isSupportedTextFile('notes.txt'), true);
  assert.equal(isSupportedTextFile('image.png'), false);
});

test('detects UTF-8 and removes a UTF-8 BOM', () => {
  const bytes = Uint8Array.from([0xef, 0xbb, 0xbf, ...new TextEncoder().encode('# 中文')]);
  assert.equal(detectTextEncoding(bytes), 'utf-8');
  assert.equal(decodeTextBytes(bytes, 'utf-8'), '# 中文');
});

test('detects UTF-16 from its BOM', () => {
  const bytes = Uint8Array.from([0xff, 0xfe, 0x23, 0x00, 0x20, 0x00, 0x2d, 0x4e]);
  assert.equal(detectTextEncoding(bytes), 'utf-16le');
  assert.equal(decodeTextBytes(bytes, 'utf-16le'), '# 中');
});

test('decodes GB2312 content through GB18030', () => {
  const bytes = Uint8Array.from([0x23, 0x20, 0xd6, 0xd0, 0xce, 0xc4]);
  assert.equal(detectTextEncoding(bytes), 'gb18030');
  assert.equal(decodeTextBytes(bytes, 'gb18030'), '# 中文');
  assert.throws(() => decodeTextBytes(bytes, 'utf-8'));
});

test('rejects empty files and binary data', () => {
  assert.throws(() => detectTextEncoding(new Uint8Array()));
  assert.throws(() => detectTextEncoding(Uint8Array.from([0, 1, 2, 3])));
});

test('uses only the first line as a title and removes Markdown heading syntax', () => {
  assert.equal(getDroppedTextTitle('# 中文标题\n正文', 80), '中文标题');
  assert.equal(getDroppedTextTitle('  普通标题  \r\n# 后续标题', 80), '普通标题');
  assert.equal(getDroppedTextTitle('\n# 后续标题', 80), '');
  assert.equal(getDroppedTextTitle('## A very long heading\n正文', 6), 'A very');
});
