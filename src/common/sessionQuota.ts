/**
 * Monthly session allowance helpers. The allowance counts sessions per calendar month in
 * server time (see SubscriptionService.countSessionsThisMonth).
 */
export function sameQuotaMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}
