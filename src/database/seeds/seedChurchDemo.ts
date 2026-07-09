/**
 * Church portal demo seed — creates a realistic church with mentors, mentees,
 * sessions, and join requests for a client video walkthrough.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register src/database/seeds/seedChurchDemo.ts
 *
 * Safe to re-run: cleans up by slug before reinserting.
 */
import 'reflect-metadata';
import { AppDataSource } from '@/config/data-source';
import { ChurchPortal } from '@/church-portal/entities/churchPortal.entity';
import { ChurchPortalUser, CHURCH_PORTAL_USER_ROLE } from '@/church-portal/entities/churchPortalUser.entity';
import { ChurchPortalJoinRequest, CHURCH_JOIN_REQUEST_STATUS } from '@/church-portal/entities/churchPortalJoinRequest.entity';
import { User } from '@/database/entities/user.entity';
import { Session } from '@/database/entities/session.entity';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcryptjs';

const SLUG = 'grace-community-demo';
const JOIN_CODE = 'GRACE2025';
const PORTAL_PASSWORD = 'Demo1234!';

// ── Helpers ──────────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

function weeklyStreak(activeDays: number[]): boolean[] {
  // activeDays: 0=Sun … 6=Sat; returns 7-element array
  return [0, 1, 2, 3, 4, 5, 6].map(d => activeDays.includes(d));
}

// ── Seed ─────────────────────────────────────────────────────────────────────

async function seed() {
  await AppDataSource.initialize();
  console.log('✅ Database connected');

  const portalRepo = AppDataSource.getRepository(ChurchPortal);
  const cpUserRepo = AppDataSource.getRepository(ChurchPortalUser);
  const joinReqRepo = AppDataSource.getRepository(ChurchPortalJoinRequest);
  const userRepo = AppDataSource.getRepository(User);
  const sessionRepo = AppDataSource.getRepository(Session);

  // ── 1. Clean up previous demo run ──────────────────────────────────────────
  const existing = await portalRepo.findOne({ where: { slug: SLUG } });
  if (existing) {
    console.log('🧹 Removing previous demo data…');
    const oldUsers = await userRepo.find({ where: { churchPortalId: existing.id } });
    for (const u of oldUsers) {
      await sessionRepo.delete({ mentorId: u.id });
      await sessionRepo.delete({ menteeId: u.id });
    }
    await userRepo.delete({ churchPortalId: existing.id });
    await joinReqRepo.delete({ churchPortalId: existing.id });
    await cpUserRepo.delete({ churchPortalId: existing.id });
    await portalRepo.delete({ id: existing.id });
  }

  // ── 2. Create church portal ────────────────────────────────────────────────
  const portal = portalRepo.create({
    id: uuidv4(),
    name: 'Grace Community Church',
    slug: SLUG,
    denomination: 'Baptist',
    city: 'Lagos',
    country: 'Nigeria',
    timezone: 'Africa/Lagos',
    joinCode: JOIN_CODE,
    discountPercent: 20,
    status: 'active',
  });
  await portalRepo.save(portal);
  console.log(`⛪  Portal created: ${portal.name} (slug: ${portal.slug})`);

  // ── 3. Create church portal login users (pastor & deacon) ─────────────────
  const passwordHash = await bcrypt.hash(PORTAL_PASSWORD, 10);

  const pastor = cpUserRepo.create({
    id: uuidv4(),
    churchPortalId: portal.id,
    email: 'pastor@gracedemo.com',
    password: passwordHash,
    firstName: 'Samuel',
    lastName: 'Adeyemi',
    role: CHURCH_PORTAL_USER_ROLE.PASTOR,
    isActive: true,
    lastLoginAt: daysAgo(1),
  });
  await cpUserRepo.save(pastor);

  const deacon = cpUserRepo.create({
    id: uuidv4(),
    churchPortalId: portal.id,
    email: 'deacon@gracedemo.com',
    password: passwordHash,
    firstName: 'Grace',
    lastName: 'Okafor',
    role: CHURCH_PORTAL_USER_ROLE.DEACON,
    isActive: true,
  });
  await cpUserRepo.save(deacon);
  console.log(`👤 Portal users: pastor@gracedemo.com / deacon@gracedemo.com (password: ${PORTAL_PASSWORD})`);

  // ── 4. Create mentor app users ─────────────────────────────────────────────
  const mentorData = [
    { first: 'James', last: 'Okonkwo', email: 'james.okonkwo@demo.com', streak: 14, gender: 'male' },
    { first: 'Blessing', last: 'Nwachukwu', email: 'blessing.nwachukwu@demo.com', streak: 21, gender: 'female' },
    { first: 'Emmanuel', last: 'Adebayo', email: 'emmanuel.adebayo@demo.com', streak: 7, gender: 'male' },
    { first: 'Ruth', last: 'Eze', email: 'ruth.eze@demo.com', streak: 30, gender: 'female' },
  ];

  const mentors: User[] = [];
  for (const m of mentorData) {
    const u = userRepo.create({
      id: uuidv4(),
      email: m.email,
      firstName: m.first,
      lastName: m.last,
      role: 'mentor' as any,
      gender: m.gender as any,
      isEmailVerified: true,
      isOnboardingComplete: true,
      churchPortalId: portal.id,
      churchDiscountPercent: portal.discountPercent,
      currentStreak: m.streak,
      longestStreak: m.streak + Math.floor(Math.random() * 10),
      weeklyStreakData: weeklyStreak([1, 2, 3, 4, 5]),
      country: 'Nigeria',
      mentorApprovalStatus: 'approved' as any,
      lastActiveAt: daysAgo(1),
    });
    await userRepo.save(u);
    mentors.push(u);
  }
  console.log(`👨‍🏫 Created ${mentors.length} mentors`);

  // ── 5. Create mentee app users ─────────────────────────────────────────────
  const menteeData = [
    { first: 'David', last: 'Chukwu', email: 'david.chukwu@demo.com', streak: 5 },
    { first: 'Esther', last: 'Obi', email: 'esther.obi@demo.com', streak: 12 },
    { first: 'Joseph', last: 'Bello', email: 'joseph.bello@demo.com', streak: 3 },
    { first: 'Miriam', last: 'Afolabi', email: 'miriam.afolabi@demo.com', streak: 8 },
    { first: 'Daniel', last: 'Omotayo', email: 'daniel.omotayo@demo.com', streak: 0 },
    { first: 'Priscilla', last: 'Ogbonna', email: 'priscilla.ogbonna@demo.com', streak: 19 },
    { first: 'Philip', last: 'Taiwo', email: 'philip.taiwo@demo.com', streak: 6 },
    { first: 'Naomi', last: 'Umeh', email: 'naomi.umeh@demo.com', streak: 10 },
  ];

  const mentees: User[] = [];
  for (const m of menteeData) {
    const u = userRepo.create({
      id: uuidv4(),
      email: m.email,
      firstName: m.first,
      lastName: m.last,
      role: 'mentee' as any,
      isEmailVerified: true,
      isOnboardingComplete: true,
      churchPortalId: portal.id,
      churchDiscountPercent: portal.discountPercent,
      currentStreak: m.streak,
      longestStreak: m.streak + 5,
      weeklyStreakData: weeklyStreak([0, 1, 3, 5]),
      country: 'Nigeria',
      lastActiveAt: daysAgo(Math.floor(Math.random() * 3)),
    });
    await userRepo.save(u);
    mentees.push(u);
  }
  console.log(`🎓 Created ${mentees.length} mentees`);

  // ── 6. Create sessions ─────────────────────────────────────────────────────
  const sessionDefs = [
    // Completed past sessions
    { mentorIdx: 0, menteeIdx: 0, status: 'completed', daysOffset: -7, type: 'video_call', duration: 60, title: 'Faith and Identity' },
    { mentorIdx: 1, menteeIdx: 1, status: 'completed', daysOffset: -5, type: 'video_call', duration: 60, title: 'Prayer and Discipline' },
    { mentorIdx: 2, menteeIdx: 2, status: 'completed', daysOffset: -4, type: 'phone_call', duration: 30, title: 'Overcoming Doubt' },
    { mentorIdx: 3, menteeIdx: 3, status: 'completed', daysOffset: -3, type: 'video_call', duration: 60, title: 'Scripture Deep Dive' },
    { mentorIdx: 0, menteeIdx: 4, status: 'completed', daysOffset: -2, type: 'video_call', duration: 45, title: 'The Sermon on the Mount' },
    { mentorIdx: 1, menteeIdx: 5, status: 'completed', daysOffset: -1, type: 'video_call', duration: 60, title: 'Purpose and Calling' },
    // This week
    { mentorIdx: 2, menteeIdx: 6, status: 'confirmed', daysOffset: 1, type: 'video_call', duration: 60, title: 'Walk in the Spirit' },
    { mentorIdx: 3, menteeIdx: 7, status: 'confirmed', daysOffset: 2, type: 'video_call', duration: 60, title: 'Forgiveness and Grace' },
    { mentorIdx: 0, menteeIdx: 1, status: 'scheduled', daysOffset: 3, type: 'phone_call', duration: 30, title: 'Check-in Call' },
    { mentorIdx: 1, menteeIdx: 2, status: 'scheduled', daysOffset: 5, type: 'video_call', duration: 60, title: 'Spiritual Growth Review' },
  ];

  for (const def of sessionDefs) {
    const scheduledAt = daysOffset(def.daysOffset);
    const s: any = sessionRepo.create({
      id: uuidv4(),
      mentorId: mentors[def.mentorIdx].id,
      menteeId: mentees[def.menteeIdx].id,
      status: def.status as any,
      type: def.type as any,
      duration: def.duration as any,
      scheduledAt,
      title: def.title,
      menteeConfirmed: def.status !== 'scheduled',
      mentorConfirmed: def.status !== 'scheduled',
    });
    if (def.status === 'completed') {
      s.startedAt = scheduledAt;
      const end = new Date(scheduledAt);
      end.setMinutes(end.getMinutes() + def.duration);
      s.endedAt = end;
    }
    await sessionRepo.save(s);
  }
  console.log(`📅 Created ${sessionDefs.length} sessions`);

  // ── 7. Pending join requests ───────────────────────────────────────────────
  // A few mentees NOT yet in the church, requesting to join
  const pendingApplicants = [
    { first: 'Caleb', last: 'Nwosu', email: 'caleb.nwosu@demo.com' },
    { first: 'Hannah', last: 'Alabi', email: 'hannah.alabi@demo.com' },
    { first: 'Solomon', last: 'Oyelaran', email: 'solomon.oyelaran@demo.com' },
  ];

  for (const a of pendingApplicants) {
    // Create app user without churchPortalId
    const u = userRepo.create({
      id: uuidv4(),
      email: a.email,
      firstName: a.first,
      lastName: a.last,
      role: 'mentee' as any,
      isEmailVerified: true,
      isOnboardingComplete: true,
      currentStreak: 2,
      longestStreak: 5,
      country: 'Nigeria',
    });
    await userRepo.save(u);

    const req = joinReqRepo.create({
      id: uuidv4(),
      churchPortalId: portal.id,
      userId: u.id,
      status: CHURCH_JOIN_REQUEST_STATUS.PENDING,
    });
    await joinReqRepo.save(req);
  }
  console.log(`📬 Created ${pendingApplicants.length} pending join requests`);

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n🎉 Demo seed complete!\n');
  console.log('  Church portal URL:  /church/' + SLUG);
  console.log('  Login:              pastor@gracedemo.com  /  ' + PORTAL_PASSWORD);
  console.log('  Alt login:          deacon@gracedemo.com  /  ' + PORTAL_PASSWORD);
  console.log('  Join code:          ' + JOIN_CODE);
  console.log('  Members:            ' + mentors.length + ' mentors + ' + mentees.length + ' mentees');
  console.log('  Sessions:           ' + sessionDefs.length + ' (6 completed, 2 confirmed, 2 scheduled)');
  console.log('  Pending requests:   ' + pendingApplicants.length);

  await AppDataSource.destroy();
}

function daysOffset(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(10, 0, 0, 0);
  return d;
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
