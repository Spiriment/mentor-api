import { Brackets } from 'typeorm';
import { validate as isUuid } from 'uuid';
import { AppDataSource } from '@/config/data-source';
import { User } from '@/database/entities/user.entity';
import { MentorProfile } from '@/database/entities/mentorProfile.entity';
import { SessionReview } from '@/database/entities/sessionReview.entity';
import { Session, SESSION_STATUS } from '@/database/entities/session.entity';
import {
  AppError,
  Logger,
  USER_ROLE,
  ACCOUNT_STATUS,
} from '@/common';
import { MentorProfileService } from './mentorProfile.service';
import { getAppNotificationService } from './appNotification.service';
import { AppNotificationType } from '@/database/entities/appNotification.entity';
import { EmailService } from '@/core/email.service';
import { pushNotificationService } from './pushNotification.service';
import { adminAuditService } from './adminAudit.service';
import { adminSubscriptionService } from './adminSubscription.service';

const DEFAULT_PAGE = 1;
const MAX_LIMIT = 100;

let emailSingleton: EmailService | null = null;
function adminEmail(): EmailService {
  if (!emailSingleton) {
    emailSingleton = new EmailService(null);
  }
  return emailSingleton;
}

export class AdminMentorService {
  private logger = new Logger({
    service: 'admin-mentor-service',
    level: process.env.LOG_LEVEL || 'info',
  });

  private mentorProfileService = new MentorProfileService();

  async listMentors(params: {
    page?: number;
    limit?: number;
    sort?: string;
    search?: string;
    country?: string;
    accountStatus?: 'active' | 'suspended' | 'deleted' | 'all';
    approvedOnly?: boolean;
  }) {
    const page = Math.max(1, params.page ?? DEFAULT_PAGE);
    const limit = Math.min(MAX_LIMIT, Math.max(1, params.limit ?? 20));
    const skip = (page - 1) * limit;
    const approvedOnly = params.approvedOnly !== false;

    const qb = AppDataSource.getRepository(MentorProfile)
      .createQueryBuilder('mp')
      .innerJoinAndSelect('mp.user', 'user')
      .where('user.role = :role', { role: USER_ROLE.MENTOR });

    if (approvedOnly) {
      qb.andWhere('mp.isApproved = :ap', { ap: true });
      qb.andWhere('mp.isOnboardingComplete = :oc', { oc: true });
    }

    const st = params.accountStatus ?? 'all';
    if (st === 'active') {
      qb.andWhere('user.accountStatus = :as', { as: ACCOUNT_STATUS.ACTIVE });
      qb.andWhere('user.isActive = :ia', { ia: true });
    } else if (st === 'suspended') {
      qb.andWhere('user.accountStatus = :as', {
        as: ACCOUNT_STATUS.SUSPENDED,
      });
    } else if (st === 'deleted') {
      qb.andWhere('user.accountStatus = :as', {
        as: ACCOUNT_STATUS.DELETED,
      });
    }

    if (params.country) {
      qb.andWhere('user.country = :country', { country: params.country });
    }

    if (params.search?.trim()) {
      const term = `%${params.search.trim().replace(/[%_\\]/g, '')}%`;
      if (term.length > 2) {
        qb.andWhere(
          new Brackets((w) => {
            w.where('user.email LIKE :s', { s: term })
              .orWhere('user.firstName LIKE :s', { s: term })
              .orWhere('user.lastName LIKE :s', { s: term })
              .orWhere('mp.churchAffiliation LIKE :s', { s: term })
              .orWhere('mp.leadershipRoles LIKE :s', { s: term });
          })
        );
      }
    }

    const order = this.parseSort(params.sort);
    qb.orderBy(order.field, order.direction);

    const total = await qb.getCount();
    const rows = await qb.skip(skip).take(limit).getMany();

    const data = rows.map((mp) => ({
      userId: mp.userId,
      profileId: mp.id,
      user: {
        id: mp.user.id,
        email: mp.user.email,
        firstName: mp.user.firstName,
        lastName: mp.user.lastName,
        country: mp.user.country,
        accountStatus: mp.user.accountStatus,
        isActive: mp.user.isActive,
      },
      churchAffiliation: mp.churchAffiliation,
      isApproved: mp.isApproved,
      approvedAt: mp.approvedAt,
    }));

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    };
  }

  private parseSort(sort?: string): { field: string; direction: 'ASC' | 'DESC' } {
    const direction: 'ASC' | 'DESC' = sort?.startsWith('-') ? 'DESC' : 'ASC';
    const key = sort?.replace(/^-/, '') || 'approvedAt';
    const map: Record<string, string> = {
      createdAt: 'mp.createdAt',
      updatedAt: 'mp.updatedAt',
      approvedAt: 'mp.approvedAt',
      email: 'user.email',
    };
    return { field: map[key] || 'mp.approvedAt', direction };
  }

  async getMentorDetail(userId: string) {
    if (!isUuid(userId)) {
      throw new AppError('Invalid user id', 400);
    }
    const user = await AppDataSource.getRepository(User).findOne({
      where: { id: userId, role: USER_ROLE.MENTOR },
    });
    if (!user) {
      throw new AppError('Mentor not found', 404);
    }

    const profile = await this.mentorProfileService.getProfile(userId);
    if (!profile) {
      throw new AppError('Mentor profile not found', 404);
    }

    const sessionRepo = AppDataSource.getRepository(Session);
    const [sessionsCompleted, sessionsScheduled] = await Promise.all([
      sessionRepo.count({
        where: { mentorId: userId, status: SESSION_STATUS.COMPLETED },
      }),
      sessionRepo.count({
        where: { mentorId: userId, status: SESSION_STATUS.SCHEDULED },
      }),
    ]);

    const reviewRepo = AppDataSource.getRepository(SessionReview);
    const raw = await reviewRepo
      .createQueryBuilder('r')
      .select('AVG(r.rating)', 'avgRating')
      .addSelect('COUNT(r.id)', 'reviewCount')
      .addSelect(
        'SUM(CASE WHEN r.rating <= 2 THEN 1 ELSE 0 END)',
        'lowRatingCount'
      )
      .where('r.mentorId = :id', { id: userId })
      .getRawOne<{ avgRating: string | null; reviewCount: string; lowRatingCount: string | null }>();

    const reviewCount = raw?.reviewCount ? parseInt(raw.reviewCount, 10) : 0;
    const avgRating =
      raw?.avgRating != null ? parseFloat(raw.avgRating) : null;
    const lowRatingReviewsCount =
      raw?.lowRatingCount != null ? parseInt(raw.lowRatingCount, 10) : 0;

    const { password: _p, ...safeUser } = user as User & {
      password?: string;
    };

    const subRow = await adminSubscriptionService.findForUser(userId);

    return {
      user: safeUser,
      profile,
      sessionStats: {
        completed: sessionsCompleted,
        scheduled: sessionsScheduled,
      },
      subscriptions: {
        current: subRow ? adminSubscriptionService.serialize(subRow) : null,
        currentTier: subRow?.tier ?? null,
        currentStatus: subRow?.status ?? null,
        history: [] as unknown[],
      },
      flags: {
        reviewCount,
        averageRating: avgRating,
        lowRatingReviewsCount,
      },
    };
  }

  async updateMentorStatus(
    userId: string,
    action: 'suspend' | 'unsuspend' | 'remove',
    adminUserId: string,
    ip?: string
  ) {
    if (!isUuid(userId)) {
      throw new AppError('Invalid user id', 400);
    }
    const user = await AppDataSource.getRepository(User).findOne({
      where: { id: userId, role: USER_ROLE.MENTOR },
    });
    if (!user) {
      throw new AppError('Mentor not found', 404);
    }

    const repo = AppDataSource.getRepository(User);
    if (action === 'suspend') {
      await repo.update(userId, {
        accountStatus: ACCOUNT_STATUS.SUSPENDED,
        isActive: false,
      });
    } else if (action === 'unsuspend') {
      await repo.update(userId, {
        accountStatus: ACCOUNT_STATUS.ACTIVE,
        isActive: true,
      });
    } else {
      await repo.update(userId, {
        accountStatus: ACCOUNT_STATUS.DELETED,
        isActive: false,
      });
    }

    await adminAuditService.log({
      adminUserId,
      action: `admin.mentor.status.${action}`,
      targetType: 'user',
      targetId: userId,
      ip: ip ?? null,
    });

    const updated = await repo.findOne({ where: { id: userId } });
    return {
      userId,
      accountStatus: updated!.accountStatus,
      isActive: updated!.isActive,
    };
  }

  async sendMentorAdminMessage(
    userId: string,
    input: {
      title?: string;
      message: string;
      channels: ('in_app' | 'email' | 'push')[];
    },
    adminUserId: string,
    ip?: string
  ) {
    if (!isUuid(userId)) {
      throw new AppError('Invalid user id', 400);
    }
    const user = await AppDataSource.getRepository(User).findOne({
      where: { id: userId, role: USER_ROLE.MENTOR },
    });
    if (!user) {
      throw new AppError('Mentor not found', 404);
    }

    const title = input.title?.trim() || 'Message from Spiriment';
    const { message, channels } = input;

    if (channels.includes('in_app')) {
      try {
        await getAppNotificationService().createNotification({
          userId,
          type: AppNotificationType.SYSTEM,
          title,
          message,
          data: { type: 'admin_message', fromAdmin: true },
        });
      } catch (e) {
        this.logger.error('Admin mentor in-app message failed', e as Error);
      }
    }

    if (channels.includes('email') && user.email && user.isEmailVerified) {
      try {
        await adminEmail().sendMentorApplicationStatusEmail({
          to: user.email,
          firstName: user.firstName || '',
          subject: title,
          message,
          actionUrl: '/',
          actionText: 'Open Spiriment',
        });
      } catch (e) {
        this.logger.error('Admin mentor email failed', e as Error);
      }
    }

    if (channels.includes('push') && user.pushToken) {
      await pushNotificationService.sendToUser({
        userId,
        pushToken: user.pushToken,
        title,
        body: message.slice(0, 200),
        data: { type: 'admin_message' },
      });
    }

    await adminAuditService.log({
      adminUserId,
      action: 'admin.mentor.message',
      targetType: 'user',
      targetId: userId,
      metadata: { channels },
      ip: ip ?? null,
    });

    return { sent: true, channels };
  }
}

export const adminMentorService = new AdminMentorService();
