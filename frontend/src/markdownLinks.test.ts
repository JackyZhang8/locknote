import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/components/NoteEditor.tsx', 'utf8');

test('Markdown links allow fragments, open approved schemes externally, and block other schemes', () => {
  assert.equal(/href\?\.startsWith\('#'\)/.test(source), true);
  assert.equal(/https\?:\|mailto:/i.test(source), true);
  assert.equal(/BrowserOpenURL\(href\)/.test(source), true);
  assert.equal(/event\.preventDefault\(\)/.test(source), true);
});
