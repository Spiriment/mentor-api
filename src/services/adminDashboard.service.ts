import { AppDataSource } from '@/config/data-source';
import { User } from '@/database/entities/user.entity';
import { MentorProfile } from '@/database/entities/mentorProfile.entity';
import { OrgPlan } from '@/database/entities/orgPlan.entity';
import { Session } from '@/database/entities/session.entity';
import { UserSubscription } from '@/database/entities/userSubscription.entity';
import { USER_ROLE, MENTOR_APPROVAL_STATUS } from '@/common';
import { ADMIN_ROLE } from '@/common/constants/adminRoles';
import { adminSubscriptionService } from './adminSubscription.service';

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export class AdminDashboardService {
  async getSummary(adminRole: ADMIN_ROLE) {
    const userRepo = AppDataSource.getRepository(User);
    const mpRepo = AppDataSource.getRepository(MentorProfile);
    const orgRepo = AppDataSource.getRepository(OrgPlan);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [mentees, mentors, totalUsers, activeChurchPlans, activeFamilyPlans, monthlyActiveUsers] =
      await Promise.all([
        userRepo.count({ where: { role: USER_ROLE.MENTEE } }),
        userRepo.count({ where: { role: USER_ROLE.MENTOR } }),
        userRepo.count(),
        orgRepo.count({ where: { planType: 'church', status: 'active' } }),
        orgRepo.count({ where: { planType: 'family', status: 'active' } }),
        // Real MAU: users who made any authenticated request in the last 30 days
        userRepo
          .createQueryBuilder('user')
          .where('user.lastActiveAt >= :thirtyDaysAgo', { thirtyDaysAgo })
          .getCount(),
      ]);

    const pendingMentorApplications = await mpRepo
      .createQueryBuilder('mp')
      .innerJoin('mp.user', 'user')
      .where('mp.isOnboardingComplete = :c', { c: true })
      .andWhere('mp.isApproved = :a', { a: false })
      .andWhere(
        '(user.mentorApprovalStatus IS NULL OR user.mentorApprovalStatus = :p)',
        { p: MENTOR_APPROVAL_STATUS.PENDING }
      )
      .getCount();

    const subscriptionSlice =
      await adminSubscriptionService.getDashboardSubscriptionSlice(adminRole);

    return {
      users: { mentees, mentors, total: totalUsers },
      monthlyActiveUsers,
      subscriptions: subscriptionSlice,
      pendingMentorApplications,
      plans: { activeChurchPlans, activeFamilyPlans },
    };
  }

  async getAnalytics() {
    const userRepo = AppDataSource.getRepository(User);
    const subRepo = AppDataSource.getRepository(UserSubscription);
    const sessionRepo = AppDataSource.getRepository(Session);

    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
    twelveMonthsAgo.setDate(1);
    twelveMonthsAgo.setHours(0, 0, 0, 0);

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    // Ordered month keys for last 12 months
    const mauMonthKeys: string[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      mauMonthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }

    const [users, sessions, subscriptions, mauRaw, dauRaw] = await Promise.all([
      userRepo.find({ select: ['id', 'role', 'createdAt'] }),
      sessionRepo.find({ select: ['id', 'scheduledAt'] }),
      subRepo.find({ where: { status: 'active' }, select: ['id', 'tier'] }),
      // Real MAU per calendar month
      userRepo
        .createQueryBuilder('user')
        .select(`DATE_FORMAT(user.lastActiveAt, '%Y-%m')`, 'month')
        .addSelect('COUNT(DISTINCT user.id)', 'count')
        .where('user.lastActiveAt >= :twelveMonthsAgo', { twelveMonthsAgo })
        .groupBy(`DATE_FORMAT(user.lastActiveAt, '%Y-%m')`)
        .orderBy(`DATE_FORMAT(user.lastActiveAt, '%Y-%m')`, 'ASC')
        .getRawMany<{ month: string; count: string }>(),
      // Real DAU per day (last 7 days)
      userRepo
        .createQueryBuilder('user')
        .select(`DATE_FORMAT(user.lastActiveAt, '%Y-%m-%d')`, 'day')
        .addSelect('COUNT(DISTINCT user.id)', 'count')
        .where('user.lastActiveAt >= :sevenDaysAgo', { sevenDaysAgo })
        .groupBy(`DATE_FORMAT(user.lastActiveAt, '%Y-%m-%d')`)
        .getRawMany<{ day: string; count: string }>(),
    ]);

    // ── MAU chart data ────────────────────────────────────────────────────────
    const mauMap: Record<string, number> = {};
    for (const key of mauMonthKeys) mauMap[key] = 0;
    for (const row of mauRaw) {
      if (mauMap[row.month] !== undefined) mauMap[row.month] = parseInt(row.count, 10);
    }
    const mauData = mauMonthKeys.map((key) => {
      const [year, month] = key.split('-');
      return {
        month: `${MONTH_NAMES[parseInt(month, 10) - 1]} '${year.slice(2)}`,
        users: mauMap[key],
      };
    });

    // ── DAU chart data ────────────────────────────────────────────────────────
    const dauByKey: Record<string, { day: string; users: number }> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      dauByKey[key] = { day: DAY_NAMES[d.getDay()], users: 0 };
    }
    for (const row of dauRaw) {
      if (dauByKey[row.day]) dauByKey[row.day].users = parseInt(row.count, 10);
    }
    const dauData = Object.values(dauByKey);

    // ── User Growth (last 6 months) ───────────────────────────────────────────
    const userGrowthMap: Record<string, { mentees: number; mentors: number }> = {};
    const sessionDataMap: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const mo = MONTH_NAMES[d.getMonth()];
      userGrowthMap[mo] = { mentees: 0, mentors: 0 };
      sessionDataMap[mo] = 0;
    }
    users.forEach((u) => {
      if (u.createdAt >= sixMonthsAgo) {
        const mo = MONTH_NAMES[u.createdAt.getMonth()];
        if (userGrowthMap[mo]) {
          if (u.role === USER_ROLE.MENTEE) userGrowthMap[mo].mentees++;
          else if (u.role === USER_ROLE.MENTOR) userGrowthMap[mo].mentors++;
        }
      }
    });
    sessions.forEach((s) => {
      if (s.scheduledAt >= sixMonthsAgo) {
        const mo = MONTH_NAMES[s.scheduledAt.getMonth()];
        if (sessionDataMap[mo] !== undefined) sessionDataMap[mo]++;
      }
    });

    const userGrowth = Object.keys(userGrowthMap).map((mo) => ({
      month: mo,
      mentees: userGrowthMap[mo].mentees,
      mentors: userGrowthMap[mo].mentors,
    }));
    const sessionData = Object.keys(sessionDataMap).map((mo) => ({
      month: mo,
      sessions: sessionDataMap[mo],
    }));

    // ── Subscription Distribution ─────────────────────────────────────────────
    const subDist: Record<string, number> = { Basic: 0, Pro: 0, Premium: 0 };
    subscriptions.forEach((s) => {
      if (s.tier === 'basic') subDist.Basic++;
      else if (s.tier === 'pro') subDist.Pro++;
      else if (s.tier === 'premium') subDist.Premium++;
    });
    const subDistribution = [
      { name: 'Basic', value: subDist.Basic, color: 'hsl(220, 14%, 70%)' },
      { name: 'Pro', value: subDist.Pro, color: 'hsl(215, 55%, 48%)' },
      { name: 'Premium', value: subDist.Premium, color: 'hsl(131, 22%, 29%)' },
    ].filter((s) => s.value > 0);

    return { userGrowth, subDistribution, sessionData, dauData, mauData };
  }
}

export const adminDashboardService = new AdminDashboardService();
