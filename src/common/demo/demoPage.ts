/**
 * Demo page keys the tracker accepts: the first path segment after /church/<slug>/
 * (e.g. "insights", "members"). Anything else is dropped, so the stored page map stays
 * small and the key is safe to use in a JSON path.
 */
export const DEMO_PAGE_KEY = /^[a-z][a-z-]{0,39}$/;

export function demoPageKey(page: unknown): string | null {
  if (typeof page !== 'string') return null;
  const key = page.trim().toLowerCase();
  return DEMO_PAGE_KEY.test(key) ? key : null;
}

/** How long a demo visitor is kept after they were last seen */
export const DEMO_VISITOR_RETENTION_DAYS = 365;
