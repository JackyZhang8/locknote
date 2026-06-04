import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/components/LockScreen.tsx', 'utf8');

test('LockScreen uses the latest app icon for the lock page brand mark', () => {
  assert.equal(/import appIcon from '\.\.\/assets\/app-icon\.png';/.test(source), true);
  assert.equal(/src=\{appIcon\}/.test(source), true);
  assert.equal(/<Lock className=/.test(source), false);
});

test('LockScreen title follows the iOS rounded bold LockNote styling', () => {
  assert.equal(/>\s*LockNote\s*<\/h1>/.test(source), true);
  assert.equal(/fontFamily:\s*"'SF Pro Rounded'/.test(source), true);
  assert.equal(/font-bold/.test(source), true);
});
