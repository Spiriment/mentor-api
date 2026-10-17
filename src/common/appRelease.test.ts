import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  compareVersions,
  isOutdated,
  parseAppReleaseConfig,
  validateAppReleaseConfig,
} from './appRelease';

describe('compareVersions', () => {
  it('compares numerically, not lexically', () => {
    assert.equal(compareVersions('1.0.10', '1.0.9'), 1);
    assert.equal(compareVersions('1.2.0', '1.10.0'), -1);
  });
  it('treats missing segments as zero', () => {
    assert.equal(compareVersions('1.0', '1.0.0'), 0);
    assert.equal(compareVersions('2', '1.9.9'), 1);
  });
});

describe('isOutdated', () => {
  it('flags older versions only', () => {
    assert.equal(isOutdated('1.0.4', '1.0.5'), true);
    assert.equal(isOutdated('1.0.5', '1.0.5'), false);
    assert.equal(isOutdated('1.0.6', '1.0.5'), false);
  });
  it('treats builds that never reported a version as outdated', () => {
    assert.equal(isOutdated(null, '1.0.5'), true);
    assert.equal(isOutdated(undefined, '1.0.5'), true);
    assert.equal(isOutdated('garbage', '1.0.5'), true);
  });
});

describe('parseAppReleaseConfig', () => {
  it('tolerates missing and invalid data', () => {
    assert.deepEqual(parseAppReleaseConfig(undefined), {
      ios: { latestVersion: null, minimumVersion: null },
      android: { latestVersion: null, minimumVersion: null },
    });
    assert.deepEqual(parseAppReleaseConfig({ ios: { latestVersion: 'x', minimumVersion: '1.0.0' } }).ios, {
      latestVersion: null,
      minimumVersion: '1.0.0',
    });
  });
});

describe('validateAppReleaseConfig', () => {
  const ok = { latestVersion: '1.0.5', minimumVersion: '1.0.4' };
  const none = { latestVersion: null, minimumVersion: null };
  it('accepts a sane config', () => {
    assert.equal(validateAppReleaseConfig({ ios: ok, android: none }), null);
  });
  it('rejects a minimum above latest (nobody could satisfy it)', () => {
    assert.match(
      validateAppReleaseConfig({ ios: { latestVersion: '1.0.5', minimumVersion: '1.0.6' }, android: none })!,
      /above latest/,
    );
  });
  it('rejects a minimum without a latest', () => {
    assert.match(
      validateAppReleaseConfig({ ios: none, android: { latestVersion: null, minimumVersion: '1.0.0' } })!,
      /latest version/,
    );
  });
});
