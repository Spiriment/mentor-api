import { SESSION_STATUS } from '@/database/entities/session.entity';

/**
 * What a participant may change on a session through the general update endpoints
 * (PUT /sessions/:id, PATCH /sessions/:id/status, the notes endpoints).
 *
 * These used to copy the request body straight onto the session, so either side could set
 * any status (a mentee could "confirm" their own request or mark a future session
 * completed), move the time without the other's agreement, or overwrite the other's notes;
 * and every rejoin reset startedAt, so recorded call lengths were wrong. Accept / decline /
 * reschedule / cancel have their own endpoints with their own checks and notifications.
 */

/** Same as the app's Join button (src/utils/sessionJoin.ts SESSION_JOIN_EARLY_MS) */
export const JOIN_EARLY_MINUTES = 10;
/** Matches the missed-session job, which marks a session no-show after duration + 30 min */
export const JOIN_LATE_GRACE_MINUTES = 30;

const MENTOR_FIELDS = ['mentorNotes', 'sessionSummary', 'assignments', 'sessionNotes'] as const;
const MENTEE_FIELDS = ['menteeNotes'] as const;
const SHARED_FIELDS = ['title', 'description', 'location', 'meetingLink', 'meetingId', 'meetingPassword'] as const;
/** Set by the server when the status changes; values from the client are ignored */
const SERVER_TIMESTAMPS = ['startedAt', 'endedAt'] as const;

export interface SessionSnapshot {
  status: SESSION_STATUS;
  scheduledAt: Date;
  duration: number;
  startedAt?: Date | null;
  endedAt?: Date | null;
  mentorJoinedAt?: Date | null;
  menteeJoinedAt?: Date | null;
  mentorId: string;
  menteeId: string;
}

export class SessionUpdateError extends Error {
  constructor(message: string, readonly statusCode: 400 | 403) {
    super(message);
  }
}

export function planSessionUpdate(
  session: SessionSnapshot,
  actorId: string,
  data: Record<string, unknown>,
  now: Date = new Date(),
): Record<string, unknown> {
  const isMentor = actorId === session.mentorId;
  const isMentee = actorId === session.menteeId;
  if (!isMentor && !isMentee) {
    throw new SessionUpdateError('You do not have permission to update this session', 403);
  }

  const updates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || key === 'status') continue;
    if ((SERVER_TIMESTAMPS as readonly string[]).includes(key)) continue;
    if ((SHARED_FIELDS as readonly string[]).includes(key)) {
      updates[key] = value;
    } else if ((MENTOR_FIELDS as readonly string[]).includes(key)) {
      if (!isMentor) throw new SessionUpdateError('Only the mentor can edit the session notes', 403);
      updates[key] = value;
    } else if ((MENTEE_FIELDS as readonly string[]).includes(key)) {
      if (!isMentee) throw new SessionUpdateError('Only the mentee can edit their own notes', 403);
      updates[key] = value;
    } else if (key === 'scheduledAt' || key === 'duration') {
      throw new SessionUpdateError('Use reschedule to change the session time', 400);
    } else {
      throw new SessionUpdateError(`"${key}" can't be changed here`, 400);
    }
  }

  // Each join is reported as status in_progress (by every app version): remember who came
  const recordJoin = () => {
    if (isMentor && !session.mentorJoinedAt) updates.mentorJoinedAt = now;
    if (isMentee && !session.menteeJoinedAt) updates.menteeJoinedAt = now;
  };

  const target = data.status as SESSION_STATUS | undefined;
  if (target === undefined || target === session.status) {
    if (target === SESSION_STATUS.IN_PROGRESS) {
      if (!session.startedAt) updates.startedAt = now;
      recordJoin();
    }
    return updates;
  }

  if (target === SESSION_STATUS.IN_PROGRESS) {
    const pendingButMentor = session.status === SESSION_STATUS.SCHEDULED && isMentor;
    if (session.status !== SESSION_STATUS.CONFIRMED && !pendingButMentor) {
      throw new SessionUpdateError(
        session.status === SESSION_STATUS.SCHEDULED
          ? 'This session has not been accepted by the mentor yet'
          : `A ${session.status.replace('_', ' ')} session can't be started`,
        400,
      );
    }
    const start = session.scheduledAt.getTime();
    const opens = start - JOIN_EARLY_MINUTES * 60000;
    const closes = start + (session.duration + JOIN_LATE_GRACE_MINUTES) * 60000;
    if (now.getTime() < opens) {
      const minutes = Math.ceil((opens - now.getTime()) / 60000);
      throw new SessionUpdateError(
        `Session cannot be joined yet. You can join in ${minutes} minute(s).`,
        400,
      );
    }
    if (now.getTime() > closes) {
      throw new SessionUpdateError('This session has already ended', 400);
    }
    updates.status = SESSION_STATUS.IN_PROGRESS;
    // First join wins; rejoining used to reset it and shorten the recorded call
    if (!session.startedAt) updates.startedAt = now;
    recordJoin();
    return updates;
  }

  if (target === SESSION_STATUS.COMPLETED) {
    if (session.status !== SESSION_STATUS.IN_PROGRESS) {
      throw new SessionUpdateError('Only a session that is in progress can be completed', 400);
    }
    updates.status = SESSION_STATUS.COMPLETED;
    updates.endedAt = now;
    return updates;
  }

  throw new SessionUpdateError(
    'Use accept, decline, reschedule or cancel to change this session',
    400,
  );
}
