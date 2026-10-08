export type TextFileEncoding = 'utf-8' | 'gb18030' | 'big5' | 'utf-16le' | 'utf-16be';

export const TEXT_FILE_ENCODINGS: ReadonlyArray<{ value: TextFileEncoding; label: string }> = [
  { value: 'utf-8', label: 'UTF-8' },
  { value: 'gb18030', label: 'GB18030 / GBK / GB2312' },
  { value: 'big5', label: 'Big5' },
  { value: 'utf-16le', label: 'UTF-16 LE' },
  { value: 'utf-16be', label: 'UTF-16 BE' },
];

export function isSupportedTextFile(name: string): boolean {
  return /\.(md|markdown|txt)$/i.test(name);
}

export function getDroppedTextTitle(content: string, maxLength: number): string {
  const firstLine = content.split(/\r?\n/, 1)[0].trim();
  return firstLine.replace(/^#{1,6}[ \t]+/, '').trim().slice(0, maxLength);
}

export function decodeTextBytes(bytes: Uint8Array, encoding: TextFileEncoding): string {
  const content = new TextDecoder(encoding, { fatal: true }).decode(bytes);
  if (!content || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(content)) {
    throw new Error('Invalid text content');
  }
  return content;
}

export function detectTextEncoding(bytes: Uint8Array): TextFileEncoding {
  if (bytes.length === 0) throw new Error('Empty file');
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return 'utf-8';
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return 'utf-16le';
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return 'utf-16be';

  try {
    decodeTextBytes(bytes, 'utf-8');
    return 'utf-8';
  } catch {
    decodeTextBytes(bytes, 'gb18030');
    return 'gb18030';
  }
}
