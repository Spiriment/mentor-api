import { AppDataSource } from '@/config/data-source';
import { User } from '@/database/entities/user.entity';
import { ChurchPortalJoinRequest } from '../entities/churchPortalJoinRequest.entity';
import { Session, SESSION_STATUS } from '@/database/entities/session.entity';
import { USER_ROLE } from '@/common/constants';
import { NotFoundError, ForbiddenError } from '@/common/errors';
import { syncChurchCouponsInBackground } from '@/services/churchDiscountSync.service';

export class ChurchPortalMembersService {
  async listMembers(
    churchPortalId: string,
    role?: 'mentor' | 'mentee',
    page = 1,
    limit = 20
  ) {
    const userRepo = AppDataSource.getRepository(User);

    const where: Record<string, any> = { churchPortalId };
    if (role === 'mentor') where.role = USER_ROLE.MENTOR;
    if (role === 'mentee') where.role = USER_ROLE.MENTEE;

    const [users, total] = await userRepo.findAndCount({
      where,
      select: [
        'id', 'firstName', 'lastName', 'email', 'role',
        'currentStreak', 'longestStreak', 'lastActiveAt',
        'isOnboardingComplete', 'createdAt',
      ],
      order: { createdAt: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });

    return {
      data: users,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getMember(churchPortalId: string, userId: string) {
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

    return { ...user, completedSessions: sessionCount };
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

    return {
      data: sessions,
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
