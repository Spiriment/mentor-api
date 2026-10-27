import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SESSION_STATUS } from '@/database/entities/session.entity';
import { planSessionUpdate, SessionUpdateError } from './sessionUpdateRules';

const at = new Date('2026-11-03T08:00:00Z');
const base = {
  status: SESSION_STATUS.CONFIRMED,
  scheduledAt: at,
  duration: 45,
  mentorId: 'mentor',
  menteeId: 'mentee',
};
const minutes = (m: number) => new Date(at.getTime() + m * 60000);
const fails = (fn: () => unknown, re: RegExp) =>
  assert.throws(fn, (e: unknown) => e instanceof SessionUpdateError && re.test(e.message));

describe('session update rules', () => {
  it('starts a confirmed session from 10 minutes early, once', () => {
    const u = planSessionUpdate(base, 'mentee', { status: 'in_progress', startedAt: '2020-01-01' }, minutes(-10));
    assert.equal(u.status, SESSION_STATUS.IN_PROGRESS);
    assert.deepEqual(u.startedAt, minutes(-10)); // server time, not the client's
    fails(() => planSessionUpdate(base, 'mentee', { status: 'in_progress' }, minutes(-11)), /join in 1 minute/);
    fails(() => planSessionUpdate(base, 'mentee', { status: 'in_progress' }, minutes(76)), /already ended/);
  });

  it('keeps the first start time when someone rejoins', () => {
    const running = { ...base, status: SESSION_STATUS.IN_PROGRESS, startedAt: minutes(1) };
    const u = planSessionUpdate(running, 'mentor', { status: 'in_progress', startedAt: minutes(20).toISOString() }, minutes(20));
    assert.equal(u.startedAt, undefined);
  });

  it('lets the mentor (not the mentee) start a request they never accepted', () => {
    const pending = { ...base, status: SESSION_STATUS.SCHEDULED };
    assert.equal(planSessionUpdate(pending, 'mentor', { status: 'in_progress' }, at).status, SESSION_STATUS.IN_PROGRESS);
    fails(() => planSessionUpdate(pending, 'mentee', { status: 'in_progress' }, at), /not been accepted/);
  });

  it('only completes a session that is in progress', () => {
    const running = { ...base, status: SESSION_STATUS.IN_PROGRESS, startedAt: at };
    const u = planSessionUpdate(running, 'mentee', { status: 'completed', endedAt: '2020-01-01' }, minutes(40));
    assert.equal(u.status, SESSION_STATUS.COMPLETED);
    assert.deepEqual(u.endedAt, minutes(40));
    fails(() => planSessionUpdate(base, 'mentee', { status: 'completed' }, minutes(-60)), /in progress/);
  });

  it('refuses status changes that have their own endpoints', () => {
    const pending = { ...base, status: SESSION_STATUS.SCHEDULED };
    fails(() => planSessionUpdate(pending, 'mentee', { status: 'confirmed' }), /accept, decline/);
    fails(() => planSessionUpdate(base, 'mentee', { status: 'cancelled' }), /accept, decline/);
  });

  it('protects the time and each side\'s notes', () => {
    fails(() => planSessionUpdate(base, 'mentee', { scheduledAt: minutes(60).toISOString() }), /reschedule/);
    fails(() => planSessionUpdate(base, 'mentee', { mentorNotes: 'x' }), /Only the mentor/);
    fails(() => planSessionUpdate(base, 'mentor', { menteeNotes: 'x' }), /Only the mentee/);
    assert.deepEqual(planSessionUpdate(base, 'mentor', { mentorNotes: 'n', sessionSummary: 's' }), { mentorNotes: 'n', sessionSummary: 's' });
    fails(() => planSessionUpdate(base, 'stranger', { title: 'x' }), /permission/);
  });
});
