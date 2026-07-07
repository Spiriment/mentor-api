import { Between, In } from 'typeorm';
import { fromZonedTime } from 'date-fns-tz';
import { AppDataSource } from '@/config/data-source';
import { User } from '@/database/entities/user.entity';
import { Session, SESSION_STATUS } from '@/database/entities/session.entity';
import { UserSubscription } from '@/database/entities/userSubscription.entity';
import { MentorProfile } from '@/database/entities/mentorProfile.entity';
import { MenteeProfile } from '@/database/entities/menteeProfile.entity';
import { MentorshipRequest, MENTORSHIP_REQUEST_STATUS } from '@/database/entities/mentorshipRequest.entity';
import { SessionReview } from '@/database/entities/sessionReview.entity';
import { BibleProgress } from '@/database/entities/bibleProgress.entity';
import { OrgPlan } from '@/database/entities/orgPlan.entity';
import { FamilyPlan } from '@/database/entities/familyPlan.entity';
import { FamilyMember } from '@/database/entities/familyMember.entity';
import { USER_ROLE, NotFoundError } from '@/common';
import { ADMIN_ROLE } from '@/common/constants/adminRoles';
import { MRR_STATUSES, PAYING_TIERS } from '@/common/constants/subscriptionMetrics';
import { adminDashboardService } from './adminDashboard.service';

export type AdminExportReportType =
  | 'mentors'
  | 'mentees'
  | 'users'
  | 'activity'
  | 'subscriptions'
  | 'sessions';

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

function toBuffer(lines: string[]): Buffer {
  return Buffer.from(lines.join('\r\n'), 'utf-8');
}

function fullName(user?: Pick<User, 'firstName' | 'lastName' | 'email'> | null): string {
  if (!user) return '';
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ');
  return name || user.email || '';
}

function iso(value?: Date | null): string {
  return value ? value.toISOString() : '';
}

export class AdminExportService {
  async buildReport(
    reportType: AdminExportReportType,
    adminRole: ADMIN_ROLE
  ): Promise<{ buffer: Buffer; filename: string }> {
    switch (reportType) {
      case 'mentors':
        return { buffer: await this.buildMentorsReport(), filename: 'mentors-report.csv' };
      case 'mentees':
        return { buffer: await this.buildMenteesReport(), filename: 'mentees-report.csv' };
      case 'users':
        return { buffer: await this.buildUsersReport(), filename: 'users-report.csv' };
      case 'activity':
        return {
          buffer: await this.buildActivityReport(adminRole),
          filename: 'activity-report.csv',
        };
      case 'subscriptions':
        return {
          buffer: await this.buildSubscriptionsReport(adminRole),
          filename: 'subscriptions-report.csv',
        };
      case 'sessions':
        return { buffer: await this.buildSessionsReport(), filename: 'sessions-report.csv' };
      default:
        throw new NotFoundError('Unknown export report type');
    }
  }

  async buildMentorsReport(): Promise<Buffer> {
    const mpRepo = AppDataSource.getRepository(MentorProfile);
    const sessionRepo = AppDataSource.getRepository(Session);
    const reviewRepo = AppDataSource.getRepository(SessionReview);

    const mentors = await mpRepo.find({
      where: { isApproved: true, isOnboardingComplete: true },
      relations: ['user'],
      order: { approvedAt: 'DESC' },
    });

    const sessionCounts = await sessionRepo
      .createQueryBuilder('s')
      .select('s.mentorId', 'mentorId')
      .addSelect('COUNT(*)', 'cnt')
      .where('s.status = :st', { st: SESSION_STATUS.COMPLETED })
      .groupBy('s.mentorId')
      .getRawMany<{ mentorId: string; cnt: string }>();

    const ratingRows = await reviewRepo
      .createQueryBuilder('r')
      .select('r.mentorId', 'mentorId')
      .addSelect('AVG(r.rating)', 'avgRating')
      .addSelect('COUNT(*)', 'reviewCount')
      .groupBy('r.mentorId')
      .getRawMany<{ mentorId: string; avgRating: string; reviewCount: string }>();

    const sessionsByMentor = new Map(
      sessionCounts.map((r) => [r.mentorId, parseInt(r.cnt, 10)])
    );
    const ratingsByMentor = new Map(
      ratingRows.map((r) => [
        r.mentorId,
        {
          avg: r.avgRating ? Number(parseFloat(r.avgRating).toFixed(2)) : null,
          count: parseInt(r.reviewCount, 10),
        },
      ])
    );

    const lines: string[] = [
      'MENTORS REPORT',
      `Generated: ${new Date().toISOString()}`,
      '',
      row([
        'userId',
        'name',
        'email',
        'country',
        'church',
        'accountStatus',
        'expertise',
        'sessionsCompleted',
        'avgRating',
        'reviewCount',
        'approvedAt',
      ]),
    ];

    for (const mp of mentors) {
      const rating = ratingsByMentor.get(mp.userId);
      lines.push(
        row([
          mp.userId,
          fullName(mp.user),
          mp.user.email,
          mp.user.country,
          mp.churchAffiliation,
          mp.user.accountStatus,
          (mp.spiritualExpertise ?? []).join('; '),
          sessionsByMentor.get(mp.userId) ?? 0,
          rating?.avg ?? '',
          rating?.count ?? 0,
          iso(mp.approvedAt),
        ])
      );
    }

    return toBuffer(lines);
  }

  async buildMenteesReport(): Promise<Buffer> {
    const userRepo = AppDataSource.getRepository(User);
    const profileRepo = AppDataSource.getRepository(MenteeProfile);
    const requestRepo = AppDataSource.getRepository(MentorshipRequest);
    const sessionRepo = AppDataSource.getRepository(Session);
    const bibleRepo = AppDataSource.getRepository(BibleProgress);

    const mentees = await userRepo.find({
      where: { role: USER_ROLE.MENTEE },
      order: { createdAt: 'DESC' },
    });

    const profiles = await profileRepo.find();
    const profileByUser = new Map(profiles.map((p) => [p.userId, p]));

    const activeRequests = await requestRepo.find({
      where: { status: MENTORSHIP_REQUEST_STATUS.ACCEPTED },
      relations: ['mentor'],
    });
    const mentorByMentee = new Map(
      activeRequests.map((r) => [r.menteeId, r.mentor])
    );

    const sessionCounts = await sessionRepo
      .createQueryBuilder('s')
      .select('s.menteeId', 'menteeId')
      .addSelect('COUNT(*)', 'cnt')
      .groupBy('s.menteeId')
      .getRawMany<{ menteeId: string; cnt: string }>();
    const sessionsByMentee = new Map(
      sessionCounts.map((r) => [r.menteeId, parseInt(r.cnt, 10)])
    );

    const bibleRows = await bibleRepo.find();
    const bibleByUser = new Map(bibleRows.map((b) => [b.userId, b]));

    const lines: string[] = [
      'MENTEES REPORT',
      `Generated: ${new Date().toISOString()}`,
      '',
      row([
        'userId',
        'name',
        'email',
        'country',
        'accountStatus',
        'mentorName',
        'churchName',
        'denomination',
        'sessionsCount',
        'biblePlan',
        'bibleCurrentDay',
        'lastActiveAt',
        'joinedAt',
      ]),
    ];

    for (const u of mentees) {
      const profile = profileByUser.get(u.id);
      const mentor = mentorByMentee.get(u.id);
      const bible = bibleByUser.get(u.id);
      lines.push(
        row([
          u.id,
          fullName(u),
          u.email,
          u.country,
          u.accountStatus,
          fullName(mentor),
          profile?.churchName,
          profile?.churchDenomination,
          sessionsByMentee.get(u.id) ?? 0,
          bible?.plan,
          bible?.currentDay ?? '',
          iso(u.lastActiveAt),
          iso(u.createdAt),
        ])
      );
    }

    return toBuffer(lines);
  }

  async buildUsersReport(): Promise<Buffer> {
    const userRepo = AppDataSource.getRepository(User);
    const subRepo = AppDataSource.getRepository(UserSubscription);

    const [users, subscriptions] = await Promise.all([
      userRepo.find({ order: { createdAt: 'DESC' } }),
      subRepo.find({ relations: ['user'] }),
    ]);

    const subByUser = new Map<string, UserSubscription>();
    for (const sub of subscriptions) {
      const uid = sub.userId ?? sub.user?.id;
      if (uid) subByUser.set(uid, sub);
    }

    const lines: string[] = [
      'USERS REPORT',
      `Generated: ${new Date().toISOString()}`,
      '',
      row([
        'userId',
        'name',
        'email',
        'role',
        'country',
        'accountStatus',
        'isActive',
        'subscriptionTier',
        'subscriptionStatus',
        'lastActiveAt',
        'joinedAt',
      ]),
    ];

    for (const u of users) {
      const sub = subByUser.get(u.id);
      lines.push(
        row([
          u.id,
          fullName(u),
          u.email,
          u.role,
          u.country,
          u.accountStatus,
          u.isActive,
          sub?.tier ?? 'none',
          sub?.status ?? '',
          iso(u.lastActiveAt),
          iso(u.createdAt),
        ])
      );
    }

    return toBuffer(lines);
  }

  async buildActivityReport(adminRole: ADMIN_ROLE): Promise<Buffer> {
    const analytics = await adminDashboardService.getAnalytics(adminRole);
    const { kpis, dauData, mauData } = analytics;

    const lines: string[] = [
      'ACTIVITY REPORT',
      `Generated: ${new Date().toISOString()}`,
      '',
      'SUMMARY',
      row(['Metric', 'Value']),
      row(['Daily active users', kpis.dailyActiveUsers]),
      row(['Monthly active users', kpis.monthlyActiveUsers]),
      row(['Inactive users (30d+)', kpis.inactiveUsers30d]),
      row(['Never active', kpis.nonActiveUsers]),
      row(['Sessions this month', kpis.sessionsThisMonth]),
      '',
      'DAILY ACTIVE USERS (RECENT)',
      row(['Day', 'Users']),
      ...dauData.map((d) => row([d.day, d.users])),
      '',
      'MONTHLY ACTIVE USERS',
      row(['Month', 'Users']),
      ...mauData.map((m) => row([m.month, m.users])),
    ];

    return toBuffer(lines);
  }

  async buildSubscriptionsReport(adminRole: ADMIN_ROLE): Promise<Buffer> {
    const subRepo = AppDataSource.getRepository(UserSubscription);
    const orgRepo = AppDataSource.getRepository(OrgPlan);
    const familyPlanRepo = AppDataSource.getRepository(FamilyPlan);
    const familyMemberRepo = AppDataSource.getRepository(FamilyMember);

    const [subscriptions, churchPlans, familyPlans, familyMembers] = await Promise.all([
      subRepo.find({ relations: ['user'], order: { updatedAt: 'DESC' } }),
      orgRepo.find({ where: { planType: 'church' }, order: { createdAt: 'DESC' } }),
      familyPlanRepo.find({ relations: ['parent'], order: { createdAt: 'DESC' } }),
      familyMemberRepo.find({
        relations: ['user', 'familyPlan'],
        order: { createdAt: 'DESC' },
      }),
    ]);

    const lines: string[] = [
      'SUBSCRIPTIONS REPORT',
      `Generated: ${new Date().toISOString()}`,
      '',
      'INDIVIDUAL SUBSCRIPTIONS',
      row([
        'subscriptionId',
        'userId',
        'userEmail',
        'tier',
        'status',
        'mrrCents',
        'currency',
        'billingInterval',
        'pastDueAt',
        'expiresAt',
        'provider',
      ]),
    ];

    for (const sub of subscriptions) {
      const includeMrr = adminRole === ADMIN_ROLE.SUPER_ADMIN;
      lines.push(
        row([
          sub.id,
          sub.userId ?? sub.user?.id,
          sub.user?.email,
          sub.tier,
          sub.status,
          includeMrr ? (sub.mrrCents != null ? sub.mrrCents : '') : '',
          sub.currency,
          sub.billingInterval ?? '',
          iso(sub.pastDueAt),
          iso(sub.expiresAt),
          sub.externalProvider,
        ])
      );
    }

    lines.push('');
    lines.push('CHURCH PLANS');
    lines.push(
      row(['planId', 'name', 'status', 'totalSeats', 'usedSeats', 'createdAt'])
    );
    for (const plan of churchPlans) {
      lines.push(
        row([
          plan.id,
          plan.name,
          plan.status,
          plan.totalSeats,
          plan.usedSeats,
          iso(plan.createdAt),
        ])
      );
    }

    lines.push('');
    lines.push('FAMILY PLANS');
    lines.push(row(['planId', 'name', 'status', 'parentUserId', 'parentEmail', 'createdAt']));
    for (const plan of familyPlans) {
      lines.push(
        row([
          plan.id,
          plan.name,
          plan.status,
          plan.parentUserId,
          plan.parent?.email,
          iso(plan.createdAt),
        ])
      );
    }

    lines.push('');
    lines.push('FAMILY MEMBERS');
    lines.push(
      row([
        'memberId',
        'familyPlanId',
        'userId',
        'userEmail',
        'tier',
        'isParent',
        'ageDiscountPercent',
        'removedAt',
        'createdAt',
      ])
    );
    for (const member of familyMembers) {
      lines.push(
        row([
          member.id,
          member.familyPlanId,
          member.userId,
          member.user?.email,
          member.tier,
          member.isParent,
          member.ageDiscountPercent,
          iso(member.removedAt),
          iso(member.createdAt),
        ])
      );
    }

    return toBuffer(lines);
  }

  async buildSessionsReport(): Promise<Buffer> {
    const sessionRepo = AppDataSource.getRepository(Session);
    const reviewRepo = AppDataSource.getRepository(SessionReview);

    const sessions = await sessionRepo.find({
      relations: ['mentor', 'mentee'],
      order: { scheduledAt: 'DESC' },
    });

    const reviews = await reviewRepo.find({ select: ['sessionId', 'rating', 'reviewText'] });
    const reviewBySession = new Map(
      reviews.filter((r) => r.sessionId).map((r) => [r.sessionId!, r])
    );

    const lines: string[] = [
      'SESSIONS REPORT',
      `Generated: ${new Date().toISOString()}`,
      '',
      row([
        'sessionId',
        'status',
        'type',
        'scheduledAt',
        'durationMinutes',
        'mentorName',
        'mentorEmail',
        'menteeName',
        'menteeEmail',
        'rating',
        'reviewText',
        'sessionSummary',
      ]),
    ];

    for (const s of sessions) {
      const review = reviewBySession.get(s.id);
      lines.push(
        row([
          s.id,
          s.status,
          s.type,
          iso(s.scheduledAt),
          s.duration,
          fullName(s.mentor),
          s.mentor?.email,
          fullName(s.mentee),
          s.mentee?.email,
          review?.rating ?? '',
          review?.reviewText ?? '',
          s.sessionSummary ?? '',
        ])
      );
    }

    return toBuffer(lines);
  }
  async buildMonthlyReport(year: number, month: number, timezone: string): Promise<Buffer> {
    const { startUtc, endUtc } = this.getMonthBoundsUtc(year, month, timezone);

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
        where: {
          status: In(MRR_STATUSES),
          tier: In(PAYING_TIERS),
        },
        select: ['id', 'tier', 'mrrCents', 'currency', 'status'],
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
    lines.push(row(['Paying basic', activeSubs.filter((s) => s.tier === 'basic').length]));
    lines.push(row(['Paying pro', activeSubs.filter((s) => s.tier === 'pro').length]));
    lines.push(row(['Paying premium', activeSubs.filter((s) => s.tier === 'premium').length]));
    const totalMrr = activeSubs.reduce(
      (sum, s) => sum + (s.mrrCents != null ? s.mrrCents : 0),
      0,
    );
    const unknownMrrCount = activeSubs.filter((s) => s.mrrCents == null).length;
    lines.push(row(['Total MRR cents (active + past_due, known amounts only)', totalMrr]));
    if (unknownMrrCount > 0) {
      lines.push(row(['Paying subscribers with unknown MRR (excluded from total)', unknownMrrCount]));
    }
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

  private getMonthBoundsUtc(
    year: number,
    month: number,
    timezone: string,
  ): { startUtc: Date; endUtc: Date } {
    const pad = (n: number) => String(n).padStart(2, '0');
    const startLocal = `${year}-${pad(month)}-01T00:00:00`;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const endLocal = `${nextYear}-${pad(nextMonth)}-01T00:00:00`;
    try {
      return {
        startUtc: fromZonedTime(startLocal, timezone),
        endUtc: fromZonedTime(endLocal, timezone),
      };
    } catch {
      return {
        startUtc: new Date(Date.UTC(year, month - 1, 1)),
        endUtc: new Date(Date.UTC(nextYear, nextMonth - 1, 1)),
      };
    }
  }
}

export const adminExportService = new AdminExportService();
