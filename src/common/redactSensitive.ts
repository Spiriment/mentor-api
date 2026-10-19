/**
 * Mask secrets before request data reaches log files. The error handler used to log raw
 * request bodies — passwords from failed logins, OTPs, reset and Google/Apple sign-in
 * tokens all ended up in logs/*-error.log in plain text.
 */
const SENSITIVE_KEY = /pass(word)?|secret|token|otp|^code$|authorization|api[-_]?key|^auth$|p256dh|cvv|card/i;
const MAX_DEPTH = 6;

export function redactSensitive(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return '[truncated]';
  if (Array.isArray(value)) return value.map((v) => redactSensitive(v, depth + 1));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY.test(key) ? '[redacted]' : redactSensitive(v, depth + 1);
    }
    return out;
  }
  return value;
}
