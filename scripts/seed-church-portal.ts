/**
 * Seeds a complete church portal for local testing.
 *
 * Creates:
 *   1. A ChurchPortal  (slug: "grace-bible")
 *   2. A ChurchPortalUser / pastor login  (email: pastor@grace-bible.com / password: Password123!)
 *   3. Links 3 existing mentors + 5 existing mentees to the portal
 *      (picks real users from the DB so the pastor dashboard has live data)
 *
 * Usage:
 *   npm run seed:church-portal
 *
 * Re-running is safe — skips creation if the slug already exists.
 */

import 'reflect-metadata';
import bcrypt from 'bcryptjs';
import { AppDataSource } from '../src/config/data-source';
import { ChurchPortal } from '../src/church-portal/entities/churchPortal.entity';
import { ChurchPortalUser } from '../src/church-portal/entities/churchPortalUser.entity';
import { User } from '../src/database/entities/user.entity';
import { USER_ROLE, MENTOR_APPROVAL_STATUS } from '../src/common/constants';
import { Logger } from '../src/common';

const logger = new Logger({ service: 'seed-church-portal', level: 'info' });

const PORTAL_SLUG        = 'grace-bible';
const PORTAL_NAME        = 'Grace Bible Church';
const PASTOR_EMAIL       = 'pastor@grace-bible.com';
const PASTOR_PASSWORD    = 'Password123!';
const MENTOR_COUNT       = 3;
const MENTEE_COUNT       = 5;

async function main() {
  await AppDataSource.initialize();
  logger.info('Database connected');

  const portalRepo      = AppDataSource.getRepository(ChurchPortal);
  const portalUserRepo  = AppDataSource.getRepository(ChurchPortalUser);
  const userRepo        = AppDataSource.getRepository(User);

  // ── 1. Church Portal ────────────────────────────────────────────────────────
  let portal = await portalRepo.findOne({ where: { slug: PORTAL_SLUG } });

  if (portal) {
    logger.info(`Portal already exists — skipping creation (id: ${portal.id})`);
  } else {
    portal = portalRepo.create({
      name:         PORTAL_NAME,
      slug:         PORTAL_SLUG,
      denomination: 'Non-Denominational',
      city:         'Lagos',
      country:      'Nigeria',
      timezone:     'Africa/Lagos',
      status:       'active',
    });
    await portalRepo.save(portal);
    logger.info(`✅ Church portal created — slug: ${PORTAL_SLUG}  id: ${portal.id}`);
  }

  // ── 2. Pastor Login ─────────────────────────────────────────────────────────
  let pastor = await portalUserRepo.findOne({ where: { email: PASTOR_EMAIL } });

  if (pastor) {
    logger.info(`Pastor user already exists — skipping (id: ${pastor.id})`);
  } else {
    const hashed = await bcrypt.hash(PASTOR_PASSWORD, 12);
    pastor = portalUserRepo.create({
      churchPortalId: portal.id,
      email:          PASTOR_EMAIL,
      password:       hashed,
      firstName:      'Samuel',
      lastName:       'Adeyemi',
      role:           'pastor',
      isActive:       true,
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
        await userRepo.update(mentor.id, { churchPortalId: portal.id });
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
        await userRepo.update(mentee.id, { churchPortalId: portal.id });
      }
      logger.info(`✅ Linked ${mentees.length} mentee(s) to the portal`);
    }
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  const finalMentors = await userRepo.count({ where: { churchPortalId: portal.id, role: USER_ROLE.MENTOR } });
  const finalMentees = await userRepo.count({ where: { churchPortalId: portal.id, role: USER_ROLE.MENTEE } });

  logger.info('');
  logger.info('─────────────────────────────────────────────');
  logger.info('  Church Portal Seed Complete');
  logger.info('─────────────────────────────────────────────');
  logger.info(`  Portal name    : ${PORTAL_NAME}`);
  logger.info(`  Portal slug    : ${PORTAL_SLUG}`);
  logger.info(`  Portal ID      : ${portal.id}`);
  logger.info(`  Mentors linked : ${finalMentors}`);
  logger.info(`  Mentees linked : ${finalMentees}`);
  logger.info('');
  logger.info('  Pastor login');
  logger.info(`    Email        : ${PASTOR_EMAIL}`);
  logger.info(`    Password     : ${PASTOR_PASSWORD}`);
  logger.info('');
  logger.info('  Pastor portal URL');
  logger.info(`    http://localhost:5173/church/${PORTAL_SLUG}/login`);
  logger.info('─────────────────────────────────────────────');

  await AppDataSource.destroy();
}

main().catch((err) => {
  logger.error('Seed failed', err instanceof Error ? err : new Error(String(err)));
  process.exit(1);
});
