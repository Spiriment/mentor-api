import { AppDataSource } from '@/config/data-source';
import { User } from '@/database/entities/user.entity';
import { Session, SESSION_STATUS } from '@/database/entities/session.entity';
import { USER_ROLE } from '@/common/constants';
import { ChurchPortal } from '../entities/churchPortal.entity';
import { ChurchPortalJoinRequest, CHURCH_JOIN_REQUEST_STATUS } from '../entities/churchPortalJoinRequest.entity';
import { getMentorStats } from './churchPortalActivity.service';
import {
  growthByMonth,
  lastMonths,
  lastWeekStarts,
  memberHealth,
  readingByWeek,
  sessionsByWeek,
} from '../utils/insights';

const INSIGHT_WEEKS = 12;
const INSIGHT_MONTHS = 6;

export class ChurchPortalDashboardService {
  /**
   * Charts for the Insights page: sessions and Bible reading per week (last 12 weeks), mentor
   * workload, member growth per month (last 6 months) and member health. Members are the users
   * linked to this church, the same as everywhere else in the portal.
   */
  async getInsights(churchPortalId: string) {
    const now = new Date();
    const weeks = lastWeekStarts(INSIGHT_WEEKS, now);
    const months = lastMonths(INSIGHT_MONTHS, now);
    const since = new Date(`${weeks[0]}T00:00:00Z`);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);

    const members = await AppDataSource.getRepository(User).find({
      where: { churchPortalId },
      select: ['id', 'firstName', 'lastName', 'role', 'createdAt', 'lastActiveAt', 'monthlyStreakData'],
    });
    const mentors = members.filter((m) => m.role === USER_ROLE.MENTOR);
    const memberIds = members.map((m) => m.id);

    const [sessions, approvals, mentorStats, recentByMentor] = await Promise.all([
      // Same scope as the dashboard: sessions led by this church's mentors
      AppDataSource.getRepository(Session)
        .createQueryBuilder('s')
        .innerJoin(User, 'mentor', 'mentor.id = s.mentorId AND mentor.churchPortalId = :cpId', { cpId: churchPortalId })
        .select(['s.scheduledAt', 's.status'])
        .where('s.scheduledAt >= :since AND s.scheduledAt <= :now', { since, now })
        .getMany(),
      memberIds.length
        ? AppDataSource.getRepository(ChurchPortalJoinRequest)
            .createQueryBuilder('j')
            .select(['j.userId', 'j.resolvedAt'])
            .where('j.churchPortalId = :cpId AND j.status = :approved AND j.resolvedAt IS NOT NULL', {
              cpId: churchPortalId,
              approved: CHURCH_JOIN_REQUEST_STATUS.APPROVED,
            })
            .getMany()
        : Promise.resolve([] as ChurchPortalJoinRequest[]),
      getMentorStats(mentors.map((m) => m.id)),
      mentors.length
        ? AppDataSource.getRepository(Session)
            .createQueryBuilder('s')
            .select('s.mentorId', 'mentorId')
            .addSelect('COUNT(*)', 'count')
            .where('s.mentorId IN (:...ids)', { ids: mentors.map((m) => m.id) })
            .andWhere('s.status = :completed', { completed: SESSION_STATUS.COMPLETED })
            .andWhere('s.scheduledAt >= :from AND s.scheduledAt <= :now', { from: thirtyDaysAgo, now })
            .groupBy('s.mentorId')
            .getRawMany<{ mentorId: string; count: string }>()
        : Promise.resolve([] as { mentorId: string; count: string }[]),
    ]);

    // Joined the church: when their join request was approved, otherwise when they signed up
    const approvedAt = new Map<string, Date>();
    for (const j of approvals) {
      const prev = approvedAt.get(j.userId);
      if (j.resolvedAt && (!prev || j.resolvedAt > prev)) approvedAt.set(j.userId, j.resolvedAt);
    }
    const recent = new Map(recentByMentor.map((r) => [r.mentorId, parseInt(r.count, 10) || 0]));

    const sessionWeeks = sessionsByWeek(sessions, weeks);
    const readingWeeks = readingByWeek(members.map((m) => m.monthlyStreakData), weeks);

    return {
      weeks: weeks.map((weekStart, i) => ({ ...sessionWeeks[i], ...readingWeeks[i], weekStart })),
      mentorWorkload: mentors
        .map((m) => ({
          id: m.id,
          name: [m.firstName, m.lastName].filter(Boolean).join(' ') || 'Mentor',
          mentees: mentorStats.get(m.id)?.menteeCount ?? 0,
          sessionsLast30Days: recent.get(m.id) ?? 0,
        }))
        .sort((a, b) => b.mentees - a.mentees || b.sessionsLast30Days - a.sessionsLast30Days),
      growth: growthByMonth(
        members.map((m) => approvedAt.get(m.id) ?? m.createdAt),
        months,
      ),
      health: memberHealth(members.map((m) => m.lastActiveAt ?? null), now),
      totals: { members: members.length, mentors: mentors.length, mentees: members.length - mentors.length },
    };
  }

  async getSummary(churchPortalId: string) {
    const userRepo = AppDataSource.getRepository(User);
    const sessionRepo = AppDataSource.getRepository(Session);
    const portalRepo = AppDataSource.getRepository(ChurchPortal);
    const portalRow = await portalRepo.findOne({
      where: { id: churchPortalId },
      select: ['joinCode', 'name', 'slug'],
    });

    const [totalMentors, totalMentees, pendingJoinRequests] = await Promise.all([
      userRepo.count({ where: { churchPortalId, role: USER_ROLE.MENTOR } }),
      userRepo.count({ where: { churchPortalId, role: USER_ROLE.MENTEE } }),
      AppDataSource.getRepository(ChurchPortalJoinRequest).count({
        where: { churchPortalId, status: CHURCH_JOIN_REQUEST_STATUS.PENDING },
      }),
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
      pendingJoinRequests,
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
