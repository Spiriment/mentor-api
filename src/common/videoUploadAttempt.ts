/**
 * Validation for mentor intro-video upload attempts reported by the app. The app reports
 * every attempt (success, failure, rejection) so admins can see failures as they happen.
 */
export const UPLOAD_OUTCOMES = ['success', 'failed', 'rejected'] as const;
export const UPLOAD_STAGES = ['validation', 'compression', 'upload', 'save'] as const;

export interface VideoUploadAttemptInput {
  outcome: (typeof UPLOAD_OUTCOMES)[number];
  stage: (typeof UPLOAD_STAGES)[number];
  errorMessage: string | null;
  originalSizeBytes: number | null;
  uploadSizeBytes: number | null;
  durationSeconds: number | null;
  compressionFailed: boolean;
  platform: 'ios' | 'android' | null;
  appVersion: string | null;
}

const MAX_BYTES = 20 * 1024 * 1024 * 1024; // sanity cap: 20 GB
const sizeOrNull = (v: unknown) =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= MAX_BYTES ? Math.round(v) : null;

/** Returns null when the payload isn't a usable attempt report. */
export function sanitizeVideoUploadAttempt(body: Record<string, unknown>): VideoUploadAttemptInput | null {
  const outcome = UPLOAD_OUTCOMES.find((o) => o === body.outcome);
  const stage = UPLOAD_STAGES.find((s) => s === body.stage);
  if (!outcome || !stage) return null;
  const duration = body.durationSeconds;
  return {
    outcome,
    stage,
    errorMessage:
      typeof body.errorMessage === 'string' && body.errorMessage.trim()
        ? body.errorMessage.trim().slice(0, 500)
        : null,
    originalSizeBytes: sizeOrNull(body.originalSizeBytes),
    uploadSizeBytes: sizeOrNull(body.uploadSizeBytes),
    durationSeconds:
      typeof duration === 'number' && Number.isFinite(duration) && duration >= 0 && duration < 24 * 3600
        ? Math.round(duration)
        : null,
    compressionFailed: body.compressionFailed === true,
    platform: body.platform === 'ios' || body.platform === 'android' ? body.platform : null,
    appVersion:
      typeof body.appVersion === 'string' && /^\d+(\.\d+){0,3}$/.test(body.appVersion.trim())
        ? body.appVersion.trim()
        : null,
  };
}
