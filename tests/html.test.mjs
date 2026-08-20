import assert from 'node:assert/strict';
import test from 'node:test';
import { escapeHtml } from '../src/utils/html.js';

test('escapeHtml encodes markup and quotes, and treats null as empty', () => {
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
  assert.equal(
    escapeHtml(`<img src="x" alt='y'>&`),
    '&lt;img src=&quot;x&quot; alt=&#39;y&#39;&gt;&amp;'
  );
});
