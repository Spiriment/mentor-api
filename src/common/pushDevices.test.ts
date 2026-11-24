import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deadTokensFromTickets, deviceTokensToSend } from './pushDevices';

const A = 'ExponentPushToken[aaa]';
const B = 'ExponentPushToken[bbb]';
const C = 'ExpoPushToken[ccc]';

test('deviceTokensToSend: every device once, passed token first', () => {
  assert.deepEqual(deviceTokensToSend(A, [B, A, C]), [A, B, C]);
  assert.deepEqual(deviceTokensToSend(null, [B, B]), [B]);
  assert.deepEqual(deviceTokensToSend(undefined, []), []);
});

test('deviceTokensToSend: drops invalid and excluded tokens', () => {
  assert.deepEqual(deviceTokensToSend('not-a-token', [A, '', null, 'fcm:xyz']), [A]);
  assert.deepEqual(deviceTokensToSend(A, [B, C], [A, C]), [B]);
});

test('deadTokensFromTickets: only DeviceNotRegistered, matched by position', () => {
  const tickets = [
    { status: 'ok' },
    { status: 'error', details: { error: 'DeviceNotRegistered' } },
    { status: 'error', details: { error: 'MessageRateExceeded' } },
    undefined,
  ];
  assert.deepEqual(deadTokensFromTickets([A, B, C, 'ExponentPushToken[d]'], tickets), [B]);
});
