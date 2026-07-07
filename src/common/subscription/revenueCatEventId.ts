/** Build a stable idempotency key for RevenueCat webhook events missing `event.id`. */
export function resolveRevenueCatEventId(event: Record<string, unknown>): string {
  if (event.id) return String(event.id);

  const type = String(event.type ?? 'unknown');
  const userId = String(event.app_user_id ?? '');
  const productId = String(event.product_id ?? '');
  const txId = String(event.transaction_id ?? event.original_transaction_id ?? '');
  const expires = String(event.expiration_at_ms ?? '');
  const eventAt = String(
    event.event_timestamp_ms ??
      event.purchased_at_ms ??
      event.renewal_number ??
      '',
  );

  return `rc-synthetic:${type}:${userId}:${productId}:${txId}:${expires}:${eventAt}`;
}
