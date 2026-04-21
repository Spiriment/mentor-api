import { Between } from 'typeorm';
import { AppDataSource } from '@/config/data-source';
import { User } from '@/database/entities/user.entity';
import { Session, SESSION_STATUS } from '@/database/entities/session.entity';
import { UserSubscription } from '@/database/entities/userSubscription.entity';
import { MentorProfile } from '@/database/entities/mentorProfile.entity';
import { USER_ROLE, MENTOR_APPROVAL_STATUS } from '@/common';

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function row(fields: unknown[]): string {
  return fields.map(escapeCsv).join(',');
}

export class AdminExportService {
  async buildMonthlyReport(year: number, month: number, timezone: string): Promise<Buffer> {
    // Compute UTC window for the requested month in the given timezone.
    // We use a simple offset approach: build local midnight boundaries and let
    // the DB/JS Date handle the UTC conversion.
    const tzOffset = this.resolveOffsetMinutes(timezone);
    const startLocal = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const endLocal = new Date(year, month, 1, 0, 0, 0, 0); // exclusive

    const startUtc = new Date(startLocal.getTime() - tzOffset * 60 * 1000);
    const endUtc = new Date(endLocal.getTime() - tzOffset * 60 * 1000);

    const userRepo = AppDataSource.getRepository(User);
    const sessionRepo = AppDataSource.getRepository(Session);
    const subRepo = AppDataSource.getRepository(UserSubscription);
    const mpRepo = AppDataSource.getRepository(MentorProfile);

    const [newUsers, completedSessions, activeSubs, newMentorApps] = await Promise.all([
      userRepo.find({
        where: { createdAt: Between(startUtc, endUtc) },
        select: ['id', 'email', 'firstName', 'lastName', 'role', 'country', 'createdAt'],
      }),
      sessionRepo.find({
        where: {
          status: SESSION_STATUS.COMPLETED,
          scheduledAt: Between(startUtc, endUtc),
        },
        select: ['id', 'mentorId', 'menteeId', 'scheduledAt', 'duration'],
      }),
      subRepo.find({
        where: { status: 'active' },
        select: ['id', 'tier', 'mrrCents', 'currency'],
        relations: ['user'],
      }),
      mpRepo
        .createQueryBuilder('mp')
        .innerJoin('mp.user', 'u')
        .where('mp.createdAt >= :start AND mp.createdAt < :end', {
          start: startUtc,
          end: endUtc,
        })
        .select(['mp.id', 'mp.userId', 'u.mentorApprovalStatus'])
        .getMany(),
    ]);

    const lines: string[] = [];

    // ── Section 1: Report header ──────────────────────────────────────────
    lines.push(`Spiriment Monthly Report — ${year}-${String(month).padStart(2, '0')}`);
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push(`Timezone: ${timezone}`);
    lines.push('');

    // ── Section 2: Summary ────────────────────────────────────────────────
    lines.push('SUMMARY');
    lines.push(row(['Metric', 'Value']));
    lines.push(row(['New users (month)', newUsers.length]));
    lines.push(row(['New mentees', newUsers.filter((u) => u.role === USER_ROLE.MENTEE).length]));
    lines.push(row(['New mentors', newUsers.filter((u) => u.role === USER_ROLE.MENTOR).length]));
    lines.push(row(['Completed sessions', completedSessions.length]));
    lines.push(row(['Active subscriptions (snapshot)', activeSubs.length]));
    lines.push(row(['Active basic', activeSubs.filter((s) => s.tier === 'basic').length]));
    lines.push(row(['Active pro', activeSubs.filter((s) => s.tier === 'pro').length]));
    lines.push(row(['Active premium', activeSubs.filter((s) => s.tier === 'premium').length]));
    const totalMrr = activeSubs.reduce((sum, s) => sum + (s.mrrCents ?? 0), 0);
    lines.push(row(['Total MRR (cents)', totalMrr]));
    lines.push(row(['New mentor applications', newMentorApps.length]));
    lines.push('');

    // ── Section 3: New users ──────────────────────────────────────────────
    lines.push('NEW USERS');
    lines.push(row(['id', 'email', 'firstName', 'lastName', 'role', 'country', 'joinedAt']));
    for (const u of newUsers) {
      lines.push(row([u.id, u.email, u.firstName, u.lastName, u.role, u.country, u.createdAt?.toISOString()]));
    }
    lines.push('');

    // ── Section 4: Completed sessions ────────────────────────────────────
    lines.push('COMPLETED SESSIONS');
    lines.push(row(['id', 'mentorId', 'menteeId', 'scheduledAt', 'durationMinutes']));
    for (const s of completedSessions) {
      lines.push(row([s.id, s.mentorId, s.menteeId, s.scheduledAt?.toISOString(), s.duration]));
    }
    lines.push('');

    // ── Section 5: Active subscriptions ──────────────────────────────────
    lines.push('ACTIVE SUBSCRIPTIONS');
    lines.push(row(['id', 'userId', 'tier', 'mrrCents', 'currency']));
    for (const sub of activeSubs) {
      lines.push(row([sub.id, sub.user?.id, sub.tier, sub.mrrCents, sub.currency]));
    }

    return Buffer.from(lines.join('\r\n'), 'utf-8');
  }

  // Resolve a named timezone to its current UTC offset in minutes.
  // Falls back to 0 (UTC) on unknown zones.
  private resolveOffsetMinutes(timezone: string): number {
    try {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        timeZoneName: 'shortOffset',
      });
      const parts = formatter.formatToParts(now);
      const offsetPart = parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
      // offsetPart looks like "GMT+5:30" or "GMT-8"
      const match = offsetPart.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
      if (!match) return 0;
      const sign = match[1] === '+' ? 1 : -1;
      const hours = parseInt(match[2], 10);
      const minutes = parseInt(match[3] ?? '0', 10);
      return sign * (hours * 60 + minutes);
    } catch {
      return 0;
    }
  }
}

export const adminExportService = new AdminExportService();
