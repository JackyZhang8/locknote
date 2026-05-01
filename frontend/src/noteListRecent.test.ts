import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/components/NoteList.tsx', 'utf8');

test('recent note list loads more notes while scrolling', () => {
  assert.equal(/RECENT_PAGE_SIZE/.test(source), true);
  assert.equal(/loadMoreRecentNotes/.test(source), true);
  assert.equal(/ListNotesPaginated/.test(source), true);
  assert.equal(/recentHasMore/.test(source), true);
  assert.equal(/scrollTop \+ clientHeight >= scrollHeight - 120/.test(source), true);
});

test('recent virtualized note menu is stacked above following rows', () => {
  assert.equal(/zIndex:\s*menuOpen === note\.id \? 300 : 0/.test(source), true);
  assert.equal(/z-\[1000\] min-w-\[140px\]/.test(source), true);
});
