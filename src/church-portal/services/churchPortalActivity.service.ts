import { In } from 'typeorm';
import { AppDataSource } from '@/config/data-source';
import { User } from '@/database/entities/user.entity';
import { Session, SESSION_STATUS } from '@/database/entities/session.entity';
import { MentorshipRequest, MENTORSHIP_REQUEST_STATUS } from '@/database/entities/mentorshipRequest.entity';
import { QuizAttempt } from '@/database/entities/quizAttempt.entity';
import { QuizStreak } from '@/database/entities/quizStreak.entity';
import { USER_ROLE } from '@/common/constants';

/** Completed sessions and active mentees per mentor */
export async function getMentorStats(mentorIds: string[]) {
  const stats = new Map<string, { completedSessions: number; menteeCount: number }>();
  if (mentorIds.length === 0) return stats;

  const [sessionCounts, menteeCounts] = await Promise.all([
    AppDataSource.getRepository(Session)
      .createQueryBuilder('s')
      .select('s.mentorId', 'mentorId')
      .addSelect('COUNT(*)', 'count')
      .where('s.mentorId IN (:...mentorIds)', { mentorIds })
      .andWhere('s.status = :status', { status: SESSION_STATUS.COMPLETED })
      .groupBy('s.mentorId')
      .getRawMany(),
    AppDataSource.getRepository(MentorshipRequest)
      .createQueryBuilder('mr')
      .select('mr.mentorId', 'mentorId')
      .addSelect('COUNT(*)', 'count')
      .where('mr.mentorId IN (:...mentorIds)', { mentorIds })
      .andWhere('mr.status = :status', { status: MENTORSHIP_REQUEST_STATUS.ACCEPTED })
      .groupBy('mr.mentorId')
      .getRawMany(),
  ]);

  const sessions = new Map(sessionCounts.map((r) => [r.mentorId, parseInt(r.count, 10)]));
  const mentees = new Map(menteeCounts.map((r) => [r.mentorId, parseInt(r.count, 10)]));
  for (const id of mentorIds) {
    stats.set(id, { completedSessions: sessions.get(id) ?? 0, menteeCount: mentees.get(id) ?? 0 });
  }
  return stats;
}

/** Last completed session and current mentor per mentee (the most recently accepted, if several) */
export async function getMenteeStats(menteeIds: string[]) {
  const stats = new Map<
    string,
    {
      lastSessionAt: Date | string | null;
      assignedMentor: { id: string; firstName: string; lastName: string } | null;
    }
  >();
  if (menteeIds.length === 0) return stats;

  const [lastSessions, assignedMentors] = await Promise.all([
    AppDataSource.getRepository(Session)
      .createQueryBuilder('s')
      .select('s.menteeId', 'menteeId')
      .addSelect('MAX(s.scheduledAt)', 'lastSessionAt')
      .where('s.menteeId IN (:...menteeIds)', { menteeIds })
      .andWhere('s.status = :status', { status: SESSION_STATUS.COMPLETED })
      .groupBy('s.menteeId')
      .getRawMany(),
    AppDataSource.getRepository(MentorshipRequest)
      .createQueryBuilder('mr')
      .innerJoin(User, 'mentor', 'mentor.id = mr.mentorId')
      .select('mr.menteeId', 'menteeId')
      .addSelect('mentor.id', 'mentorId')
      .addSelect('mentor.firstName', 'mentorFirstName')
      .addSelect('mentor.lastName', 'mentorLastName')
      .where('mr.menteeId IN (:...menteeIds)', { menteeIds })
      .andWhere('mr.status = :status', { status: MENTORSHIP_REQUEST_STATUS.ACCEPTED })
      .orderBy('mr.updatedAt', 'ASC')
      .getRawMany(),
  ]);

  const lastSession = new Map(lastSessions.map((r) => [r.menteeId, r.lastSessionAt]));
  // Oldest first, so the most recent mentor wins
  const mentor = new Map(
    assignedMentors.map((r) => [
      r.menteeId,
      { id: r.mentorId, firstName: r.mentorFirstName, lastName: r.mentorLastName },
    ]),
  );
  for (const id of menteeIds) {
    stats.set(id, { lastSessionAt: lastSession.get(id) ?? null, assignedMentor: mentor.get(id) ?? null });
  }
  return stats;
}

export class ChurchPortalActivityService {
  async getMentors(churchPortalId: string) {
    const mentors = await AppDataSource.getRepository(User).find({
      where: { churchPortalId, role: USER_ROLE.MENTOR },
      select: ['id', 'firstName', 'lastName', 'email', 'currentStreak', 'lastActiveAt', 'createdAt'],
      order: { lastActiveAt: 'DESC' },
    });
    const stats = await getMentorStats(mentors.map((m) => m.id));
    return mentors.map((m) => ({ ...m, ...stats.get(m.id) }));
  }

  async getMentees(churchPortalId: string) {
    const mentees = await AppDataSource.getRepository(User).find({
      where: { churchPortalId, role: USER_ROLE.MENTEE },
      select: ['id', 'firstName', 'lastName', 'email', 'currentStreak', 'lastActiveAt', 'createdAt'],
      order: { lastActiveAt: 'DESC' },
    });
    const stats = await getMenteeStats(mentees.map((m) => m.id));
    return mentees.map((m) => ({ ...m, ...stats.get(m.id) }));
  }

  async getSessions(
    churchPortalId: string,
    page = 1,
    limit = 20,
    timeFilter: 'all' | 'past' | 'upcoming' | 'canceled' = 'all'
  ) {
    const sessionRepo = AppDataSource.getRepository(Session);

    const qb = sessionRepo
      .createQueryBuilder('s')
      .innerJoin(User, 'mentor', 'mentor.id = s.mentorId AND mentor.churchPortalId = :cpId')
      .innerJoin(User, 'mentee', 'mentee.id = s.menteeId')
      .select([
        's.id', 's.status', 's.type', 's.scheduledAt', 's.duration', 's.title',
        's.mentorId', 's.menteeId', 's.createdAt',
        'mentor.firstName', 'mentor.lastName',
        'mentee.firstName', 'mentee.lastName',
      ])
      .setParameter('cpId', churchPortalId);

    const now = new Date();
    if (timeFilter === 'canceled') {
      qb.andWhere('s.status = :cancelled', { cancelled: SESSION_STATUS.CANCELLED });
    } else if (timeFilter === 'upcoming') {
      qb.andWhere('s.status != :cancelled', { cancelled: SESSION_STATUS.CANCELLED }).andWhere(
        's.scheduledAt >= :now',
        { now }
      );
    } else if (timeFilter === 'past') {
      qb.andWhere('s.status != :cancelled', { cancelled: SESSION_STATUS.CANCELLED }).andWhere(
        's.scheduledAt < :now',
        { now }
      );
    }

    const [sessions, total] = await qb
      .orderBy('s.scheduledAt', 'DESC')
      .limit(limit)
      .offset((page - 1) * limit)
      .getManyAndCount();

    // The joins above filter; these names are what the export needs
    const peopleIds = [...new Set(sessions.flatMap((s) => [s.mentorId, s.menteeId]))];
    const people = peopleIds.length
      ? await AppDataSource.getRepository(User).find({
          where: { id: In(peopleIds) },
          select: ['id', 'firstName', 'lastName'],
        })
      : [];
    const personById = new Map(people.map((p) => [p.id, { firstName: p.firstName ?? null, lastName: p.lastName ?? null }]));

    return {
      data: sessions.map((s) => ({
        ...s,
        mentor: personById.get(s.mentorId) ?? null,
        mentee: personById.get(s.menteeId) ?? null,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /** Every member's quiz activity, most active first (pastors only; the controller enforces it) */
  async getQuizzes(churchPortalId: string, page = 1, limit = 20) {
    const ds = AppDataSource;
    const scoreSql = 'a.score * 100.0 / NULLIF(a.total, 0)';

    const [total, summary, rows] = await Promise.all([
      ds.getRepository(User).count({ where: { churchPortalId } }),
      ds
        .createQueryBuilder()
        .from(QuizAttempt, 'a')
        .innerJoin(User, 'u', 'u.id = a.userId')
        .select('COUNT(*)', 'totalAttempts')
        .addSelect('COUNT(DISTINCT a.userId)', 'activeMembers')
        .addSelect(`AVG(${scoreSql})`, 'avgScore')
        .where('u.churchPortalId = :churchPortalId', { churchPortalId })
        .getRawOne<{ totalAttempts: string; activeMembers: string; avgScore: string | null }>(),
      ds
        .createQueryBuilder()
        .from(User, 'u')
        .leftJoin(QuizAttempt, 'a', 'a.userId = u.id')
        .leftJoin(QuizStreak, 's', 's.userId = u.id')
        .select('u.id', 'id')
        .addSelect('u.firstName', 'firstName')
        .addSelect('u.lastName', 'lastName')
        .addSelect('u.email', 'email')
        .addSelect('u.role', 'role')
        .addSelect('COUNT(a.id)', 'quizzesTaken')
        .addSelect(`AVG(${scoreSql})`, 'avgScore')
        .addSelect('MAX(a.completedAt)', 'lastQuizAt')
        .addSelect('MAX(s.currentStreak)', 'quizStreak')
        .where('u.churchPortalId = :churchPortalId', { churchPortalId })
        .groupBy('u.id')
        .orderBy('quizzesTaken', 'DESC')
        .addOrderBy('u.firstName', 'ASC')
        .limit(limit)
        .offset((page - 1) * limit)
        .getRawMany(),
    ]);

    const roundPct = (value: string | null | undefined) => (value != null ? Math.round(parseFloat(value)) : null);

    return {
      summary: {
        totalAttempts: parseInt(summary?.totalAttempts ?? '0', 10),
        activeMembers: parseInt(summary?.activeMembers ?? '0', 10),
        avgScorePct: roundPct(summary?.avgScore),
      },
      members: rows.map((r) => ({
        id: r.id,
        firstName: r.firstName ?? null,
        lastName: r.lastName ?? null,
        email: r.email,
        role: r.role,
        quizzesTaken: parseInt(r.quizzesTaken, 10),
        avgScorePct: roundPct(r.avgScore),
        lastQuizAt: r.lastQuizAt ?? null,
        quizStreak: r.quizStreak != null ? parseInt(r.quizStreak, 10) : 0,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getBibleReading(churchPortalId: string, page = 1, limit = 10) {
    const userRepo = AppDataSource.getRepository(User);

    const users = await userRepo.find({
      where: { churchPortalId },
      select: ['id', 'firstName', 'lastName', 'role', 'currentStreak', 'longestStreak', 'lastStreakDate'],
      order: { currentStreak: 'DESC' },
    });

    const totalUsers = users.length;
    const avgCurrentStreak =
      totalUsers > 0
        ? Math.round(users.reduce((acc, u) => acc + (u.currentStreak || 0), 0) / totalUsers)
        : 0;
    const topStreaker = users[0] || null;
    const total = users.length;
    const totalPages = Math.ceil(total / limit);
    const start = (page - 1) * limit;

    return {
      leaderboard: users.slice(start, start + limit),
      summary: { totalUsers, avgCurrentStreak, topStreaker },
      meta: { total, page, limit, totalPages },
    };
  }
}
