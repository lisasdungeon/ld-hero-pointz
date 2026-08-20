import assert from 'node:assert/strict';
import test from 'node:test';
import { confirmAction, promptAmount } from '../src/utils/dialog.js';

test.afterEach(() => {
  delete globalThis.foundry;
});

test('confirmAction returns false when DialogV2 is missing', async () => {
  globalThis.foundry = {};
  assert.equal(await confirmAction('t', '<p>x</p>'), false);
});

test('confirmAction returns DialogV2.confirm result', async () => {
  globalThis.foundry = {
    applications: { api: { DialogV2: { confirm: async () => true } } }
  };
  assert.equal(await confirmAction('t', '<p>x</p>'), true);
});

test('promptAmount returns null when DialogV2 is missing', async () => {
  globalThis.foundry = { applications: { api: {} } };
  assert.equal(await promptAmount('t', '<input name="amount">'), null);
});

test('promptAmount returns null on cancel, empty, or non-numeric values', async () => {
  const DialogV2 = { input: async () => null };
  globalThis.foundry = { applications: { api: { DialogV2 } } };
  assert.equal(await promptAmount('t', ''), null);

  DialogV2.input = async () => ({});
  assert.equal(await promptAmount('t', ''), null);

  DialogV2.input = async () => ({ amount: '' });
  assert.equal(await promptAmount('t', ''), null);

  DialogV2.input = async () => ({ amount: 'nope' });
  assert.equal(await promptAmount('t', ''), null);
});

test('promptAmount parses a numeric amount', async () => {
  globalThis.foundry = {
    applications: { api: { DialogV2: { input: async () => ({ amount: '3' }) } } }
  };
  assert.equal(await promptAmount('t', ''), 3);
});
