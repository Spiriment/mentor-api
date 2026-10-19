/**
 * Summarize Stream call stats into an admin-readable "call health" view.
 *
 * Built after Android video silently failed for months: Stream recorded every Android
 * session with published video = false, but nothing surfaced it until users complained.
 * IPs and locations from Stream are deliberately not carried through.
 */

export interface RawParticipantSession {
  started_at?: string | Date;
  ended_at?: string | Date;
  os?: string;
  sdk?: string;
  sdk_version?: string;
  published_tracks?: { video?: boolean; audio?: boolean };
  cq_score?: number;
  latency_ms?: number;
}

export interface RawParticipant {
  user_id: string;
  name?: string;
  sessions?: RawParticipantSession[];
}

export interface CallSessionInput {
  sessionId: string;
  startedAt?: string | Date;
  endedAt?: string | Date;
  durationSeconds?: number;
  qualityScore?: number;
  participants: RawParticipant[];
}

export interface ParticipantHealth {
  userId: string;
  name: string;
  /** mentor / mentee when the user is one of the session's two parties */
  role: 'mentor' | 'mentee' | 'other';
  joins: number;
  platforms: string[];
  appSdk: string | null;
  sentVideo: boolean;
  sentAudio: boolean;
  /** Worst connection-quality score across joins (0–100, Stream's cq_score) */
  worstQuality: number | null;
  avgLatencyMs: number | null;
  firstJoinedAt: string | null;
  lastLeftAt: string | null;
}

export interface CallSessionHealth {
  sessionId: string;
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  qualityScore: number | null;
  participants: ParticipantHealth[];
  warnings: string[];
}

const POOR_QUALITY = 40;
const MANY_REJOINS = 3;

const iso = (d?: string | Date): string | null => {
  if (!d) return null;
  const date = d instanceof Date ? d : new Date(d);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const label = (p: ParticipantHealth) =>
  p.role === 'other' ? p.name || p.userId.slice(0, 8) : `${p.role === 'mentor' ? 'Mentor' : 'Mentee'} (${p.name || p.userId.slice(0, 8)})`;

export function summarizeCallSession(
  input: CallSessionInput,
  roles: { mentorId?: string; menteeId?: string },
): CallSessionHealth {
  const participants: ParticipantHealth[] = input.participants.map((p) => {
    const sessions = p.sessions ?? [];
    const cqs = sessions.map((s) => s.cq_score).filter((n): n is number => typeof n === 'number');
    const lat = sessions.map((s) => s.latency_ms).filter((n): n is number => typeof n === 'number');
    const starts = sessions.map((s) => iso(s.started_at)).filter((d): d is string => !!d).sort();
    const ends = sessions.map((s) => iso(s.ended_at)).filter((d): d is string => !!d).sort();
    const sdk = sessions.find((s) => s.sdk);
    return {
      userId: p.user_id,
      name: p.name ?? '',
      role: p.user_id === roles.mentorId ? 'mentor' : p.user_id === roles.menteeId ? 'mentee' : 'other',
      joins: sessions.length,
      platforms: Array.from(new Set(sessions.map((s) => s.os).filter((o): o is string => !!o))),
      appSdk: sdk ? `${sdk.sdk}${sdk.sdk_version ? ` ${sdk.sdk_version}` : ''}` : null,
      sentVideo: sessions.some((s) => s.published_tracks?.video === true),
      sentAudio: sessions.some((s) => s.published_tracks?.audio === true),
      worstQuality: cqs.length ? Math.min(...cqs) : null,
      avgLatencyMs: lat.length ? Math.round(lat.reduce((a, b) => a + b, 0) / lat.length) : null,
      firstJoinedAt: starts[0] ?? null,
      lastLeftAt: ends[ends.length - 1] ?? null,
    };
  });

  const warnings: string[] = [];
  for (const p of participants) {
    const on = p.platforms.length ? ` on ${p.platforms.join('/')}` : '';
    if (!p.sentVideo) warnings.push(`${label(p)}'s video never reached the call${on}.`);
    if (!p.sentAudio) warnings.push(`${label(p)}'s audio never reached the call${on}.`);
    if (p.joins >= MANY_REJOINS) warnings.push(`${label(p)} joined ${p.joins} times — likely dropped connections.`);
    if (p.worstQuality !== null && p.worstQuality < POOR_QUALITY) {
      warnings.push(`${label(p)} had a poor connection (quality ${p.worstQuality}/100).`);
    }
  }
  for (const [role, id] of [['Mentor', roles.mentorId], ['Mentee', roles.menteeId]] as const) {
    if (id && !participants.some((p) => p.userId === id)) warnings.push(`${role} never joined this call.`);
  }

  return {
    sessionId: input.sessionId,
    startedAt: iso(input.startedAt),
    endedAt: iso(input.endedAt),
    durationSeconds: typeof input.durationSeconds === 'number' ? input.durationSeconds : null,
    qualityScore: typeof input.qualityScore === 'number' ? input.qualityScore : null,
    participants,
    warnings,
  };
}
