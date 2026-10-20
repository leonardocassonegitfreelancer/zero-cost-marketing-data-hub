import test from 'node:test';
import assert from 'node:assert/strict';
import { isAuthorized } from '../src/auth.js';

test('accepts the matching bearer token', () => {
  assert.equal(isAuthorized('Bearer s3cret', 's3cret'), true);
});

test('ignores whitespace around the stored secret', () => {
  assert.equal(isAuthorized('Bearer s3cret', 's3cret \n'), true);
});

test('rejects a wrong token', () => {
  assert.equal(isAuthorized('Bearer nope', 's3cret'), false);
});

test('rejects a missing header', () => {
  assert.equal(isAuthorized(null, 's3cret'), false);
});

test('rejects a header without the Bearer prefix', () => {
  assert.equal(isAuthorized('s3cret', 's3cret'), false);
});

test('never authorises when the secret binding is missing or blank', () => {
  assert.equal(isAuthorized('Bearer ', undefined), false);
  assert.equal(isAuthorized('Bearer ', ''), false);
  assert.equal(isAuthorized('Bearer undefined', undefined), false);
});

test('a token that is a prefix of the secret is rejected', () => {
  assert.equal(isAuthorized('Bearer s3', 's3cret'), false);
});
