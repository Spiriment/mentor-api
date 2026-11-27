import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildReportContext,
  cleanReportDetails,
  isReportReason,
  MAX_REPORT_DETAILS,
  REPORT_CONTEXT_MESSAGES,
  sessionsReviewAfterUnblock,
  sessionsReviewFor,
  type ContextMessage,
} from './safety';

const msg = (n: number): ContextMessage => ({
  id: `m${n}`,
  senderId: 'u',
  content: `message ${n}`,
  type: 'text',
  sentAt: new Date(2026, 10, 1, 12, n).toISOString(),
});

describe('report reasons', () => {
  it('accepts only the known reasons', () => {
    assert.equal(isReportReason('harassment'), true);
    assert.equal(isReportReason('Harassment'), false);
    assert.equal(isReportReason('toString'), false);
    assert.equal(isReportReason(undefined), false);
  });
});

describe('cleanReportDetails', () => {
  it('trims, empties to null and caps the length', () => {
    assert.equal(cleanReportDetails('  hi  '), 'hi');
    assert.equal(cleanReportDetails('   '), null);
    assert.equal(cleanReportDetails(42), null);
    assert.equal(cleanReportDetails('x'.repeat(MAX_REPORT_DETAILS + 50))!.length, MAX_REPORT_DETAILS);
  });
});

describe('sessions review', () => {
  it('only asks an admin when sessions are booked', () => {
    assert.equal(sessionsReviewFor(0), 'none');
    assert.equal(sessionsReviewFor(2), 'pending');
  });

  it('unblocking withdraws an open review but keeps a decision', () => {
    assert.equal(sessionsReviewAfterUnblock('pending'), 'withdrawn');
    assert.equal(sessionsReviewAfterUnblock('cancelled'), 'cancelled');
    assert.equal(sessionsReviewAfterUnblock('kept'), 'kept');
    assert.equal(sessionsReviewAfterUnblock('none'), 'none');
  });
});

describe('buildReportContext', () => {
  it('orders oldest first around the reported message and caps each side', () => {
    const before = Array.from({ length: 15 }, (_, i) => msg(49 - i)); // newest first: 49..35
    const after = Array.from({ length: 15 }, (_, i) => msg(51 + i)); // 51..65
    const { messages, reportedMessageId } = buildReportContext(before, msg(50), after);
    assert.equal(reportedMessageId, 'm50');
    assert.equal(messages.length, REPORT_CONTEXT_MESSAGES * 2 + 1);
    assert.equal(messages[0].id, 'm40');
    assert.equal(messages[REPORT_CONTEXT_MESSAGES].id, 'm50');
    assert.equal(messages[messages.length - 1].id, 'm60');
  });

  it('works at the start of a conversation', () => {
    const { messages } = buildReportContext([], msg(1), [msg(2)]);
    assert.deepEqual(messages.map((m) => m.id), ['m1', 'm2']);
  });
});
