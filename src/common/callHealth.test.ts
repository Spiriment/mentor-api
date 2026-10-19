import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { summarizeCallSession } from './callHealth';

const roles = { mentorId: 'mentor-1', menteeId: 'mentee-1' };

describe('summarizeCallSession', () => {
  it('flags the Android-no-video pattern from the Oct 13 test call', () => {
    const health = summarizeCallSession(
      {
        sessionId: 's1',
        participants: [
          {
            user_id: 'mentor-1',
            name: 'Ada',
            sessions: [{ os: 'iOS', published_tracks: { video: true, audio: true }, cq_score: 93 }],
          },
          {
            user_id: 'mentee-1',
            name: 'Ben',
            sessions: [
              { os: 'android', published_tracks: { video: false, audio: false }, cq_score: 100 },
              { os: 'android', published_tracks: { video: false, audio: true }, cq_score: 88 },
              { os: 'android', published_tracks: { video: false, audio: true }, cq_score: 34 },
            ],
          },
        ],
      },
      roles,
    );
    const mentee = health.participants.find((p) => p.role === 'mentee')!;
    assert.equal(mentee.joins, 3);
    assert.equal(mentee.sentVideo, false);
    assert.equal(mentee.sentAudio, true);
    assert.equal(mentee.worstQuality, 34);
    assert.deepEqual(health.warnings, [
      "Mentee (Ben)'s video never reached the call on android.",
      'Mentee (Ben) joined 3 times — likely dropped connections.',
      'Mentee (Ben) had a poor connection (quality 34/100).',
    ]);
  });

  it('reports a party who never joined', () => {
    const health = summarizeCallSession(
      {
        sessionId: 's2',
        participants: [
          { user_id: 'mentor-1', sessions: [{ published_tracks: { video: true, audio: true } }] },
        ],
      },
      roles,
    );
    assert.deepEqual(health.warnings, ['Mentee never joined this call.']);
  });

  it('a healthy call has no warnings', () => {
    const ok = { published_tracks: { video: true, audio: true }, cq_score: 90 };
    const health = summarizeCallSession(
      {
        sessionId: 's3',
        participants: [
          { user_id: 'mentor-1', sessions: [ok] },
          { user_id: 'mentee-1', sessions: [ok] },
        ],
      },
      roles,
    );
    assert.deepEqual(health.warnings, []);
  });
});
