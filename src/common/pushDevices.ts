/** Expo push token shape (ExponentPushToken[…] or ExpoPushToken[…]) */
const EXPO_TOKEN = /^Expo(nent)?PushToken\[.+\]$/;

/**
 * The tokens one push goes to: every device on the account, plus the token the caller passed
 * (older code passes users.pushToken), without duplicates, invalid tokens or excluded ones
 * (e.g. devices already ringing through the live connection).
 */
export function deviceTokensToSend(
  passed: string | null | undefined,
  stored: Array<string | null | undefined>,
  exclude: Array<string | null | undefined> = [],
): string[] {
  const skip = new Set(exclude.filter(Boolean));
  const out: string[] = [];
  for (const t of [passed, ...stored]) {
    if (!t || !EXPO_TOKEN.test(t) || skip.has(t) || out.includes(t)) continue;
    out.push(t);
  }
  return out;
}

/** Tokens whose ticket says the app is gone from that device (uninstalled, token rotated) */
export function deadTokensFromTickets(
  tokens: string[],
  tickets: Array<{ status: string; details?: { error?: string } } | undefined>,
): string[] {
  return tokens.filter((_, i) => {
    const t = tickets[i];
    return t?.status === 'error' && t.details?.error === 'DeviceNotRegistered';
  });
}
