import { AppDataSource } from '@/config/data-source';
import { User } from '@/database/entities/user.entity';
import { MentorProfile } from '@/database/entities/mentorProfile.entity';
import { OrgPlan } from '@/database/entities/orgPlan.entity';
import { USER_ROLE, MENTOR_APPROVAL_STATUS } from '@/common';
import { ADMIN_ROLE } from '@/common/constants/adminRoles';
import { adminSubscriptionService } from './adminSubscription.service';

export class AdminDashboardService {
  async getSummary(adminRole: ADMIN_ROLE) {
    const userRepo = AppDataSource.getRepository(User);
    const mpRepo = AppDataSource.getRepository(MentorProfile);
    const orgRepo = AppDataSource.getRepository(OrgPlan);

    const [mentees, mentors, totalUsers, activeChurchPlans, activeFamilyPlans] =
      await Promise.all([
        userRepo.count({ where: { role: USER_ROLE.MENTEE } }),
        userRepo.count({ where: { role: USER_ROLE.MENTOR } }),
        userRepo.count(),
        orgRepo.count({ where: { planType: 'church', status: 'active' } }),
        orgRepo.count({ where: { planType: 'family', status: 'active' } }),
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
      users: {
        mentees,
        mentors,
        total: totalUsers,
      },
      subscriptions: subscriptionSlice,
      pendingMentorApplications,
      plans: {
        activeChurchPlans,
        activeFamilyPlans,
      },
    };
  }
}

export const adminDashboardService = new AdminDashboardService();
