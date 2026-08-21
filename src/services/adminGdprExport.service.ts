import { validate as isUuid } from 'uuid';
import { In } from 'typeorm';
import { AppDataSource } from '@/config/data-source';
import { User } from '@/database/entities/user.entity';
import { MenteeProfile } from '@/database/entities/menteeProfile.entity';
import { MentorProfile } from '@/database/entities/mentorProfile.entity';
import { UserSubscription } from '@/database/entities/userSubscription.entity';
import { UserDiscount } from '@/database/entities/userDiscount.entity';
import { Session } from '@/database/entities/session.entity';
import { SessionReview } from '@/database/entities/sessionReview.entity';
import { MentorshipRequest } from '@/database/entities/mentorshipRequest.entity';
import { BibleProgress } from '@/database/entities/bibleProgress.entity';
import { StudyProgress } from '@/database/entities/studyProgress.entity';
import { BibleReflection } from '@/database/entities/bibleReflection.entity';
import { StudyReflection } from '@/database/entities/studyReflection.entity';
import { BibleBookmark } from '@/database/entities/bibleBookmark.entity';
import { BibleHighlight } from '@/database/entities/bibleHighlight.entity';
import { StudySession } from '@/database/entities/studySession.entity';
import { QuizAttempt } from '@/database/entities/quizAttempt.entity';
import { Message } from '@/database/entities/message.entity';
import { ConversationParticipant } from '@/database/entities/conversationParticipant.entity';
import { SupportTicket, SupportTicketMessage } from '@/database/entities/supportTicket.entity';
import { Referral } from '@/database/entities/referral.entity';
import { PromoCodeRedemption } from '@/database/entities/promoCodeRedemption.entity';
import { FamilyMember } from '@/database/entities/familyMember.entity';
import { GroupSessionParticipant } from '@/database/entities/groupSessionParticipant.entity';
import { AppNotification } from '@/database/entities/appNotification.entity';
import { MenteeReport } from '@/database/entities/menteeReport.entity';
import { MentorAvailability } from '@/database/entities/mentorAvailability.entity';
import { AppError } from '@/common';

const MESSAGE_CAP = 5000;

function iso(value?: Date | string | null): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function sanitizeUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName ?? null,
    middleName: user.middleName ?? null,
    lastName: user.lastName ?? null,
    gender: user.gender ?? null,
    birthday: iso(user.birthday),
    address: user.address ?? null,
    city: user.city ?? null,
    state: user.state ?? null,
    country: user.country ?? null,
    countryCode: user.countryCode ?? null,
    timezone: user.timezone,
    role: user.role ?? null,
    accountStatus: user.accountStatus,
    isActive: user.isActive,
    isEmailVerified: user.isEmailVerified,
    emailVerifiedAt: iso(user.emailVerifiedAt),
    isOnboardingComplete: user.isOnboardingComplete,
    mentorApprovalStatus: user.mentorApprovalStatus ?? null,
    mentorApprovedAt: iso(user.mentorApprovedAt),
    currentStreak: user.currentStreak,
    longestStreak: user.longestStreak,
    lastStreakDate: iso(user.lastStreakDate),
    weeklyStreakData: user.weeklyStreakData ?? null,
    monthlyStreakData: user.monthlyStreakData ?? null,
    streakFreezeCount: user.streakFreezeCount,
    notificationPreferences: user.notificationPreferences ?? null,
    lastActiveAt: iso(user.lastActiveAt),
    createdAt: iso(user.createdAt),
    updatedAt: iso(user.updatedAt),
    // Explicitly omitted: password, otpToken, googleId, appleId, pushToken, refresh tokens
  };
}

/**
 * Builds a GDPR-oriented personal data package for support / DSAR requests.
 * Secrets (password hashes, OTPs, OAuth ids, push tokens) are excluded.
 */
export class AdminGdprExportService {
  async buildPackage(userId: string): Promise<{
    buffer: Buffer;
    filename: string;
    email: string;
  }> {
    if (!isUuid(userId)) throw new AppError('Invalid user id', 400);

    const user = await AppDataSource.getRepository(User).findOne({
      where: { id: userId },
    });
    if (!user) throw new AppError('User not found', 404);

    const [
      menteeProfile,
      mentorProfile,
      subscriptions,
      discounts,
      sessionsAsMentee,
      sessionsAsMentor,
      sessionReviewsGiven,
      sessionReviewsReceived,
      mentorshipAsMentee,
      mentorshipAsMentor,
      bibleProgress,
      studyProgress,
      bibleReflections,
      studyReflections,
      bibleBookmarks,
      bibleHighlights,
      studySessions,
      quizAttempts,
      conversations,
      messagesSent,
      messageCount,
      supportTickets,
      referralsMade,
      referralReceived,
      promoRedemptions,
      familyMemberships,
      groupParticipations,
      notifications,
      reportsFiled,
      reportsAgainst,
      availability,
    ] = await Promise.all([
      AppDataSource.getRepository(MenteeProfile).findOne({ where: { userId } }),
      AppDataSource.getRepository(MentorProfile).findOne({ where: { userId } }),
      AppDataSource.getRepository(UserSubscription).find({
        where: { userId },
        order: { createdAt: 'DESC' },
      }),
      AppDataSource.getRepository(UserDiscount).find({
        where: { userId },
        order: { createdAt: 'DESC' },
      }),
      AppDataSource.getRepository(Session).find({
        where: { menteeId: userId },
        order: { scheduledAt: 'DESC' },
      }),
      AppDataSource.getRepository(Session).find({
        where: { mentorId: userId },
        order: { scheduledAt: 'DESC' },
      }),
      AppDataSource.getRepository(SessionReview).find({
        where: { menteeId: userId },
        order: { createdAt: 'DESC' },
      }),
      AppDataSource.getRepository(SessionReview).find({
        where: { mentorId: userId },
        order: { createdAt: 'DESC' },
      }),
      AppDataSource.getRepository(MentorshipRequest).find({
        where: { menteeId: userId },
        order: { createdAt: 'DESC' },
      }),
      AppDataSource.getRepository(MentorshipRequest).find({
        where: { mentorId: userId },
        order: { createdAt: 'DESC' },
      }),
      AppDataSource.getRepository(BibleProgress).find({ where: { userId } }),
      AppDataSource.getRepository(StudyProgress).find({ where: { userId } }),
      AppDataSource.getRepository(BibleReflection).find({
        where: { userId },
        order: { createdAt: 'DESC' },
      }),
      AppDataSource.getRepository(StudyReflection).find({
        where: { userId },
        order: { createdAt: 'DESC' },
      }),
      AppDataSource.getRepository(BibleBookmark).find({ where: { userId } }),
      AppDataSource.getRepository(BibleHighlight).find({ where: { userId } }),
      AppDataSource.getRepository(StudySession).find({
        where: { userId },
        order: { createdAt: 'DESC' },
        take: 500,
      }),
      AppDataSource.getRepository(QuizAttempt).find({
        where: { userId },
        order: { createdAt: 'DESC' },
      }),
      AppDataSource.getRepository(ConversationParticipant).find({
        where: { userId },
      }),
      AppDataSource.getRepository(Message).find({
        where: { senderId: userId },
        order: { createdAt: 'DESC' },
        take: MESSAGE_CAP,
      }),
      AppDataSource.getRepository(Message).count({ where: { senderId: userId } }),
      AppDataSource.getRepository(SupportTicket).find({
        where: { userId },
        order: { createdAt: 'DESC' },
      }),
      AppDataSource.getRepository(Referral).find({
        where: { referrerId: userId },
      }),
      AppDataSource.getRepository(Referral).findOne({
        where: { referredUserId: userId },
      }),
      AppDataSource.getRepository(PromoCodeRedemption).find({
        where: { user: { id: userId } },
        order: { createdAt: 'DESC' },
        relations: ['promoCode'],
      }),
      AppDataSource.getRepository(FamilyMember).find({ where: { userId } }),
      AppDataSource.getRepository(GroupSessionParticipant).find({
        where: { menteeId: userId },
      }),
      AppDataSource.getRepository(AppNotification).find({
        where: { userId },
        order: { createdAt: 'DESC' },
        take: 500,
      }),
      AppDataSource.getRepository(MenteeReport).find({
        where: { reporterId: userId },
      }),
      AppDataSource.getRepository(MenteeReport).find({
        where: { reportedUserId: userId },
      }),
      AppDataSource.getRepository(MentorAvailability).find({
        where: { mentorId: userId },
      }),
    ]);

    const ticketIds = supportTickets.map((t) => t.id);
    const ticketMessages =
      ticketIds.length === 0
        ? []
        : await AppDataSource.getRepository(SupportTicketMessage).find({
            where: { ticketId: In(ticketIds) },
            order: { createdAt: 'ASC' },
          });

    const packagePayload = {
      exportMeta: {
        type: 'spiriment_gdpr_user_data_package',
        version: 1,
        generatedAt: new Date().toISOString(),
        subjectUserId: userId,
        subjectEmail: user.email,
        notes: [
          'Prepared for data subject access / support requests under GDPR-style principles.',
          'Secrets excluded: password hashes, OTP codes, OAuth provider ids, push tokens, refresh tokens.',
          messageCount > MESSAGE_CAP
            ? `Messages truncated to the ${MESSAGE_CAP} most recent of ${messageCount} sent by this user.`
            : null,
        ].filter(Boolean),
      },
      account: sanitizeUser(user),
      profiles: {
        mentee: menteeProfile ?? null,
        mentor: mentorProfile
          ? {
              ...mentorProfile,
              // Keep agreement / profile fields; no secrets on this entity
            }
          : null,
      },
      subscriptions,
      discounts,
      sessions: {
        asMentee: sessionsAsMentee,
        asMentor: sessionsAsMentor,
      },
      sessionReviews: {
        writtenAsMentee: sessionReviewsGiven,
        receivedAsMentor: sessionReviewsReceived,
      },
      mentorshipRequests: {
        asMentee: mentorshipAsMentee,
        asMentor: mentorshipAsMentor,
      },
      bibleAndStudy: {
        bibleProgress,
        studyProgress,
        bibleReflections,
        studyReflections,
        bibleBookmarks,
        bibleHighlights,
        recentStudySessions: studySessions,
      },
      quizzes: { attempts: quizAttempts },
      messaging: {
        conversationsParticipated: conversations,
        messagesSent,
        messagesSentTotal: messageCount,
        messagesSentIncluded: messagesSent.length,
      },
      support: {
        tickets: supportTickets,
        ticketMessages,
      },
      referrals: {
        made: referralsMade,
        receivedAsReferredUser: referralReceived,
      },
      promoCodeRedemptions: promoRedemptions,
      familyMemberships,
      groupSessionParticipations: groupParticipations,
      appNotifications: notifications,
      reports: {
        filedByUser: reportsFiled,
        filedAgainstUser: reportsAgainst,
      },
      mentorAvailability: availability,
    };

    const buffer = Buffer.from(JSON.stringify(packagePayload, null, 2), 'utf-8');
    const emailSlug = user.email.replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 40);
    const dateSlug = new Date().toISOString().slice(0, 10);
    const filename = `spiriment-gdpr-${emailSlug}-${dateSlug}.json`;

    return { buffer, filename, email: user.email };
  }
}

export const adminGdprExportService = new AdminGdprExportService();
