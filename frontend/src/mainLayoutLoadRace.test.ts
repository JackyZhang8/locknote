import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/components/MainLayout.tsx', 'utf8');

test('selected-note loads ignore responses after the selection changes', () => {
  assert.equal(/let cancelled = false;[\s\S]*const note = await App\.GetNote\(selectedNoteId\);[\s\S]*if \(!cancelled\) setSelectedNote\(note\);/.test(source), true);
  assert.equal(/return \(\) => \{\s*cancelled = true;\s*\};/.test(source), true);
});
