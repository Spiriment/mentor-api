import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demoPageKey } from './demoPage';

test('demoPageKey accepts portal page names', () => {
  assert.equal(demoPageKey('insights'), 'insights');
  assert.equal(demoPageKey('Join-Requests'), 'join-requests');
  assert.equal(demoPageKey(' bible-reading '), 'bible-reading');
});

test('demoPageKey rejects anything that could break the JSON path or bloat the map', () => {
  for (const bad of ['', '1abc', 'a"b', "a'b", 'a.b', 'a$b', 'members/123', 'x'.repeat(41), null, 42, {}]) {
    assert.equal(demoPageKey(bad), null, String(bad));
  }
});
