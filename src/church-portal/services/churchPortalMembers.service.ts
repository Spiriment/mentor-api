import { AppDataSource } from '@/config/data-source';
import { In } from 'typeorm';
import { User } from '@/database/entities/user.entity';
import { MenteeProfile } from '@/database/entities/menteeProfile.entity';
import { MentorProfile } from '@/database/entities/mentorProfile.entity';
import { adminQuizService } from '@/services/adminQuiz.service';
import { ChurchPortalJoinRequest } from '../entities/churchPortalJoinRequest.entity';
import { Session, SESSION_STATUS } from '@/database/entities/session.entity';
import { USER_ROLE } from '@/common/constants';
import { NotFoundError, ForbiddenError } from '@/common/errors';
import { syncChurchCouponsInBackground } from '@/services/churchDiscountSync.service';
import { getMenteeStats, getMentorStats } from './churchPortalActivity.service';

// Allowlists: signatures, agreements and internal admin notes must never reach a church
const MENTEE_PROFILE_FIELDS: (keyof MenteeProfile)[] = [
  'spiritualGoals', 'spiritualGrowthAreas', 'bibleTopics', 'christianExperience', 'bibleReadingFrequency',
  'scriptureConfidence', 'currentMentorship', 'learningPreference', 'mentorshipFormat', 'mentorExpectations',
  'churchDenomination', 'churchName', 'currentBook', 'currentChapter', 'completedChapters', 'studyDays',
];
const MENTOR_PROFILE_FIELDS: (keyof MentorProfile)[] = [
  'christianExperience', 'christianJourney', 'scriptureTeaching', 'currentMentoring', 'churchAffiliation',
  'leadershipRoles', 'maturityDefinition', 'menteeCapacity', 'mentorshipFormat', 'menteeCalling',
  'spiritualExpertise', 'currentBook', 'currentChapter', 'completedChapters', 'studyDays',
];
const RECENT_QUIZ_ATTEMPTS = 10;

export class ChurchPortalMembersService {
  async listMembers(
    churchPortalId: string,
    role?: 'mentor' | 'mentee',
    page = 1,
    limit = 20,
    search?: string
  ) {
    const qb = AppDataSource.getRepository(User)
      .createQueryBuilder('u')
      .select([
        'u.id', 'u.firstName', 'u.lastName', 'u.email', 'u.role',
        'u.currentStreak', 'u.longestStreak', 'u.lastActiveAt',
        'u.isOnboardingComplete', 'u.createdAt',
      ])
      .where('u.churchPortalId = :churchPortalId', { churchPortalId })
      .orderBy('u.createdAt', 'DESC')
      .take(limit)
      .skip((page - 1) * limit);

    if (role === 'mentor') qb.andWhere('u.role = :role', { role: USER_ROLE.MENTOR });
    if (role === 'mentee') qb.andWhere('u.role = :role', { role: USER_ROLE.MENTEE });

    const term = search?.trim().replace(/[\\%_]/g, '\\$&');
    if (term) {
      qb.andWhere("(CONCAT_WS(' ', u.firstName, u.lastName) LIKE :term OR u.email LIKE :term)", {
        term: `%${term}%`,
      });
    }

    const [users, total] = await qb.getManyAndCount();

    const ids = users.map((u) => u.id);
    const stats =
      role === 'mentor' ? await getMentorStats(ids) : role === 'mentee' ? await getMenteeStats(ids) : null;

    return {
      data: stats ? users.map((u) => ({ ...u, ...stats.get(u.id) })) : users,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /** `includePrivate` adds the spiritual profile and quiz activity (pastors only; callers enforce it) */
  async getMember(churchPortalId: string, userId: string, includePrivate = false) {
    const userRepo = AppDataSource.getRepository(User);

    const user = await userRepo.findOne({
      where: { id: userId, churchPortalId },
      select: [
        'id', 'firstName', 'lastName', 'email', 'role', 'gender',
        'country', 'city', 'currentStreak', 'longestStreak',
        'lastStreakDate', 'weeklyStreakData', 'monthlyStreakData',
        'lastActiveAt', 'isOnboardingComplete', 'createdAt',
      ],
    });

    if (!user) throw new NotFoundError('Member not found in this church');

    const sessionRepo = AppDataSource.getRepository(Session);

    const isMentor = user.role === USER_ROLE.MENTOR;
    const sessionCount = await sessionRepo.count({
      where: isMentor
        ? { mentorId: userId, status: SESSION_STATUS.COMPLETED }
        : { menteeId: userId, status: SESSION_STATUS.COMPLETED },
    });

    const stats = isMentor
      ? (await getMentorStats([userId])).get(userId)
      : (await getMenteeStats([userId])).get(userId);

    const base = { ...user, ...stats, completedSessions: sessionCount };
    if (!includePrivate) return base;

    const [spiritualProfile, quiz] = await Promise.all([
      isMentor
        ? AppDataSource.getRepository(MentorProfile).findOne({ where: { userId }, select: MENTOR_PROFILE_FIELDS })
        : AppDataSource.getRepository(MenteeProfile).findOne({ where: { userId }, select: MENTEE_PROFILE_FIELDS }),
      adminQuizService.getUserQuizActivity(userId, RECENT_QUIZ_ATTEMPTS),
    ]);

    return { ...base, spiritualProfile, quiz };
  }

  async getMemberSessions(churchPortalId: string, userId: string, page = 1, limit = 20) {
    const userRepo = AppDataSource.getRepository(User);
    const member = await userRepo.findOne({ where: { id: userId, churchPortalId }, select: ['id', 'role'] });
    if (!member) throw new NotFoundError('Member not found in this church');

    const sessionRepo = AppDataSource.getRepository(Session);
    const isMentor = member.role === USER_ROLE.MENTOR;

    const [sessions, total] = await sessionRepo.findAndCount({
      where: isMentor ? { mentorId: userId } : { menteeId: userId },
      select: ['id', 'status', 'type', 'scheduledAt', 'duration', 'title', 'mentorId', 'menteeId', 'createdAt'],
      order: { scheduledAt: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });

    const otherIds = [...new Set(sessions.map((s) => (isMentor ? s.menteeId : s.mentorId)))];
    const others = otherIds.length
      ? await userRepo.find({ where: { id: In(otherIds) }, select: ['id', 'firstName', 'lastName'] })
      : [];
    const otherById = new Map(others.map((u) => [u.id, u]));

    return {
      data: sessions.map((s) => {
        const other = otherById.get(isMentor ? s.menteeId : s.mentorId);
        return {
          ...s,
          otherParty: other
            ? { id: other.id, firstName: other.firstName ?? null, lastName: other.lastName ?? null }
            : null,
        };
      }),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async removeMember(churchPortalId: string, userId: string) {
    const userRepo = AppDataSource.getRepository(User);
    const member = await userRepo.findOne({ where: { id: userId, churchPortalId }, select: ['id'] });
    if (!member) throw new NotFoundError('Member not found in this church');
    await userRepo.update(userId, { churchPortalId: null, churchDiscountPercent: 0 });
    // Without this, the old "approved" request let them rejoin with the code, unapproved
    await AppDataSource.getRepository(ChurchPortalJoinRequest).delete({ churchPortalId, userId });
    const { adminOrgPlanService } = await import('@/services/adminOrgPlan.service');
    // The church stops paying for someone it removed (seat + church-billed plan)
    const ended = await adminOrgPlanService.endChurchPaidAccessForPortal(userId, churchPortalId);
    await adminOrgPlanService.syncChurchPortalMemberDiscounts(churchPortalId);
    syncChurchCouponsInBackground([userId], 'removed from church');
    return {
      message: ended.downgraded
        ? 'Member removed from this church. Their church-paid plan has ended.'
        : 'Member removed from this church.',
    };
  }

  async getMemberStreak(churchPortalId: string, userId: string) {
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({
      where: { id: userId, churchPortalId },
      select: ['id', 'currentStreak', 'longestStreak', 'lastStreakDate', 'weeklyStreakData', 'monthlyStreakData'],
    });
    if (!user) throw new NotFoundError('Member not found in this church');
    return user;
  }
}
