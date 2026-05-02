import { AppDataSource } from '@/config/data-source';
import { User } from '@/database/entities/user.entity';
import { Session, SESSION_STATUS } from '@/database/entities/session.entity';
import { MentorshipRequest } from '@/database/entities/mentorshipRequest.entity';
import { USER_ROLE } from '@/common/constants';

export class ChurchPortalActivityService {
  async getMentors(churchPortalId: string) {
    const userRepo = AppDataSource.getRepository(User);
    const sessionRepo = AppDataSource.getRepository(Session);

    const mentors = await userRepo.find({
      where: { churchPortalId, role: USER_ROLE.MENTOR },
      select: ['id', 'firstName', 'lastName', 'email', 'currentStreak', 'lastActiveAt', 'createdAt'],
      order: { lastActiveAt: 'DESC' },
    });

    const mentorIds = mentors.map((m) => m.id);
    if (mentorIds.length === 0) return [];

    const [sessionCounts, menteeCounts] = await Promise.all([
      sessionRepo
        .createQueryBuilder('s')
        .select('s.mentorId', 'mentorId')
        .addSelect('COUNT(*)', 'count')
        .where('s.mentorId IN (:...mentorIds)', { mentorIds })
        .andWhere('s.status = :status', { status: SESSION_STATUS.COMPLETED })
        .groupBy('s.mentorId')
        .getRawMany(),

      userRepo
        .createQueryBuilder('u')
        .select('u.churchPortalId') // placeholder — mentee count via mentorship requests
        .getRawMany()
        .then(() =>
          // Count mentees per mentor via accepted mentorship requests
          AppDataSource.getRepository(MentorshipRequest)
            .createQueryBuilder('mr')
            .select('mr.mentorId', 'mentorId')
            .addSelect('COUNT(*)', 'count')
            .where('mr.mentorId IN (:...mentorIds)', { mentorIds })
            .andWhere('mr.status = :status', { status: 'accepted' })
            .groupBy('mr.mentorId')
            .getRawMany()
        ),
    ]);

    const sessionMap = Object.fromEntries(sessionCounts.map((r) => [r.mentorId, parseInt(r.count)]));
    const menteeMap = Object.fromEntries(menteeCounts.map((r) => [r.mentorId, parseInt(r.count)]));

    return mentors.map((m) => ({
      ...m,
      completedSessions: sessionMap[m.id] || 0,
      menteeCount: menteeMap[m.id] || 0,
    }));
  }

  async getMentees(churchPortalId: string) {
    const userRepo = AppDataSource.getRepository(User);
    const sessionRepo = AppDataSource.getRepository(Session);

    const mentees = await userRepo.find({
      where: { churchPortalId, role: USER_ROLE.MENTEE },
      select: ['id', 'firstName', 'lastName', 'email', 'currentStreak', 'lastActiveAt', 'createdAt'],
      order: { lastActiveAt: 'DESC' },
    });

    if (mentees.length === 0) return [];

    const menteeIds = mentees.map((m) => m.id);

    const [lastSessions, assignedMentors] = await Promise.all([
      sessionRepo
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
        .andWhere('mr.status = :status', { status: 'accepted' })
        .getRawMany(),
    ]);

    const lastSessionMap = Object.fromEntries(lastSessions.map((r) => [r.menteeId, r.lastSessionAt]));
    const mentorMap = Object.fromEntries(
      assignedMentors.map((r) => [
        r.menteeId,
        { id: r.mentorId, firstName: r.mentorFirstName, lastName: r.mentorLastName },
      ])
    );

    return mentees.map((m) => ({
      ...m,
      lastSessionAt: lastSessionMap[m.id] || null,
      assignedMentor: mentorMap[m.id] || null,
    }));
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
