import { AppDataSource } from '@/config/data-source';
import { User } from '@/database/entities/user.entity';
import { Session, SESSION_STATUS } from '@/database/entities/session.entity';
import { USER_ROLE } from '@/common/constants';
import { ChurchPortal } from '../entities/churchPortal.entity';

export class ChurchPortalDashboardService {
  async getSummary(churchPortalId: string) {
    const userRepo = AppDataSource.getRepository(User);
    const sessionRepo = AppDataSource.getRepository(Session);
    const portalRepo = AppDataSource.getRepository(ChurchPortal);
    const portalRow = await portalRepo.findOne({
      where: { id: churchPortalId },
      select: ['joinCode', 'name', 'slug'],
    });

    const [totalMentors, totalMentees] = await Promise.all([
      userRepo.count({ where: { churchPortalId, role: USER_ROLE.MENTOR } }),
      userRepo.count({ where: { churchPortalId, role: USER_ROLE.MENTEE } }),
    ]);

    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const weeklySessions = await sessionRepo
      .createQueryBuilder('s')
      .innerJoin(User, 'mentor', 'mentor.id = s.mentorId AND mentor.churchPortalId = :cpId')
      .where('s.scheduledAt >= :startOfWeek', { startOfWeek })
      .andWhere('s.status IN (:...statuses)', {
        statuses: [SESSION_STATUS.CONFIRMED, SESSION_STATUS.COMPLETED, SESSION_STATUS.IN_PROGRESS],
      })
      .setParameter('cpId', churchPortalId)
      .getCount();

    const churchUsers = await userRepo.find({
      where: { churchPortalId },
      select: ['currentStreak'],
    });

    const avgStreak =
      churchUsers.length > 0
        ? Math.round(churchUsers.reduce((acc, u) => acc + (u.currentStreak || 0), 0) / churchUsers.length)
        : 0;

    return {
      totalMentors,
      totalMentees,
      weeklySessions,
      avgStreak,
      joinCode: portalRow?.joinCode ?? null,
      portalName: portalRow?.name,
      portalSlug: portalRow?.slug,
    };
  }

  async getActivityFeed(churchPortalId: string) {
    const userRepo = AppDataSource.getRepository(User);
    const sessionRepo = AppDataSource.getRepository(Session);

    const since = new Date();
    since.setDate(since.getDate() - 7);

    const [recentSessions, newMembers] = await Promise.all([
      sessionRepo
        .createQueryBuilder('s')
        .innerJoin(User, 'mentor', 'mentor.id = s.mentorId AND mentor.churchPortalId = :cpId')
        .innerJoin(User, 'mentee', 'mentee.id = s.menteeId')
        .select([
          's.id',
          's.status',
          's.scheduledAt',
          's.updatedAt',
          'mentor.id',
          'mentor.firstName',
          'mentor.lastName',
          'mentee.id',
          'mentee.firstName',
          'mentee.lastName',
        ])
        .where('s.status = :status', { status: SESSION_STATUS.COMPLETED })
        .andWhere('s.updatedAt >= :since', { since })
        .setParameter('cpId', churchPortalId)
        .orderBy('s.updatedAt', 'DESC')
        .limit(20)
        .getRawMany(),

      userRepo.find({
        where: { churchPortalId },
        select: ['id', 'firstName', 'lastName', 'role', 'createdAt'],
        order: { createdAt: 'DESC' },
        take: 10,
      }),
    ]);

    const sessionEvents = recentSessions.map((s) => ({
      type: 'session_completed' as const,
      sessionId: s.s_id,
      mentor: { id: s.mentor_id, firstName: s.mentor_firstName, lastName: s.mentor_lastName },
      mentee: { id: s.mentee_id, firstName: s.mentee_firstName, lastName: s.mentee_lastName },
      at: s.s_updatedAt,
    }));

    const memberEvents = newMembers
      .filter((u) => new Date(u.createdAt) >= since)
      .map((u) => ({
        type: 'new_member' as const,
        user: { id: u.id, firstName: u.firstName, lastName: u.lastName, role: u.role },
        at: u.createdAt,
      }));

    const feed = [...sessionEvents, ...memberEvents].sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
    );

    return feed.slice(0, 30);
  }
}
