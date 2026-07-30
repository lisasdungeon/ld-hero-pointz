import assert from 'node:assert/strict';
import test from 'node:test';
import { getHeroPointBaseline, toElement } from '../src/hooks.js';

test('getHeroPointBaseline: 5 + floor(level/2), matching the 2024-rules refresh target', () => {
  assert.equal(getHeroPointBaseline(1), 5);
  assert.equal(getHeroPointBaseline(2), 6);
  assert.equal(getHeroPointBaseline(3), 6);
  assert.equal(getHeroPointBaseline(20), 15);
});

test('getHeroPointBaseline: defaults to level 1 when omitted', () => {
  assert.equal(getHeroPointBaseline(), 5);
});

test('toElement: does not throw when HTMLElement is unavailable (this module has no DOM in tests)', () => {
  assert.equal(typeof HTMLElement, 'undefined', 'sanity check: this test environment has no DOM');
  assert.doesNotThrow(() => toElement({ jquery: '3.6.0', 0: {}, length: 1 }));
});

test('toElement: unwraps a jQuery-style collection to its first element', () => {
  const fakeEl = { tagName: 'DIV' };
  const jq = { jquery: '3.6.0', 0: fakeEl, length: 1 };
  assert.equal(toElement(jq), fakeEl);
});

test('toElement: an empty jQuery-style collection resolves to null', () => {
  const jq = { jquery: '3.6.0', length: 0 };
  assert.equal(toElement(jq), null);
});

test('toElement: null/undefined input returns null', () => {
  assert.equal(toElement(null), null);
  assert.equal(toElement(undefined), null);
});

test('toElement: a plain object that is neither an HTMLElement nor jQuery-shaped returns null', () => {
  assert.equal(toElement({ foo: 'bar' }), null);
});
