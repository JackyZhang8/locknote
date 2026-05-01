import test from 'node:test';
import assert from 'node:assert/strict';

import { applyTheme, getStoredTheme, themeOptions } from './theme.js';

test('getStoredTheme falls back to apple for invalid stored theme', () => {
  const storage = {
    getItem: () => 'invalid-theme',
  };

  assert.equal(getStoredTheme(storage), 'apple');
});

test('applyTheme writes data-theme and persists the selected theme', () => {
  const dataset: Record<string, string | undefined> = {};
  const stored: Record<string, string> = {};

  const doc = {
    documentElement: {
      dataset,
    },
  };

  const storage = {
    setItem: (key: string, value: string) => {
      stored[key] = value;
    },
  };

  applyTheme('lobster', doc, storage);

  assert.equal(dataset.theme, 'lobster');
  assert.equal(stored['locknote-theme'], 'lobster');
});

test('themeOptions exposes the three supported themes in order', () => {
  assert.deepEqual(
    themeOptions.map((option) => option.id),
    ['apple', 'lobster', 'sunset'],
  );
});

test('themeOptions expose a single swatch per theme for the settings selector', () => {
  assert.deepEqual(
    themeOptions.map((option) => [option.id, option.swatch]),
    [
      ['apple', '#22c55e'],
      ['lobster', '#e04747'],
      ['sunset', '#f86a3b'],
    ],
  );
});
