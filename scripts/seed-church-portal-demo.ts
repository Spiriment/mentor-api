import 'reflect-metadata';
import bcrypt from 'bcryptjs';
import { AppDataSource } from '../src/config/data-source';
import { USER_ROLE, MENTOR_APPROVAL_STATUS } from '../src/common/constants/options';
import { ChurchPortal, CHURCH_PORTAL_STATUS } from '../src/church-portal/entities/churchPortal.entity';
import {
  ChurchPortalUser,
  CHURCH_PORTAL_USER_ROLE,
} from '../src/church-portal/entities/churchPortalUser.entity';
import { User } from '../src/database/entities/user.entity';
import {
  Session,
  SESSION_DURATION,
  SESSION_STATUS,
  SESSION_TYPE,
} from '../src/database/entities/session.entity';
import {
  MentorshipRequest,
  MENTORSHIP_REQUEST_STATUS,
} from '../src/database/entities/mentorshipRequest.entity';

const PORTAL_SLUG = 'grace-bible';
const PORTAL_NAME = 'Grace Bible Church';
const DEFAULT_CP_PASSWORD = 'Password123!';

type SeedUserInput = {
  email: string;
  firstName: string;
  lastName: string;
  role: USER_ROLE;
  gender: 'male' | 'female';
  city: string;
  currentStreak: number;
  longestStreak: number;
  lastActiveAt: Date;
};

async function upsertPortal() {
  const repo = AppDataSource.getRepository(ChurchPortal);
  let portal = await repo.findOne({ where: { slug: PORTAL_SLUG } });

  if (!portal) {
    portal = repo.create({
      name: PORTAL_NAME,
      slug: PORTAL_SLUG,
      denomination: 'Non-Denominational',
      city: 'Lagos',
      country: 'Nigeria',
      timezone: 'Africa/Lagos',
      status: CHURCH_PORTAL_STATUS.ACTIVE,
    });
  } else {
    portal.name = PORTAL_NAME;
    portal.status = CHURCH_PORTAL_STATUS.ACTIVE;
  }

  return repo.save(portal) as Promise<ChurchPortal & { id: string }>;
}

async function upsertPortalLoginUser(churchPortalId: string) {
  const repo = AppDataSource.getRepository(ChurchPortalUser);
  const hashedPassword = await bcrypt.hash(DEFAULT_CP_PASSWORD, 12);

  let user = await repo.findOne({
    where: { email: 'pastor@gracebible.org', churchPortalId },
  });

  if (!user) {
    user = repo.create({
      churchPortalId,
      email: 'pastor@gracebible.org',
      firstName: 'Samuel',
      lastName: 'Adebayo',
      role: CHURCH_PORTAL_USER_ROLE.PASTOR,
      isActive: true,
      password: hashedPassword,
    });
  } else {
    user.firstName = 'Samuel';
    user.lastName = 'Adebayo';
    user.role = CHURCH_PORTAL_USER_ROLE.PASTOR;
    user.isActive = true;
    user.password = hashedPassword;
  }

  return repo.save(user);
}

async function upsertMember(input: SeedUserInput, churchPortalId: string) {
  const repo = AppDataSource.getRepository(User);
  let user = await repo.findOne({ where: { email: input.email } });

  if (!user) {
    user = new User();
    user.email = input.email;
  } else {
    user.email = input.email;
  }

  user.firstName = input.firstName;
  user.lastName = input.lastName;
  user.role = input.role;
  user.gender = input.gender as any;
  user.city = input.city;
  user.country = 'Nigeria';
  user.countryCode = 'NG';
  user.timezone = 'Africa/Lagos';
  user.currentStreak = input.currentStreak;
  user.longestStreak = input.longestStreak;
  user.lastActiveAt = input.lastActiveAt;
  user.isOnboardingComplete = true;
  user.churchPortalId = churchPortalId;
  user.isActive = true;
  user.accountStatus = 'active';
  user.isEmailVerified = true;
  user.emailVerifiedAt = new Date();
  user.weeklyStreakData = [true, true, false, true, true, false, true];
  user.monthlyStreakData = { '2026-04': [1, 2, 3, 5, 7, 9, 12] };
  if (input.role === USER_ROLE.MENTOR) {
    user.mentorApprovalStatus = MENTOR_APPROVAL_STATUS.APPROVED;
    user.mentorApprovedAt = new Date();
  }

  return repo.save(user);
}

async function seedMentorshipRequests(mentorIds: string[], menteeIds: string[]) {
  const repo = AppDataSource.getRepository(MentorshipRequest);

  for (let i = 0; i < menteeIds.length; i++) {
    const mentorId = mentorIds[i % mentorIds.length];
    const menteeId = menteeIds[i];

    let req = await repo.findOne({ where: { mentorId, menteeId } });
    if (!req) {
      req = repo.create({
        mentorId,
        menteeId,
        status: MENTORSHIP_REQUEST_STATUS.ACCEPTED,
        message: 'I would love to grow in consistency and prayer life.',
        responseMessage: 'Happy to mentor you. Let us begin this week.',
        respondedAt: new Date(),
      });
    } else {
      req.status = MENTORSHIP_REQUEST_STATUS.ACCEPTED;
      req.responseMessage = 'Happy to mentor you. Let us begin this week.';
      req.respondedAt = new Date();
    }
    await repo.save(req);
  }
}

async function reseedSessions(mentorIds: string[], menteeIds: string[]) {
  const repo = AppDataSource.getRepository(Session);

  await repo
    .createQueryBuilder()
    .delete()
    .from(Session)
    .where('mentorId IN (:...mentorIds)', { mentorIds })
    .andWhere('menteeId IN (:...menteeIds)', { menteeIds })
    .execute();

  const now = new Date();
  const rows: Session[] = [];

  for (let i = 0; i < menteeIds.length; i++) {
    const mentorId = mentorIds[i % mentorIds.length];
    const menteeId = menteeIds[i];

    // Completed session (for activity feed + counts)
    rows.push(
      repo.create({
        mentorId,
        menteeId,
        status: SESSION_STATUS.COMPLETED,
        type: SESSION_TYPE.VIDEO_CALL,
        duration: SESSION_DURATION.ONE_HOUR,
        scheduledAt: new Date(now.getTime() - (i + 2) * 24 * 60 * 60 * 1000),
        startedAt: new Date(now.getTime() - (i + 2) * 24 * 60 * 60 * 1000 + 5 * 60 * 1000),
        endedAt: new Date(now.getTime() - (i + 2) * 24 * 60 * 60 * 1000 + 65 * 60 * 1000),
        title: `Discipleship Check-in ${i + 1}`,
        description: 'Weekly mentoring session focused on growth and accountability.',
        meetingLink: 'https://meet.google.com/grace-bible-mentoring',
        sessionSummary: 'Discussed prayer consistency, scripture meditation, and next action steps.',
        assignments: ['Read John 15', 'Pray 20 minutes daily', 'Submit reflection notes'],
      })
    );

    // Upcoming confirmed session
    rows.push(
      repo.create({
        mentorId,
        menteeId,
        status: SESSION_STATUS.CONFIRMED,
        type: SESSION_TYPE.VIDEO_CALL,
        duration: SESSION_DURATION.FORTY_FIVE_MINUTES,
        scheduledAt: new Date(now.getTime() + (i + 1) * 24 * 60 * 60 * 1000),
        title: `Upcoming Mentoring Session ${i + 1}`,
        description: 'Follow-up session for progress review.',
        meetingLink: 'https://meet.google.com/grace-bible-followup',
      })
    );
  }

  await repo.save(rows);
}

async function main() {
  await AppDataSource.initialize();
  console.log('✅ Connected to DB');

  const portal = await upsertPortal();
  await upsertPortalLoginUser(portal.id);

  const seedUsers: SeedUserInput[] = [
    {
      email: 'mentor.joshua@gracebible.org',
      firstName: 'Joshua',
      lastName: 'Nwosu',
      role: USER_ROLE.MENTOR,
      gender: 'male',
      city: 'Lagos',
      currentStreak: 18,
      longestStreak: 44,
      lastActiveAt: new Date(),
    },
    {
      email: 'mentor.ruth@gracebible.org',
      firstName: 'Ruth',
      lastName: 'Okafor',
      role: USER_ROLE.MENTOR,
      gender: 'female',
      city: 'Abuja',
      currentStreak: 12,
      longestStreak: 30,
      lastActiveAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    },
    {
      email: 'mentor.daniel@gracebible.org',
      firstName: 'Daniel',
      lastName: 'Eze',
      role: USER_ROLE.MENTOR,
      gender: 'male',
      city: 'Port Harcourt',
      currentStreak: 9,
      longestStreak: 21,
      lastActiveAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
    },
    {
      email: 'mentee.esther@gracebible.org',
      firstName: 'Esther',
      lastName: 'Aina',
      role: USER_ROLE.MENTEE,
      gender: 'female',
      city: 'Lagos',
      currentStreak: 7,
      longestStreak: 14,
      lastActiveAt: new Date(Date.now() - 60 * 60 * 1000),
    },
    {
      email: 'mentee.samuel@gracebible.org',
      firstName: 'Samuel',
      lastName: 'Ibe',
      role: USER_ROLE.MENTEE,
      gender: 'male',
      city: 'Ibadan',
      currentStreak: 5,
      longestStreak: 11,
      lastActiveAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
    },
    {
      email: 'mentee.peace@gracebible.org',
      firstName: 'Peace',
      lastName: 'Udo',
      role: USER_ROLE.MENTEE,
      gender: 'female',
      city: 'Lagos',
      currentStreak: 10,
      longestStreak: 18,
      lastActiveAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
    },
    {
      email: 'mentee.michael@gracebible.org',
      firstName: 'Michael',
      lastName: 'Bello',
      role: USER_ROLE.MENTEE,
      gender: 'male',
      city: 'Abuja',
      currentStreak: 3,
      longestStreak: 9,
      lastActiveAt: new Date(Date.now() - 8 * 60 * 60 * 1000),
    },
    {
      email: 'mentee.favor@gracebible.org',
      firstName: 'Favor',
      lastName: 'Adeyemi',
      role: USER_ROLE.MENTEE,
      gender: 'female',
      city: 'Ilorin',
      currentStreak: 6,
      longestStreak: 13,
      lastActiveAt: new Date(Date.now() - 9 * 60 * 60 * 1000),
    },
  ];

  const users: User[] = [];
  for (const input of seedUsers) {
    users.push(await upsertMember(input, portal.id));
  }

  const mentors = users.filter((u) => u.role === USER_ROLE.MENTOR);
  const mentees = users.filter((u) => u.role === USER_ROLE.MENTEE);

  await seedMentorshipRequests(
    mentors.map((m) => m.id),
    mentees.map((m) => m.id)
  );
  await reseedSessions(
    mentors.map((m) => m.id),
    mentees.map((m) => m.id)
  );

  console.log('✅ Church portal demo data seeded');
  console.log(`Portal URL: http://localhost:8080/church/${PORTAL_SLUG}/login`);
  console.log('Church portal login email: pastor@gracebible.org');
  console.log(`Church portal login password: ${DEFAULT_CP_PASSWORD}`);

  await AppDataSource.destroy();
}

main().catch(async (err) => {
  console.error('❌ Failed to seed church portal demo data:', err);
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
  process.exit(1);
});

