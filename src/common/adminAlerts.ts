/**
 * Per-admin notification preferences: which events each admin hears about, and how.
 * Replaces the old global "Notification Preferences" switches in Settings, which nothing read.
 */
import { ADMIN_ROLE } from './constants/adminRoles';

export const ADMIN_ALERT_EVENTS = ['mentor_application', 'support_ticket', 'subscription'] as const;
export type AdminAlertEvent = (typeof ADMIN_ALERT_EVENTS)[number];

export const ADMIN_ALERT_CHANNELS = ['push', 'email', 'bell'] as const;
export type AdminAlertChannel = (typeof ADMIN_ALERT_CHANNELS)[number];

export type AdminNotificationPreferences = Record<AdminAlertEvent, Record<AdminAlertChannel, boolean>>;

/**
 * Roles allowed to receive each event. Subscription/billing events are super-admin only,
 * matching "Manage Subscriptions & Billing" in the portal's permissions matrix.
 */
export const EVENT_ROLES: Record<AdminAlertEvent, ADMIN_ROLE[]> = {
  mentor_application: [ADMIN_ROLE.SUPER_ADMIN, ADMIN_ROLE.SUPPORT],
  support_ticket: [ADMIN_ROLE.SUPER_ADMIN, ADMIN_ROLE.SUPPORT],
  subscription: [ADMIN_ROLE.SUPER_ADMIN],
};

/**
 * Mentor applications already appear in the bell as a live "pending" queue (computed in the
 * notifications summary), so a stored bell alert would show them twice.
 */
export const BELL_UNSUPPORTED: AdminAlertEvent[] = ['mentor_application'];

/**
 * Defaults: bell on (quiet, in-portal); push on (only takes effect once the admin allows
 * notifications in a browser); email off (opt-in, to avoid inbox noise).
 */
export const DEFAULT_PREFERENCES: AdminNotificationPreferences = {
  mentor_application: { push: true, email: false, bell: false },
  support_ticket: { push: true, email: false, bell: true },
  subscription: { push: true, email: false, bell: true },
};

/** Merge stored (possibly partial or stale) preferences over the defaults. */
export function resolvePreferences(raw: unknown): AdminNotificationPreferences {
  const stored = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const result = {} as AdminNotificationPreferences;
  for (const event of ADMIN_ALERT_EVENTS) {
    const ev = stored[event] && typeof stored[event] === 'object'
      ? (stored[event] as Record<string, unknown>)
      : {};
    result[event] = {} as Record<AdminAlertChannel, boolean>;
    for (const channel of ADMIN_ALERT_CHANNELS) {
      const value = ev[channel];
      result[event][channel] = typeof value === 'boolean' ? value : DEFAULT_PREFERENCES[event][channel];
    }
    if (BELL_UNSUPPORTED.includes(event)) result[event].bell = false;
  }
  return result;
}

/** Channels an admin should be notified on for an event (empty = don't notify). */
export function channelsFor(
  admin: { role: ADMIN_ROLE; isActive: boolean; notificationPreferences?: unknown },
  event: AdminAlertEvent,
): AdminAlertChannel[] {
  if (!admin.isActive || !EVENT_ROLES[event].includes(admin.role)) return [];
  const prefs = resolvePreferences(admin.notificationPreferences)[event];
  return ADMIN_ALERT_CHANNELS.filter((c) => prefs[c]);
}
