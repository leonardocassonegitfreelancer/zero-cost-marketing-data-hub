import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePagePath } from '../src/paths.js';

test('the three source spellings of one page reduce to the same path', () => {
  const ga4 = '/es/pricing/?utm_source=newsletter';
  const searchConsole = 'https://www.example.com/es/Pricing';
  const leadUrl = 'https://example.com/es/pricing#form';
  const expected = '/es/pricing';
  assert.equal(normalizePagePath(ga4), expected);
  assert.equal(normalizePagePath(searchConsole), expected);
  assert.equal(normalizePagePath(leadUrl), expected);
});

test('the language prefix is kept: different languages are different pages', () => {
  assert.notEqual(normalizePagePath('/es/pricing'), normalizePagePath('/en/pricing'));
});

test('the home page stays "/"', () => {
  assert.equal(normalizePagePath('/'), '/');
  assert.equal(normalizePagePath('https://example.com'), '/');
  assert.equal(normalizePagePath('https://example.com/?ref=x'), '/');
});

test('a path without a leading slash is accepted', () => {
  assert.equal(normalizePagePath('pricing'), '/pricing');
});

test('empty, missing and GA4 "(not set)" collapse to an empty string', () => {
  for (const value of ['', '   ', null, undefined, '(not set)']) {
    assert.equal(normalizePagePath(value), '');
  }
});

test('repeated trailing slashes are removed', () => {
  assert.equal(normalizePagePath('/blog///'), '/blog');
});
