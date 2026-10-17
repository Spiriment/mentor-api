/**
 * App store release info: which app version is current per platform, which is the oldest
 * still allowed, and who should be told to update.
 *
 * Stored under `appRelease` in the global spiriment_settings row (edited from the admin
 * Settings page), served publicly at GET /api/app/version, and used to target
 * "update available" pushes at users whose reported app version is behind.
 */

export type AppPlatform = 'ios' | 'android';

export interface PlatformRelease {
  /** Newest version live in the store. Older apps get a dismissible "update available" prompt. */
  latestVersion: string | null;
  /** Oldest version still allowed. Older apps are blocked until they update. */
  minimumVersion: string | null;
}

export type AppReleaseConfig = Record<AppPlatform, PlatformRelease>;

export const APP_STORE_URLS: Record<AppPlatform, string> = {
  ios: 'https://apps.apple.com/app/id6775780242',
  android: 'https://play.google.com/store/apps/details?id=com.spiriment.mentor',
};

const VERSION_RE = /^\d+(\.\d+){0,3}$/;

export const isValidVersion = (v: unknown): v is string =>
  typeof v === 'string' && VERSION_RE.test(v.trim());

/** Numeric dotted-version compare: -1 if a < b, 0 if equal, 1 if a > b. "1.0" == "1.0.0". */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const pa = a.trim().split('.').map(Number);
  const pb = b.trim().split('.').map(Number);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

/**
 * Whether a user on `reportedVersion` should be told to update to `latestVersion`.
 * Builds before 1.0.5 never reported a version, so a missing/unparseable version means an
 * old build — outdated by definition.
 */
export function isOutdated(reportedVersion: string | null | undefined, latestVersion: string): boolean {
  if (!isValidVersion(reportedVersion)) return true;
  return compareVersions(reportedVersion, latestVersion) < 0;
}

const parsePlatform = (raw: unknown): PlatformRelease => {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    latestVersion: isValidVersion(obj.latestVersion) ? obj.latestVersion.trim() : null,
    minimumVersion: isValidVersion(obj.minimumVersion) ? obj.minimumVersion.trim() : null,
  };
};

/** Read the release config out of the settings JSON, tolerating missing/partial data. */
export function parseAppReleaseConfig(raw: unknown): AppReleaseConfig {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return { ios: parsePlatform(obj.ios), android: parsePlatform(obj.android) };
}

/** A minimum above latest would block users with no version they can update to. */
export function validateAppReleaseConfig(config: AppReleaseConfig): string | null {
  for (const platform of ['ios', 'android'] as const) {
    const { latestVersion, minimumVersion } = config[platform];
    if (minimumVersion && !latestVersion) {
      return `${platform}: set a latest version before a minimum version`;
    }
    if (minimumVersion && latestVersion && compareVersions(minimumVersion, latestVersion) > 0) {
      return `${platform}: minimum version ${minimumVersion} is above latest ${latestVersion}`;
    }
  }
  return null;
}

export const normalizePlatform = (v: unknown): AppPlatform | null =>
  v === 'ios' || v === 'android' ? v : null;
