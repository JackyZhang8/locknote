import assert from 'node:assert/strict';
import test from 'node:test';
import { isValidRecoveryKey, normalizeRecoveryKey } from './recoveryKey.js';

test('normalizeRecoveryKey strips separators and uppercases', () => {
  assert.equal(normalizeRecoveryKey('abcd-efgh-jkmn-pqrs'), 'ABCDEFGHJKMNPQRS');
  assert.equal(normalizeRecoveryKey('  abcd efgh jkmn pqrs '), 'ABCDEFGHJKMNPQRS');
});

test('normalizeRecoveryKey maps ambiguous characters', () => {
  assert.equal(normalizeRecoveryKey('ABCDEFGHJKMNPQIL'), 'ABCDEFGHJKMNPQ11');
  assert.equal(normalizeRecoveryKey('OOOOOOOOOOOOOOOO'), '0000000000000000');
});

test('isValidRecoveryKey accepts 16 Crockford characters', () => {
  assert.equal(isValidRecoveryKey('ABCDEFGHJKMNPQRS'), true);
  assert.equal(isValidRecoveryKey('abcd efgh jkmn pqrs'), true);
});

test('isValidRecoveryKey rejects wrong length or characters', () => {
  assert.equal(isValidRecoveryKey(''), false);
  assert.equal(isValidRecoveryKey('ABCDE'), false);
  assert.equal(isValidRecoveryKey('ABCDEFGHJKMNPQR'), false);
  assert.equal(isValidRecoveryKey('ABCDEFGHJKMNPQRSX'), false);
  assert.equal(isValidRecoveryKey('ABCDEFGHJKMNPQR$'), false);
});
