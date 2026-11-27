/**
 * Report & block rules (App Store guideline 1.2: apps where people message each other need
 * a way to report someone and to block them). Pure helpers; SafetyService does the I/O.
 */

export const REPORT_REASONS = {
  inappropriate: 'Inappropriate or sexual content',
  harassment: 'Harassment or bullying',
  spam: 'Spam or scam',
  safety: "Concern about someone's safety",
  impersonation: 'Pretending to be someone else',
  other: 'Other',
} as const;

export type ReportReason = keyof typeof REPORT_REASONS;

export const isReportReason = (value: unknown): value is ReportReason =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(REPORT_REASONS, value);

export const REPORT_SOURCES = ['chat', 'message', 'profile', 'session'] as const;
export type ReportSource = (typeof REPORT_SOURCES)[number];

/** One person can send this many reports a day; enough for real use, not for flooding admins */
export const MAX_REPORTS_PER_DAY = 10;

/** Messages kept on each side of a reported message, so admins see what happened */
export const REPORT_CONTEXT_MESSAGES = 10;

export const MAX_REPORT_DETAILS = 2000;

/**
 * What happens to the sessions two people still have booked when one blocks the other.
 * They aren't cancelled automatically: an admin looks first and cancels or keeps them.
 *  none       no upcoming sessions between them
 *  pending    waiting for an admin; meanwhile neither can join those calls
 *  cancelled  an admin cancelled them
 *  kept       an admin kept them (for example a block made by mistake)
 *  withdrawn  the person unblocked before an admin looked
 */
export type BlockSessionsReview = 'none' | 'pending' | 'cancelled' | 'kept' | 'withdrawn';

export const sessionsReviewFor = (upcomingSessionCount: number): BlockSessionsReview =>
  upcomingSessionCount > 0 ? 'pending' : 'none';

/** Unblocking closes a review nobody acted on; a decision already made stays on record */
export const sessionsReviewAfterUnblock = (current: BlockSessionsReview): BlockSessionsReview =>
  current === 'pending' ? 'withdrawn' : current;

export function cleanReportDetails(details: unknown): string | null {
  if (typeof details !== 'string') return null;
  const trimmed = details.trim().slice(0, MAX_REPORT_DETAILS);
  return trimmed || null;
}

export type ContextMessage = {
  id: string;
  senderId: string;
  content: string;
  type: string;
  sentAt: string;
};

/**
 * The reported message with up to REPORT_CONTEXT_MESSAGES on each side, oldest first.
 * `before` comes newest-first from the query (closest to the reported message first).
 */
export function buildReportContext(
  before: ContextMessage[],
  reported: ContextMessage,
  after: ContextMessage[],
): { messages: ContextMessage[]; reportedMessageId: string } {
  return {
    messages: [
      ...before.slice(0, REPORT_CONTEXT_MESSAGES).reverse(),
      reported,
      ...after.slice(0, REPORT_CONTEXT_MESSAGES),
    ],
    reportedMessageId: reported.id,
  };
}
