import { DataSource } from 'typeorm';
import { Seeder } from 'typeorm-extension';
import { User } from '@/database/entities/user.entity';
import { UserSubscription, SubscriptionStatus } from '@/database/entities/userSubscription.entity';
import { OrgPlan, OrgPlanStatus } from '@/database/entities/orgPlan.entity';
import { faker } from '@faker-js/faker';

export default class SubscriptionSeeder implements Seeder {
  public async run(dataSource: DataSource): Promise<void> {
    const userRepo = dataSource.getRepository(User);
    const subRepo = dataSource.getRepository(UserSubscription);
    const orgRepo = dataSource.getRepository(OrgPlan);

    console.log('📦 Seeding Organization Plans...');
    const orgPlans = [
      { name: 'Redemption Church', planType: 'church' as const, status: 'active' as OrgPlanStatus, totalSeats: 100, usedSeats: 0 },
      { name: 'Grace Fellowship', planType: 'church' as const, status: 'active' as OrgPlanStatus, totalSeats: 100, usedSeats: 0 },
      { name: 'City Light Church', planType: 'church' as const, status: 'active' as OrgPlanStatus, totalSeats: 100, usedSeats: 0 },
    ];
    const savedPlans = await orgRepo.save(orgPlans);

    const users = await userRepo.find({ take: 800 });

    console.log(`📦 Seeding ${users.length} User Subscriptions & Plan Links...`);

    for (const plan of savedPlans) {
      const adminUser = faker.helpers.arrayElement(users);
      plan.billingAdminUserId = adminUser.id;
      await orgRepo.save(plan);
    }

    const orgUsers = users.slice(0, 100);
    const individualUsers = users.slice(100);

    const planUsage: Record<string, number> = {};
    const today = new Date();
    const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    for (let i = 0; i < orgUsers.length; i++) {
      const user = orgUsers[i];
      const plan = savedPlans[i % savedPlans.length];

      user.orgPlanId = plan.id;
      user.currentStreak = faker.number.int({ min: 2, max: 30 });
      user.longestStreak = user.currentStreak + faker.number.int({ min: 0, max: 20 });

      const activeDays = Array.from({ length: 15 }, () => faker.number.int({ min: 1, max: 28 }));
      user.monthlyStreakData = { [monthKey]: [...new Set(activeDays)] };

      await userRepo.save(user);

      planUsage[plan.id] = (planUsage[plan.id] || 0) + 1;
    }

    for (const plan of savedPlans) {
      plan.usedSeats = planUsage[plan.id] || 0;
      await orgRepo.save(plan);
    }

    const subs = individualUsers.map((user, i) => {
      let tier: 'basic' | 'pro' | 'premium' = 'basic';
      let mrr = 0;

      if (i % 10 < 2) {
        tier = 'premium';
        mrr = 2999;
      } else if (i % 10 < 5) {
        tier = 'pro';
        mrr = 1499;
      } else {
        tier = 'basic';
        mrr = 499;
      }

      return subRepo.create({
        user,
        tier,
        status: faker.helpers.arrayElement(['active', 'active', 'active', 'trialing']) as SubscriptionStatus,
        mrrCents: mrr,
        currency: 'USD',
        expiresAt: faker.date.future(),
        createdAt: faker.date.past({ years: 1 }),
      });
    });

    await subRepo.save(subs);
  }
}
