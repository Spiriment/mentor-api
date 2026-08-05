/**
 * Seeds a complete church portal for local testing.
 *
 * Creates / updates:
 *   1. A ChurchPortal  (slug: "grace-bible") linked to a church OrgPlan
 *   2. A ChurchPortalUser / pastor login  (email: pastor@grace-bible.com / password: Password123!)
 *   3. Links mentors + mentees to the portal and org plan (central billing)
 *
 * Usage:
 *   npm run seed:church-portal
 *
 * Re-running is safe — upserts plan linkage and member seats.
 */

import 'reflect-metadata';
import bcrypt from 'bcryptjs';
import { AppDataSource } from '../src/config/data-source';
import { ChurchPortal } from '../src/church-portal/entities/churchPortal.entity';
import { ChurchPortalUser } from '../src/church-portal/entities/churchPortalUser.entity';
import { User } from '../src/database/entities/user.entity';
import { OrgPlan } from '../src/database/entities/orgPlan.entity';
import { UserSubscription } from '../src/database/entities/userSubscription.entity';
import { USER_ROLE, MENTOR_APPROVAL_STATUS } from '../src/common/constants';
import {
  CHURCH_DISCOUNT_PERCENT,
  TIER_PRICE_EUR,
  applyDiscount,
} from '../src/common/constants/subscriptionPricing';
import { Logger } from '../src/common';
import { v4 as uuidv4 } from 'uuid';

const logger = new Logger({ service: 'seed-church-portal', level: 'info' });

const PORTAL_SLUG = 'grace-bible';
const PORTAL_NAME = 'Grace Bible Church';
const PASTOR_EMAIL = 'pastor@grace-bible.com';
const PASTOR_PASSWORD = 'Password123!';
const MENTOR_COUNT = 3;
const MENTEE_COUNT = 5;
const TIERS = ['basic', 'pro', 'premium'] as const;

async function upsertChurchCentralSub(
  userId: string,
  tier: (typeof TIERS)[number],
  discountPercent: number,
) {
  const subRepo = AppDataSource.getRepository(UserSubscription);
  let sub = await subRepo.findOne({ where: { userId } });
  const monthlyEur = applyDiscount(TIER_PRICE_EUR[tier], discountPercent);
  if (!sub) {
    sub = subRepo.create({ userId });
  }
  sub.tier = tier;
  sub.status = 'active';
  sub.externalProvider = 'church_central';
  sub.externalRef = null;
  sub.mrrCents = Math.round(monthlyEur * 100);
  sub.billingInterval = 'monthly';
  sub.currency = 'EUR';
  sub.notes = 'church_central_billing';
  await subRepo.save(sub);
}

async function ensureOrgPlan(portal: ChurchPortal): Promise<OrgPlan> {
  const planRepo = AppDataSource.getRepository(OrgPlan);
  const portalRepo = AppDataSource.getRepository(ChurchPortal);

  if (portal.orgPlanId) {
    const existing = await planRepo.findOne({ where: { id: portal.orgPlanId } });
    if (existing) {
      existing.status = 'active';
      existing.name = existing.name || `${PORTAL_NAME} Plan`;
      if (existing.totalSeats < 50) existing.totalSeats = 50;
      return planRepo.save(existing);
    }
  }

  const plan = planRepo.create({
    id: uuidv4(),
    planType: 'church',
    name: `${PORTAL_NAME} Plan`,
    status: 'active',
    totalSeats: 50,
    usedSeats: 0,
    billingAdminUserId: null,
    metadata: { memberTiers: {} },
  });
  await planRepo.save(plan);

  portal.orgPlanId = plan.id;
  portal.discountPercent = CHURCH_DISCOUNT_PERCENT;
  await portalRepo.save(portal);
  logger.info(`✅ Linked portal to org plan ${plan.id}`);
  return plan;
}

async function syncPortalMembersOntoPlan(portalId: string, plan: OrgPlan) {
  const userRepo = AppDataSource.getRepository(User);
  const planRepo = AppDataSource.getRepository(OrgPlan);

  const members = await userRepo.find({ where: { churchPortalId: portalId } });
  const memberTiers: Record<string, string> = {
    ...((plan.metadata?.memberTiers as Record<string, string> | undefined) ?? {}),
  };

  for (let i = 0; i < members.length; i++) {
    const member = members[i];
    const tier = (memberTiers[member.id] as (typeof TIERS)[number] | undefined) ?? TIERS[i % TIERS.length];
    memberTiers[member.id] = tier;
    await userRepo.update(member.id, {
      orgPlanId: plan.id,
      churchDiscountPercent: CHURCH_DISCOUNT_PERCENT,
    });
    await upsertChurchCentralSub(member.id, tier, CHURCH_DISCOUNT_PERCENT);
  }

  plan.usedSeats = members.length;
  plan.billingAdminUserId = members.find((m) => m.role === USER_ROLE.MENTOR)?.id ?? members[0]?.id ?? null;
  plan.metadata = { ...(plan.metadata ?? {}), memberTiers };
  await planRepo.save(plan);
  logger.info(`✅ Synced ${members.length} portal member(s) onto org plan`);
}

async function main() {
  await AppDataSource.initialize();
  logger.info('Database connected');

  const portalRepo = AppDataSource.getRepository(ChurchPortal);
  const portalUserRepo = AppDataSource.getRepository(ChurchPortalUser);
  const userRepo = AppDataSource.getRepository(User);

  // ── 1. Church Portal ────────────────────────────────────────────────────────
  let portal = await portalRepo.findOne({ where: { slug: PORTAL_SLUG } });

  if (portal) {
    logger.info(`Portal already exists — updating (id: ${portal.id})`);
    portal.name = PORTAL_NAME;
    portal.status = 'active';
    portal.discountPercent = CHURCH_DISCOUNT_PERCENT;
    await portalRepo.save(portal);
  } else {
    portal = portalRepo.create({
      name: PORTAL_NAME,
      slug: PORTAL_SLUG,
      denomination: 'Non-Denominational',
      city: 'Lagos',
      country: 'Nigeria',
      timezone: 'Africa/Lagos',
      status: 'active',
      discountPercent: CHURCH_DISCOUNT_PERCENT,
    });
    await portalRepo.save(portal);
    logger.info(`✅ Church portal created — slug: ${PORTAL_SLUG}  id: ${portal.id}`);
  }

  const plan = await ensureOrgPlan(portal);

  // ── 2. Pastor Login ─────────────────────────────────────────────────────────
  let pastor = await portalUserRepo.findOne({ where: { email: PASTOR_EMAIL } });

  if (pastor) {
    logger.info(`Pastor user already exists — skipping (id: ${pastor.id})`);
  } else {
    const hashed = await bcrypt.hash(PASTOR_PASSWORD, 12);
    pastor = portalUserRepo.create({
      churchPortalId: portal.id,
      email: PASTOR_EMAIL,
      password: hashed,
      firstName: 'Samuel',
      lastName: 'Adeyemi',
      role: 'pastor',
      isActive: true,
    });
    await portalUserRepo.save(pastor);
    logger.info(`✅ Pastor login created — email: ${PASTOR_EMAIL}  password: ${PASTOR_PASSWORD}`);
  }

  // ── 3. Link Mentors ─────────────────────────────────────────────────────────
  const alreadyLinkedMentors = await userRepo.count({
    where: { churchPortalId: portal.id, role: USER_ROLE.MENTOR },
  });

  if (alreadyLinkedMentors >= MENTOR_COUNT) {
    logger.info(`Mentors already linked (${alreadyLinkedMentors}) — skipping`);
  } else {
    const mentors = await userRepo.find({
      where: {
        role: USER_ROLE.MENTOR,
        mentorApprovalStatus: MENTOR_APPROVAL_STATUS.APPROVED,
        isActive: true,
      },
      take: MENTOR_COUNT,
      order: { createdAt: 'ASC' },
    });

    if (mentors.length === 0) {
      logger.warn('No approved mentors found in DB — skipping mentor linking');
    } else {
      for (const mentor of mentors) {
        await userRepo.update(mentor.id, {
          churchPortalId: portal.id,
          orgPlanId: plan.id,
          churchDiscountPercent: CHURCH_DISCOUNT_PERCENT,
        });
      }
      logger.info(`✅ Linked ${mentors.length} mentor(s) to the portal`);
    }
  }

  // ── 4. Link Mentees ─────────────────────────────────────────────────────────
  const alreadyLinkedMentees = await userRepo.count({
    where: { churchPortalId: portal.id, role: USER_ROLE.MENTEE },
  });

  if (alreadyLinkedMentees >= MENTEE_COUNT) {
    logger.info(`Mentees already linked (${alreadyLinkedMentees}) — skipping`);
  } else {
    const mentees = await userRepo.find({
      where: {
        role: USER_ROLE.MENTEE,
        isActive: true,
      },
      take: MENTEE_COUNT,
      order: { createdAt: 'ASC' },
    });

    if (mentees.length === 0) {
      logger.warn('No mentees found in DB — skipping mentee linking');
    } else {
      for (const mentee of mentees) {
        await userRepo.update(mentee.id, {
          churchPortalId: portal.id,
          orgPlanId: plan.id,
          churchDiscountPercent: CHURCH_DISCOUNT_PERCENT,
        });
      }
      logger.info(`✅ Linked ${mentees.length} mentee(s) to the portal`);
    }
  }

  // Always sync seats / central subs for everyone currently on the portal
  await syncPortalMembersOntoPlan(portal.id, plan);

  // ── Summary ─────────────────────────────────────────────────────────────────
  const finalMentors = await userRepo.count({
    where: { churchPortalId: portal.id, role: USER_ROLE.MENTOR },
  });
  const finalMentees = await userRepo.count({
    where: { churchPortalId: portal.id, role: USER_ROLE.MENTEE },
  });

  logger.info('');
  logger.info('─────────────────────────────────────────────');
  logger.info('  Church Portal Seed Complete');
  logger.info('─────────────────────────────────────────────');
  logger.info(`  Portal name    : ${PORTAL_NAME}`);
  logger.info(`  Portal slug    : ${PORTAL_SLUG}`);
  logger.info(`  Portal ID      : ${portal.id}`);
  logger.info(`  Org plan ID    : ${plan.id}`);
  logger.info(`  Mentors linked : ${finalMentors}`);
  logger.info(`  Mentees linked : ${finalMentees}`);
  logger.info('');
  logger.info('  Pastor login');
  logger.info(`    Email        : ${PASTOR_EMAIL}`);
  logger.info(`    Password     : ${PASTOR_PASSWORD}`);
  logger.info('');
  logger.info('  Pastor portal URL');
  logger.info(`    http://localhost:8080/church/${PORTAL_SLUG}/login`);
  logger.info(`    http://localhost:8080/church/${PORTAL_SLUG}/billing`);
  logger.info('─────────────────────────────────────────────');

  await AppDataSource.destroy();
}

main().catch((err) => {
  logger.error('Seed failed', err instanceof Error ? err : new Error(String(err)));
  process.exit(1);
});
