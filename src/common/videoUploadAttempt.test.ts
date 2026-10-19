import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sanitizeVideoUploadAttempt } from './videoUploadAttempt';

describe('sanitizeVideoUploadAttempt', () => {
  it('accepts a failed upload report', () => {
    const r = sanitizeVideoUploadAttempt({
      outcome: 'failed',
      stage: 'upload',
      errorMessage: '  File size too large. Got 140000000. Maximum is 104857600.  ',
      originalSizeBytes: 300_000_000,
      uploadSizeBytes: 140_000_000,
      durationSeconds: 95.4,
      platform: 'android',
      appVersion: '1.0.5',
    });
    assert.ok(r);
    assert.equal(r.errorMessage, 'File size too large. Got 140000000. Maximum is 104857600.');
    assert.equal(r.durationSeconds, 95);
    assert.equal(r.compressionFailed, false);
  });

  it('rejects unknown outcome/stage and drops junk fields', () => {
    assert.equal(sanitizeVideoUploadAttempt({ outcome: 'exploded', stage: 'upload' }), null);
    const r = sanitizeVideoUploadAttempt({
      outcome: 'success',
      stage: 'save',
      originalSizeBytes: -5,
      platform: 'windows',
      appVersion: '1.0.5; DROP TABLE',
      errorMessage: 'x'.repeat(2000),
    })!;
    assert.equal(r.originalSizeBytes, null);
    assert.equal(r.platform, null);
    assert.equal(r.appVersion, null);
    assert.equal(r.errorMessage!.length, 500);
  });
});
