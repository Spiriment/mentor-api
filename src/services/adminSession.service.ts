import { AppDataSource } from '@/config/data-source';
import { Session, SESSION_STATUS } from '@/database/entities/session.entity';
import { User } from '@/database/entities/user.entity';
import { AppError, Logger } from '@/common';
import { Brackets } from 'typeorm';

const DEFAULT_PAGE = 1;
const MAX_LIMIT = 100;

export type SessionOutcomeStats = {
  total: number;
  completed: number;
  noShow: number;
  cancelled: number;
  scheduled: number;
  rescheduled: number;
  inProgress: number;
  /** completed / (completed + no_show); null if no decided outcomes */
  completionRatePct: number | null;
  /** no_show / (completed + no_show); null if no decided outcomes */
  noShowRatePct: number | null;
  /** completed + no_show */
  decidedOutcomes: number;
};

function ratePct(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function emptyOutcomeStats(): SessionOutcomeStats {
  return {
    total: 0,
    completed: 0,
    noShow: 0,
    cancelled: 0,
    scheduled: 0,
    rescheduled: 0,
    inProgress: 0,
    completionRatePct: null,
    noShowRatePct: null,
    decidedOutcomes: 0,
  };
}

function buildOutcomeStats(counts: Record<string, number>): SessionOutcomeStats {
  const completed = counts[SESSION_STATUS.COMPLETED] ?? 0;
  const noShow = counts[SESSION_STATUS.NO_SHOW] ?? 0;
  const cancelled = counts[SESSION_STATUS.CANCELLED] ?? 0;
  const scheduled =
    (counts[SESSION_STATUS.SCHEDULED] ?? 0) +
    (counts[SESSION_STATUS.CONFIRMED] ?? 0);
  const rescheduled = counts[SESSION_STATUS.RESCHEDULED] ?? 0;
  const inProgress = counts[SESSION_STATUS.IN_PROGRESS] ?? 0;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const decidedOutcomes = completed + noShow;

  return {
    total,
    completed,
    noShow,
    cancelled,
    scheduled,
    rescheduled,
    inProgress,
    decidedOutcomes,
    completionRatePct: ratePct(completed, decidedOutcomes),
    noShowRatePct: ratePct(noShow, decidedOutcomes),
  };
}

export class AdminSessionService {
  private logger = new Logger({
    service: 'admin-session-service',
    level: process.env.LOG_LEVEL || 'info',
  });

  /**
   * Completion / no-show rates.
   * Rates use decided outcomes only (completed + no_show). Cancelled is separate.
   */
  async getOutcomeMetrics(params?: {
    mentorId?: string;
    menteeId?: string;
    since?: Date;
  }): Promise<{
    allTime: SessionOutcomeStats;
    last30Days: SessionOutcomeStats;
  }> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [allTime, last30Days] = await Promise.all([
      this.countOutcomes({
        mentorId: params?.mentorId,
        menteeId: params?.menteeId,
      }),
      this.countOutcomes({
        mentorId: params?.mentorId,
        menteeId: params?.menteeId,
        since: params?.since ?? thirtyDaysAgo,
      }),
    ]);
    return { allTime, last30Days };
  }

  private async countOutcomes(params?: {
    mentorId?: string;
    menteeId?: string;
    since?: Date;
  }): Promise<SessionOutcomeStats> {
    const qb = AppDataSource.getRepository(Session)
      .createQueryBuilder('s')
      .select('s.status', 'status')
      .addSelect('COUNT(*)', 'cnt');

    if (params?.mentorId) {
      qb.andWhere('s.mentorId = :mentorId', { mentorId: params.mentorId });
    }
    if (params?.menteeId) {
      qb.andWhere('s.menteeId = :menteeId', { menteeId: params.menteeId });
    }
    if (params?.since) {
      qb.andWhere('s.scheduledAt >= :since', { since: params.since });
    }

    const rows = await qb
      .groupBy('s.status')
      .getRawMany<{ status: string; cnt: string }>();
    if (!rows.length) return emptyOutcomeStats();

    const counts: Record<string, number> = {};
    for (const r of rows) {
      counts[r.status] = parseInt(r.cnt, 10);
    }
    return buildOutcomeStats(counts);
  }

  /** Highest no-show rates among mentors or mentees (min decided outcomes). */
  async getTopNoShowRates(params?: {
    role?: 'mentor' | 'mentee';
    limit?: number;
    minDecided?: number;
    since?: Date;
  }) {
    const role = params?.role ?? 'mentor';
    const limit = Math.min(20, Math.max(1, params?.limit ?? 5));
    const minDecided = Math.max(1, params?.minDecided ?? 3);
    const idCol = role === 'mentor' ? 's.mentorId' : 's.menteeId';

    const qb = AppDataSource.getRepository(Session)
      .createQueryBuilder('s')
      .select(idCol, 'userId')
      .addSelect(
        `SUM(CASE WHEN s.status = :completed THEN 1 ELSE 0 END)`,
        'completed',
      )
      .addSelect(
        `SUM(CASE WHEN s.status = :noShow THEN 1 ELSE 0 END)`,
        'noShow',
      )
      .where('s.status IN (:...statuses)', {
        statuses: [SESSION_STATUS.COMPLETED, SESSION_STATUS.NO_SHOW],
      })
      .setParameters({
        completed: SESSION_STATUS.COMPLETED,
        noShow: SESSION_STATUS.NO_SHOW,
      })
      .groupBy(idCol)
      .having('COUNT(*) >= :minDecided', { minDecided })
      .orderBy('(SUM(CASE WHEN s.status = :noShow THEN 1 ELSE 0 END) / COUNT(*))', 'DESC')
      .addOrderBy('noShow', 'DESC')
      .limit(limit);

    if (params?.since) {
      qb.andWhere('s.scheduledAt >= :since', { since: params.since });
    }

    const rows = await qb.getRawMany<{
      userId: string;
      completed: string;
      noShow: string;
    }>();

    if (!rows.length) return [];

    const userIds = rows.map((r) => r.userId);
    const users = await AppDataSource.getRepository(User)
      .createQueryBuilder('u')
      .where('u.id IN (:...userIds)', { userIds })
      .getMany();
    const byId = new Map(users.map((u) => [u.id, u]));

    return rows.map((r) => {
      const completed = parseInt(r.completed, 10);
      const noShow = parseInt(r.noShow, 10);
      const decided = completed + noShow;
      const user = byId.get(r.userId);
      return {
        userId: r.userId,
        email: user?.email ?? null,
        firstName: user?.firstName ?? null,
        lastName: user?.lastName ?? null,
        role,
        completed,
        noShow,
        decidedOutcomes: decided,
        completionRatePct: ratePct(completed, decided),
        noShowRatePct: ratePct(noShow, decided),
      };
    });
  }

  async listSessions(params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    type?: string;
    mentorId?: string;
    menteeId?: string;
  }) {
    const page = Math.max(1, params.page ?? DEFAULT_PAGE);
    const limit = Math.min(MAX_LIMIT, Math.max(1, params.limit ?? 20));
    const skip = (page - 1) * limit;

    const qb = AppDataSource.getRepository(Session)
      .createQueryBuilder('s')
      .leftJoin('s.mentor', 'mentor')
      .leftJoin('s.mentee', 'mentee')
      .addSelect([
        'mentor.id',
        'mentor.firstName',
        'mentor.lastName',
        'mentor.email',
      ])
      .addSelect([
        'mentee.id',
        'mentee.firstName',
        'mentee.lastName',
        'mentee.email',
      ])
      .orderBy('s.scheduledAt', 'DESC');

    if (params.status && params.status !== 'all') {
      qb.andWhere('s.status = :status', { status: params.status });
    }

    if (params.type && params.type !== 'all') {
      qb.andWhere('s.type = :type', { type: params.type });
    }

    if (params.mentorId) {
      qb.andWhere('s.mentorId = :mentorId', { mentorId: params.mentorId });
    }

    if (params.menteeId) {
      qb.andWhere('s.menteeId = :menteeId', { menteeId: params.menteeId });
    }

    if (params.search) {
      const search = `%${params.search.toLowerCase()}%`;
      qb.andWhere(
        new Brackets((q) => {
          q.where('LOWER(mentor.firstName) LIKE :s', { s: search })
            .orWhere('LOWER(mentor.lastName) LIKE :s', { s: search })
            .orWhere('LOWER(mentor.email) LIKE :s', { s: search })
            .orWhere('LOWER(mentee.firstName) LIKE :s', { s: search })
            .orWhere('LOWER(mentee.lastName) LIKE :s', { s: search })
            .orWhere('LOWER(mentee.email) LIKE :s', { s: search })
            .orWhere('LOWER(s.title) LIKE :s', { s: search });
        }),
      );
    }

    const [sessions, total] = await qb.skip(skip).take(limit).getManyAndCount();

    return {
      data: sessions.map((s) => this.formatSession(s)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getSessionById(sessionId: string) {
    const session = await AppDataSource.getRepository(Session)
      .createQueryBuilder('s')
      .leftJoin('s.mentor', 'mentor')
      .leftJoin('s.mentee', 'mentee')
      .addSelect([
        'mentor.id',
        'mentor.firstName',
        'mentor.lastName',
        'mentor.email',
        'mentor.profileImage',
      ])
      .addSelect([
        'mentee.id',
        'mentee.firstName',
        'mentee.lastName',
        'mentee.email',
        'mentee.profileImage',
      ])
      .where('s.id = :id', { id: sessionId })
      .getOne();

    if (!session) throw new AppError('Session not found', 404);
    return this.formatSession(session, true);
  }

  async updateSessionStatus(sessionId: string, status: SESSION_STATUS) {
    const repo = AppDataSource.getRepository(Session);
    const session = await repo.findOne({ where: { id: sessionId } });
    if (!session) throw new AppError('Session not found', 404);

    session.status = status;
    if (status === SESSION_STATUS.CANCELLED) session.cancelledAt = new Date();
    await repo.save(session);
    return { success: true, status };
  }

  private formatSession(s: Session, detail = false) {
    const mentor = (s as any).mentor as User | undefined;
    const mentee = (s as any).mentee as User | undefined;

    const base = {
      id: s.id,
      status: s.status,
      type: s.type,
      duration: s.duration,
      scheduledAt: s.scheduledAt,
      startedAt: s.startedAt ?? null,
      endedAt: s.endedAt ?? null,
      createdAt: s.createdAt,
      mentor: mentor
        ? {
            id: mentor.id,
            firstName: mentor.firstName,
            lastName: mentor.lastName,
            email: mentor.email,
          }
        : null,
      mentee: mentee
        ? {
            id: mentee.id,
            firstName: mentee.firstName,
            lastName: mentee.lastName,
            email: mentee.email,
          }
        : null,
    };

    if (!detail) return base;

    return {
      ...base,
      title: s.title ?? null,
      description: s.description ?? null,
      meetingLink: s.meetingLink ?? null,
      location: s.location ?? null,
      mentorNotes: s.mentorNotes ?? null,
      menteeNotes: s.menteeNotes ?? null,
      sessionSummary: s.sessionSummary ?? null,
      assignments: s.assignments ?? [],
      feedback: s.feedback ?? null,
      cancellationReason: s.cancellationReason ?? null,
    };
  }
}

export const adminSessionService = new AdminSessionService();
