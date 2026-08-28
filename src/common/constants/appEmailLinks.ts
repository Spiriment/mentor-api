/**
 * HTTPS smart links for email CTAs.
 * Custom schemes (spiriment://) are blocked in most web/desktop mail clients.
 * Use these in emails; keep spiriment:// for in-app / push / Stripe return URLs.
 */

const API_PUBLIC_BASE = (
  process.env.API_PUBLIC_URL ||
  process.env.APP_URL ||
  'https://api.spiriment.com'
).replace(/\/$/, '');

/** Normalize spiriment://path, /path, or bare path → path segment for ?to= */
export function normalizeAppDeepPath(pathOrDeepLink: string): string {
  return pathOrDeepLink
    .trim()
    .replace(/^spiriment:\/\//i, '')
    .replace(/^\/+/, '');
}

/** Build https://api…/open-app?to=… for use in email buttons. */
export function buildEmailOpenUrl(pathOrDeepLink: string): string {
  const to = normalizeAppDeepPath(pathOrDeepLink);
  return `${API_PUBLIC_BASE}/open-app?to=${encodeURIComponent(to)}`;
}

export const APP_EMAIL_OPEN_ONBOARDING = buildEmailOpenUrl('onboarding');
export const APP_EMAIL_OPEN_HOME = buildEmailOpenUrl('home');
export const APP_EMAIL_OPEN_PROFILE = buildEmailOpenUrl('profile');
export const APP_EMAIL_OPEN_SESSIONS = buildEmailOpenUrl('sessions');
export const APP_EMAIL_OPEN_MENTORS = buildEmailOpenUrl('mentors');
export const APP_EMAIL_OPEN_NOTIFICATIONS = buildEmailOpenUrl('notifications');
export const APP_EMAIL_OPEN_SCHEDULE = buildEmailOpenUrl('schedule');
export const APP_EMAIL_OPEN_REPORTS = buildEmailOpenUrl('reports');
export const APP_EMAIL_OPEN_CHAT = buildEmailOpenUrl('chat');
export const APP_EMAIL_OPEN_BROWSE_MENTORS = buildEmailOpenUrl('browse-mentors');
export const APP_EMAIL_OPEN_GROUP_SESSIONS = buildEmailOpenUrl('group-sessions');

export const IOS_APP_STORE_URL =
  process.env.IOS_APP_STORE_URL ||
  'https://apps.apple.com/app/id6775780242';

export const ANDROID_PLAY_STORE_URL =
  process.env.ANDROID_PLAY_STORE_URL ||
  'https://play.google.com/store/apps/details?id=com.spiriment.mentor';
