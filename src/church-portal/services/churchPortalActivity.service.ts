import { AppDataSource } from '@/config/data-source';
import { User } from '@/database/entities/user.entity';
import { Session, SESSION_STATUS } from '@/database/entities/session.entity';
import { MentorshipRequest, MENTORSHIP_REQUEST_STATUS } from '@/database/entities/mentorshipRequest.entity';
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

    return {
      data: sessions,
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
