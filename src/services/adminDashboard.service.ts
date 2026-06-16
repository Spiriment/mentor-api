import { In, IsNull } from 'typeorm';
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

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

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
        '(user.mentorApprovalStatus IS NULL OR user.mentorApprovalStatus IN (:...st))',
        { st: [MENTOR_APPROVAL_STATUS.PENDING, MENTOR_APPROVAL_STATUS.NEEDS_MORE_INFO] }
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

  async getAnalytics(adminRole: ADMIN_ROLE) {
    const userRepo = AppDataSource.getRepository(User);
    const subRepo = AppDataSource.getRepository(UserSubscription);
    const sessionRepo = AppDataSource.getRepository(Session);

    const now = new Date();
    const twelveMonthsAgo = new Date(now);
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
    twelveMonthsAgo.setDate(1);
    twelveMonthsAgo.setHours(0, 0, 0, 0);

    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);

    const recentMonthBuckets: { key: string; label: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      recentMonthBuckets.push({ key: monthKey(d), label: MONTH_NAMES[d.getMonth()] });
    }

    const mauMonthKeys: string[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      mauMonthKeys.push(monthKey(d));
    }

    const [
      users,
      sessions,
      subscriptions,
      mauRaw,
      dauRaw,
      monthlyActiveUsers,
      totalUsers,
      inactiveUsers30d,
      nonActiveUsers,
      sessionsThisMonth,
      sessionsLastMonth,
      dailyActiveUsers,
      dailyActiveUsersYesterday,
    ] = await Promise.all([
      userRepo.find({ select: ['id', 'role', 'createdAt'] }),
      sessionRepo.find({ select: ['id', 'scheduledAt'] }),
      subRepo.find({ where: { status: In(['active', 'trialing']) }, select: ['id', 'tier'] }),
      userRepo
        .createQueryBuilder('user')
        .select(`DATE_FORMAT(user.lastActiveAt, '%Y-%m')`, 'month')
        .addSelect('COUNT(DISTINCT user.id)', 'count')
        .where('user.lastActiveAt >= :twelveMonthsAgo', { twelveMonthsAgo })
        .groupBy(`DATE_FORMAT(user.lastActiveAt, '%Y-%m')`)
        .orderBy(`DATE_FORMAT(user.lastActiveAt, '%Y-%m')`, 'ASC')
        .getRawMany<{ month: string; count: string }>(),
      userRepo
        .createQueryBuilder('user')
        .select(`DATE_FORMAT(user.lastActiveAt, '%Y-%m-%d')`, 'day')
        .addSelect('COUNT(DISTINCT user.id)', 'count')
        .where('user.lastActiveAt >= :sevenDaysAgo', { sevenDaysAgo })
        .groupBy(`DATE_FORMAT(user.lastActiveAt, '%Y-%m-%d')`)
        .getRawMany<{ day: string; count: string }>(),
      userRepo
        .createQueryBuilder('user')
        .where('user.lastActiveAt >= :thirtyDaysAgo', { thirtyDaysAgo })
        .getCount(),
      userRepo.count(),
      userRepo
        .createQueryBuilder('user')
        .where('user.lastActiveAt IS NULL OR user.lastActiveAt < :thirtyDaysAgo', { thirtyDaysAgo })
        .getCount(),
      userRepo.count({ where: { lastActiveAt: IsNull() } }),
      sessionRepo
        .createQueryBuilder('s')
        .where('s.scheduledAt >= :startOfMonth', { startOfMonth })
        .getCount(),
      sessionRepo
        .createQueryBuilder('s')
        .where('s.scheduledAt >= :startOfLastMonth AND s.scheduledAt < :startOfMonth', {
          startOfLastMonth,
          startOfMonth,
        })
        .getCount(),
      userRepo
        .createQueryBuilder('user')
        .where('user.lastActiveAt >= :todayStart', { todayStart })
        .getCount(),
      userRepo
        .createQueryBuilder('user')
        .where('user.lastActiveAt >= :yesterdayStart AND user.lastActiveAt < :todayStart', {
          yesterdayStart,
          todayStart,
        })
        .getCount(),
    ]);

    let monthlyRevenueCents: number | null = null;
    let monthlyRevenueCurrency = 'EUR';
    if (adminRole === ADMIN_ROLE.SUPER_ADMIN) {
      const mrrRow = await subRepo
        .createQueryBuilder('s')
        .select('COALESCE(SUM(s.mrrCents), 0)', 'sum')
        .where('s.status IN (:...st)', { st: ['active', 'trialing'] })
        .getRawOne<{ sum: string }>();
      monthlyRevenueCents = mrrRow?.sum ? parseInt(mrrRow.sum, 10) : 0;
    }

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

    const dauByKey: Record<string, { day: string; users: number }> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      dauByKey[key] = { day: DAY_NAMES[d.getDay()], users: 0 };
    }
    for (const row of dauRaw) {
      if (dauByKey[row.day]) dauByKey[row.day].users = parseInt(row.count, 10);
    }
    const dauData = Object.values(dauByKey);

    const userGrowthMap: Record<string, { mentees: number; mentors: number }> = {};
    const sessionDataMap: Record<string, number> = {};
    for (const bucket of recentMonthBuckets) {
      userGrowthMap[bucket.key] = { mentees: 0, mentors: 0 };
      sessionDataMap[bucket.key] = 0;
    }

    users.forEach((u) => {
      if (u.createdAt >= sixMonthsAgo) {
        const key = monthKey(u.createdAt);
        if (userGrowthMap[key]) {
          if (u.role === USER_ROLE.MENTEE) userGrowthMap[key].mentees++;
          else if (u.role === USER_ROLE.MENTOR) userGrowthMap[key].mentors++;
        }
      }
    });
    sessions.forEach((s) => {
      if (s.scheduledAt >= sixMonthsAgo) {
        const key = monthKey(s.scheduledAt);
        if (sessionDataMap[key] !== undefined) sessionDataMap[key]++;
      }
    });

    let cumulativeMentees = 0;
    let cumulativeMentors = 0;
    const userGrowth = recentMonthBuckets.map(({ key, label }) => {
      cumulativeMentees += userGrowthMap[key].mentees;
      cumulativeMentors += userGrowthMap[key].mentors;
      return {
        month: label,
        mentees: cumulativeMentees,
        mentors: cumulativeMentors,
        total: cumulativeMentees + cumulativeMentors,
      };
    });
    const sessionData = recentMonthBuckets.map(({ key, label }) => ({
      month: label,
      sessions: sessionDataMap[key],
    }));

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

    const currentCalendarMau = mauData.length > 0 ? mauData[mauData.length - 1].users : 0;
    const previousCalendarMau = mauData.length > 1 ? mauData[mauData.length - 2].users : 0;

    const kpis = {
      monthlyActiveUsers,
      monthlyActiveUsersChangePct: pctChange(currentCalendarMau, previousCalendarMau),
      dailyActiveUsers,
      dailyActiveUsersChangePct: pctChange(dailyActiveUsers, dailyActiveUsersYesterday),
      sessionsThisMonth,
      sessionsThisMonthChangePct: pctChange(sessionsThisMonth, sessionsLastMonth),
      monthlyRevenueCents,
      monthlyRevenueCurrency,
      inactiveUsers30d,
      nonActiveUsers,
      totalUsers,
    };

    return { kpis, userGrowth, subDistribution, sessionData, dauData, mauData };
  }
}

export const adminDashboardService = new AdminDashboardService();
