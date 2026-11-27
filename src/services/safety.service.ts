import { In, IsNull, MoreThan } from 'typeorm';
import { StatusCodes } from 'http-status-codes';
import { AppDataSource } from '@/config/data-source';
import { logger } from '@/config/int-services';
import { AppError } from '@/common';
import {
  ConversationParticipant,
  MenteeReport,
  MenteeProfile,
  MentorProfile,
  Message,
  PARTICIPANT_STATUS,
  User,
  UserBlock,
} from '@/database/entities';
import { Session, SESSION_STATUS } from '@/database/entities/session.entity';
import { MentorshipRequest, MENTORSHIP_REQUEST_STATUS } from '@/database/entities/mentorshipRequest.entity';
import { AppNotificationType } from '@/database/entities/appNotification.entity';
import {
  buildReportContext,
  cleanReportDetails,
  isReportReason,
  MAX_REPORTS_PER_DAY,
  REPORT_CONTEXT_MESSAGES,
  REPORT_REASONS,
  REPORT_SOURCES,
  sessionsReviewAfterUnblock,
  sessionsReviewFor,
  type ContextMessage,
  type ReportSource,
} from '@/common/safety';
import { adminAlertService } from './adminAlert.service';
import { adminAuditService } from './adminAudit.service';
import { getAppNotificationService } from './appNotification.service';
import { pushNotificationService } from './pushNotification.service';
import { formatSessionTime } from './emailHelper';

/** Sessions that still lie ahead: requested or confirmed, not yet started */
const UPCOMING_STATUSES = [SESSION_STATUS.SCHEDULED, SESSION_STATUS.CONFIRMED];

export const BLOCKED_ERROR_CODE = 'USER_BLOCKED';

const toContextMessage = (m: Message): ContextMessage => ({
  id: m.id,
  senderId: m.senderId,
  content: m.content,
  type: String(m.type),
  sentAt: (m.sentAt ?? m.createdAt).toISOString(),
});

export class SafetyService {
  private blocks = () => AppDataSource.getRepository(UserBlock);

  // ─── Checks used across the app ─────────────────────────────────────────────

  /** True if either person has blocked the other (a block works both ways) */
  async isBlockedBetween(a: string, b: string): Promise<boolean> {
    if (!a || !b || a === b) return false;
    const count = await this.blocks().count({
      where: [
        { blockerId: a, blockedId: b, unblockedAt: IsNull() },
        { blockerId: b, blockedId: a, unblockedAt: IsNull() },
      ],
    });
    return count > 0;
  }

  /** Throws 403 USER_BLOCKED when the two can't interact */
  async assertNotBlocked(a: string, b: string, message = "You can't contact this person."): Promise<void> {
    if (await this.isBlockedBetween(a, b)) {
      throw new AppError(message, StatusCodes.FORBIDDEN, BLOCKED_ERROR_CODE);
    }
  }

  /** Everyone this person blocked or was blocked by */
  async blockedIdsFor(userId: string): Promise<string[]> {
    const rows = await this.blocks().find({
      where: [
        { blockerId: userId, unblockedAt: IsNull() },
        { blockedId: userId, unblockedAt: IsNull() },
      ],
      select: ['blockerId', 'blockedId'],
    });
    return [...new Set(rows.map((r) => (r.blockerId === userId ? r.blockedId : r.blockerId)))];
  }

  /**
   * A message into a one-to-one conversation is refused when either side blocked the other.
   * Group conversations aren't affected (blocking one member can't silence a whole group).
   */
  async assertCanMessageConversation(conversationId: string, senderId: string): Promise<void> {
    const others = await AppDataSource.getRepository(ConversationParticipant).find({
      where: { conversationId, status: PARTICIPANT_STATUS.ACTIVE },
      select: ['userId'],
    });
    const otherIds = others.map((p) => p.userId).filter((id) => id !== senderId);
    if (otherIds.length !== 1) return;
    await this.assertNotBlocked(senderId, otherIds[0], "You can't send messages in this conversation.");
  }

  // ─── Blocking ────────────────────────────────────────────────────────────────

  async block(blockerId: string, blockedId: string) {
    if (blockerId === blockedId) {
      throw new AppError("You can't block yourself.", StatusCodes.BAD_REQUEST);
    }
    const target = await AppDataSource.getRepository(User).findOne({
      where: { id: blockedId },
      select: ['id', 'firstName', 'lastName'],
    });
    if (!target) throw new AppError('User not found', StatusCodes.NOT_FOUND);

    const existing = await this.blocks().findOne({ where: { blockerId, blockedId } });
    if (existing && !existing.unblockedAt) return existing;

    // Sessions still booked between them wait for an admin to cancel or keep them
    const upcoming = await AppDataSource.getRepository(Session).find({
      where: [
        { mentorId: blockerId, menteeId: blockedId, status: In(UPCOMING_STATUSES), scheduledAt: MoreThan(new Date()) },
        { mentorId: blockedId, menteeId: blockerId, status: In(UPCOMING_STATUSES), scheduledAt: MoreThan(new Date()) },
      ],
      select: ['id'],
    });

    const row = existing ?? this.blocks().create({ blockerId, blockedId });
    row.blockedAt = new Date();
    row.unblockedAt = null;
    row.sessionsReview = sessionsReviewFor(upcoming.length);
    row.affectedSessionIds = upcoming.length ? upcoming.map((s) => s.id) : null;
    row.reviewedByAdminId = null;
    row.reviewedAt = null;
    row.reviewNotes = null;
    const saved = await this.blocks().save(row);

    // Open mentorship requests between them go away quietly
    const requests = AppDataSource.getRepository(MentorshipRequest);
    for (const [mentorId, menteeId] of [[blockerId, blockedId], [blockedId, blockerId]]) {
      await requests
        .update(
          { mentorId, menteeId, status: MENTORSHIP_REQUEST_STATUS.PENDING },
          { status: MENTORSHIP_REQUEST_STATUS.CANCELLED },
        )
        .catch((error) => logger.error('Failed to cancel a request after a block', error));
    }

    logger.info('User blocked another user', {
      blockerId,
      blockedId,
      upcomingSessions: upcoming.length,
    });

    if (upcoming.length) {
      void adminAlertService.notify('safety', {
        title: 'Block needs a session review',
        body: `A block affects ${upcoming.length} upcoming session${upcoming.length === 1 ? '' : 's'}. Cancel or keep them.`,
        link: `/safety?tab=blocks&id=${saved.id}`,
      });
    }
    return saved;
  }

  async unblock(blockerId: string, blockedId: string): Promise<void> {
    const existing = await this.blocks().findOne({ where: { blockerId, blockedId } });
    if (!existing || existing.unblockedAt) return;
    existing.unblockedAt = new Date();
    existing.sessionsReview = sessionsReviewAfterUnblock(existing.sessionsReview);
    await this.blocks().save(existing);
    logger.info('User unblocked another user', { blockerId, blockedId });
  }

  /** People this person has blocked, newest first */
  async listMyBlocks(blockerId: string) {
    const rows = await this.blocks()
      .createQueryBuilder('b')
      .innerJoin('b.blocked', 'u')
      .addSelect(['u.id', 'u.firstName', 'u.lastName', 'u.role'])
      .where('b.blockerId = :blockerId AND b.unblockedAt IS NULL', { blockerId })
      .orderBy('b.blockedAt', 'DESC')
      .getMany();
    // Photos live on the mentor/mentee profiles, not on users
    const ids = rows.map((b) => b.blockedId);
    const photos = new Map<string, string>();
    if (ids.length) {
      for (const repo of [MentorProfile, MenteeProfile] as const) {
        const profiles = await AppDataSource.getRepository(repo as any).find({
          where: { userId: In(ids) } as any,
          select: ['userId', 'profileImage'] as any,
        });
        for (const p of profiles as any[]) if (p.profileImage && !photos.has(p.userId)) photos.set(p.userId, p.profileImage);
      }
    }
    return rows.map((b) => ({
      userId: b.blockedId,
      firstName: b.blocked?.firstName ?? '',
      lastName: b.blocked?.lastName ?? '',
      profileImage: photos.get(b.blockedId) ?? null,
      role: b.blocked?.role ?? null,
      blockedAt: b.blockedAt,
    }));
  }

  /** For one other person: did I block them, did they block me */
  async blockStatus(viewerId: string, otherId: string) {
    const rows = await this.blocks().find({
      where: [
        { blockerId: viewerId, blockedId: otherId, unblockedAt: IsNull() },
        { blockerId: otherId, blockedId: viewerId, unblockedAt: IsNull() },
      ],
      select: ['blockerId'],
    });
    return {
      blockedByMe: rows.some((r) => r.blockerId === viewerId),
      blockedMe: rows.some((r) => r.blockerId === otherId),
    };
  }

  // ─── Reports ─────────────────────────────────────────────────────────────────

  async report(
    reporterId: string,
    input: {
      reportedUserId: string;
      reason: string;
      details?: string;
      source?: string;
      messageId?: string;
      conversationId?: string;
      sessionId?: string;
    },
  ) {
    if (!isReportReason(input.reason)) {
      throw new AppError('Choose a reason for the report.', StatusCodes.BAD_REQUEST);
    }
    if (input.reportedUserId === reporterId) {
      throw new AppError("You can't report yourself.", StatusCodes.BAD_REQUEST);
    }
    const reported = await AppDataSource.getRepository(User).findOne({
      where: { id: input.reportedUserId },
      select: ['id', 'firstName', 'lastName'],
    });
    if (!reported) throw new AppError('User not found', StatusCodes.NOT_FOUND);

    const reportRepo = AppDataSource.getRepository(MenteeReport);
    const today = await reportRepo.count({
      where: { reporterId, createdAt: MoreThan(new Date(Date.now() - 86_400_000)) },
    });
    if (today >= MAX_REPORTS_PER_DAY) {
      throw new AppError(
        "You've sent a lot of reports today. Please contact support if something urgent is happening.",
        StatusCodes.TOO_MANY_REQUESTS,
      );
    }

    // A reported message must be the reported person's, in a conversation the reporter is in
    let context: MenteeReport['context'] = null;
    let conversationId: string | null = null;
    if (input.messageId) {
      const message = await AppDataSource.getRepository(Message).findOne({ where: { id: input.messageId } });
      if (!message || message.senderId !== input.reportedUserId) {
        throw new AppError('Message not found', StatusCodes.NOT_FOUND);
      }
      const inConversation = await AppDataSource.getRepository(ConversationParticipant).count({
        where: { conversationId: message.conversationId, userId: reporterId },
      });
      if (!inConversation) throw new AppError('Message not found', StatusCodes.NOT_FOUND);
      conversationId = message.conversationId;
      context = await this.messageContext(message);
    } else if (input.conversationId) {
      const inConversation = await AppDataSource.getRepository(ConversationParticipant).count({
        where: { conversationId: input.conversationId, userId: reporterId },
      });
      if (inConversation) {
        conversationId = input.conversationId;
        context = await this.latestMessagesContext(input.conversationId);
      }
    }

    const source: ReportSource | null = (REPORT_SOURCES as readonly string[]).includes(input.source ?? '')
      ? (input.source as ReportSource)
      : input.messageId
        ? 'message'
        : null;

    const report = await reportRepo.save(
      reportRepo.create({
        reporterId,
        reportedUserId: input.reportedUserId,
        reason: input.reason,
        details: cleanReportDetails(input.details),
        sessionId: input.sessionId ?? null,
        source,
        messageId: input.messageId ?? null,
        conversationId,
        context,
        status: 'open',
      }),
    );

    logger.info('User report received', { reportId: report.id, reason: input.reason, source });
    void adminAlertService.notify('safety', {
      title: 'New user report',
      body: `${REPORT_REASONS[input.reason]}. Please review it within 24 hours.`,
      link: `/safety?tab=reports&id=${report.id}`,
    });
    return { id: report.id };
  }

  private async messageContext(message: Message) {
    const repo = AppDataSource.getRepository(Message);
    const base = repo
      .createQueryBuilder('m')
      .where('m.conversationId = :cid', { cid: message.conversationId })
      .andWhere('m.id != :id', { id: message.id });
    const before = await base
      .clone()
      .andWhere('m.sentAt <= :at', { at: message.sentAt })
      .orderBy('m.sentAt', 'DESC')
      .take(REPORT_CONTEXT_MESSAGES)
      .getMany();
    const after = await base
      .clone()
      .andWhere('m.sentAt > :at', { at: message.sentAt })
      .orderBy('m.sentAt', 'ASC')
      .take(REPORT_CONTEXT_MESSAGES)
      .getMany();
    return buildReportContext(before.map(toContextMessage), toContextMessage(message), after.map(toContextMessage));
  }

  /** A whole-conversation report keeps the latest messages */
  private async latestMessagesContext(conversationId: string) {
    const latest = await AppDataSource.getRepository(Message).find({
      where: { conversationId },
      order: { sentAt: 'DESC' },
      take: REPORT_CONTEXT_MESSAGES * 2,
    });
    if (!latest.length) return null;
    const [newest, ...older] = latest;
    return buildReportContext(older.map(toContextMessage), toContextMessage(newest), []);
  }

  // ─── Admin: the sessions a block affects ─────────────────────────────────────

  async listBlocksForAdmin(params: { review?: string; page?: number; limit?: number }) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const qb = this.blocks()
      .createQueryBuilder('b')
      .leftJoin('b.blocker', 'blocker')
      .leftJoin('b.blocked', 'blocked')
      .addSelect(['blocker.id', 'blocker.firstName', 'blocker.lastName', 'blocker.email', 'blocker.role', 'blocker.accountStatus', 'blocker.isActive'])
      .addSelect(['blocked.id', 'blocked.firstName', 'blocked.lastName', 'blocked.email', 'blocked.role', 'blocked.accountStatus', 'blocked.isActive'])
      // Plain column order: TypeORM's paging with joins breaks on expression ordering
      .orderBy('b.blockedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);
    if (params.review && params.review !== 'all') {
      qb.where('b.sessionsReview = :review', { review: params.review });
    }
    const [rows, total] = await qb.getManyAndCount();

    const sessionIds = rows.flatMap((b) => b.affectedSessionIds ?? []);
    const sessions = sessionIds.length
      ? await AppDataSource.getRepository(Session).find({
          where: { id: In(sessionIds) },
          select: ['id', 'scheduledAt', 'status', 'duration', 'mentorId', 'menteeId', 'title'],
        })
      : [];
    const byId = new Map(sessions.map((s) => [s.id, s]));

    return {
      data: rows.map((b) => ({
        id: b.id,
        blocker: b.blocker ?? null,
        blocked: b.blocked ?? null,
        blockedAt: b.blockedAt,
        unblockedAt: b.unblockedAt ?? null,
        sessionsReview: b.sessionsReview,
        reviewedAt: b.reviewedAt ?? null,
        reviewedByAdminId: b.reviewedByAdminId ?? null,
        reviewNotes: b.reviewNotes ?? null,
        sessions: (b.affectedSessionIds ?? []).map((id) => byId.get(id)).filter(Boolean),
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async resolveBlockSessions(
    blockId: string,
    decision: 'cancel' | 'keep',
    adminUserId: string,
    notes?: string | null,
    ip?: string,
  ) {
    const block = await this.blocks().findOne({ where: { id: blockId } });
    if (!block) throw new AppError('Block not found', StatusCodes.NOT_FOUND);
    if (block.sessionsReview !== 'pending') {
      throw new AppError('These sessions have already been reviewed.', StatusCodes.CONFLICT);
    }

    let cancelled = 0;
    if (decision === 'cancel') {
      const sessionRepo = AppDataSource.getRepository(Session);
      const sessions = await sessionRepo.find({
        where: {
          id: In(block.affectedSessionIds ?? []),
          status: In(UPCOMING_STATUSES),
          scheduledAt: MoreThan(new Date()),
        },
        relations: ['mentor', 'mentee'],
      });
      for (const session of sessions) {
        session.status = SESSION_STATUS.CANCELLED;
        session.cancelledAt = new Date();
        session.cancellationReason = 'Cancelled by the Spiriment team';
        await sessionRepo.save(session);
        cancelled++;
        // Both hear the same neutral message: nobody is told about the block
        for (const person of [session.mentor, session.mentee]) {
          if (person) await this.notifySessionCancelled(session, person);
        }
      }
    }

    block.sessionsReview = decision === 'cancel' ? 'cancelled' : 'kept';
    block.reviewedByAdminId = adminUserId;
    block.reviewedAt = new Date();
    block.reviewNotes = notes?.trim() || null;
    await this.blocks().save(block);

    await adminAuditService.log({
      adminUserId,
      action: decision === 'cancel' ? 'admin.safety.block_sessions_cancel' : 'admin.safety.block_sessions_keep',
      targetType: 'user_block',
      targetId: blockId,
      metadata: { cancelled, notes: block.reviewNotes },
      ip: ip ?? null,
    });
    return { sessionsReview: block.sessionsReview, cancelled };
  }

  private async notifySessionCancelled(session: Session, person: User) {
    const when = formatSessionTime(session.scheduledAt, person.timezone);
    const body = `Your session on ${when} was cancelled by the Spiriment team. Contact support if you have questions.`;
    try {
      await getAppNotificationService().createNotification({
        userId: person.id,
        type: AppNotificationType.SESSION_DECLINED,
        title: 'Session cancelled',
        message: body,
        data: { sessionId: session.id, mentorId: session.mentorId, menteeId: session.menteeId },
      });
    } catch (error: any) {
      logger.error('Failed to notify about an admin-cancelled session', error);
    }
    try {
      if (person.pushToken) {
        await pushNotificationService.sendToUser({
          userId: person.id,
          pushToken: person.pushToken,
          title: 'Session cancelled',
          body,
          data: { type: 'session_status_update', status: 'cancelled', sessionId: session.id },
          channelId: 'session-reminders',
        });
      }
    } catch (error: any) {
      logger.error('Failed to push an admin-cancelled session', error);
    }
  }

  /** Counts for the admin sidebar badge */
  async adminSummary() {
    const [openReports, pendingBlockReviews] = await Promise.all([
      AppDataSource.getRepository(MenteeReport).count({ where: { status: In(['open', 'in_review']) } }),
      this.blocks().count({ where: { sessionsReview: 'pending' } }),
    ]);
    return { openReports, pendingBlockReviews };
  }
}

export const safetyService = new SafetyService();
