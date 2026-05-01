import test from 'node:test';
import assert from 'node:assert/strict';

import { getImageGridColumnCount, toImageRows } from './imageGrid.js';

test('getImageGridColumnCount keeps image cards compact on wide screens', () => {
  assert.equal(getImageGridColumnCount(360), 2);
  assert.equal(getImageGridColumnCount(900), 5);
  assert.equal(getImageGridColumnCount(1440), 8);
});

test('toImageRows groups attachments by the active column count', () => {
  const items = Array.from({ length: 7 }, (_, index) => ({ id: String(index + 1) }));

  assert.deepEqual(
    toImageRows(items, 3).map((row) => row.map((item) => item.id)),
    [['1', '2', '3'], ['4', '5', '6'], ['7']],
  );
});
