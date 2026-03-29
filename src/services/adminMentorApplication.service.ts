import { Brackets } from 'typeorm';
import { validate as isUuid } from 'uuid';
import { AppDataSource } from '@/config/data-source';
import { User } from '@/database/entities/user.entity';
import { MentorProfile } from '@/database/entities/mentorProfile.entity';
import { AppError, Logger, MENTOR_APPROVAL_STATUS, USER_ROLE } from '@/common';
import { MentorProfileService } from './mentorProfile.service';
import { EmailService } from '@/core/email.service';
import {
  resolveMentorApplicationTemplate,
  MENTOR_APPLICATION_TEMPLATES,
  MENTOR_APPLICATION_TEMPLATE_IDS,
} from '@/admin/mentorApplicationTemplates';
import { adminAuditService } from './adminAudit.service';

const DEFAULT_PAGE = 1;
const MAX_LIMIT = 100;

export type ApplicationListStatus =
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'needs_more_info'
  | 'draft'
  | 'all';

export function deriveApplicationStatus(
  user: User,
  profile: MentorProfile
): ApplicationListStatus {
  if (profile.isApproved) return 'approved';
  if (user.mentorApprovalStatus === MENTOR_APPROVAL_STATUS.REJECTED) {
    return 'rejected';
  }
  if (user.mentorApprovalStatus === MENTOR_APPROVAL_STATUS.NEEDS_MORE_INFO) {
    return 'needs_more_info';
  }
  if (profile.isOnboardingComplete) return 'pending_review';
  return 'draft';
}

let emailSingleton: EmailService | null = null;
function adminEmail(): EmailService {
  if (!emailSingleton) {
    emailSingleton = new EmailService(null);
  }
  return emailSingleton;
}

export class AdminMentorApplicationService {
  private logger = new Logger({
    service: 'admin-mentor-application-service',
    level: process.env.LOG_LEVEL || 'info',
  });

  private mentorProfileService = new MentorProfileService();

  async listApplications(params: {
    page?: number;
    limit?: number;
    sort?: string;
    search?: string;
    status?: ApplicationListStatus;
    country?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const page = Math.max(1, params.page ?? DEFAULT_PAGE);
    const limit = Math.min(MAX_LIMIT, Math.max(1, params.limit ?? 20));
    const skip = (page - 1) * limit;

    const qb = AppDataSource.getRepository(MentorProfile)
      .createQueryBuilder('mp')
      .innerJoinAndSelect('mp.user', 'user')
      .where('user.role = :role', { role: USER_ROLE.MENTOR });

    if (params.status && params.status !== 'draft') {
      if (params.status === 'approved') {
        qb.andWhere('mp.isApproved = :ap', { ap: true });
      } else {
        qb.andWhere('mp.isOnboardingComplete = :ic', { ic: true });
        qb.andWhere('mp.isApproved = :fa', { fa: false });
        if (params.status === 'pending_review') {
          qb.andWhere(
            '(user.mentorApprovalStatus IS NULL OR user.mentorApprovalStatus = :pen)',
            { pen: MENTOR_APPROVAL_STATUS.PENDING }
          );
        } else if (params.status === 'rejected') {
          qb.andWhere('user.mentorApprovalStatus = :rej', {
            rej: MENTOR_APPROVAL_STATUS.REJECTED,
          });
        } else if (params.status === 'needs_more_info') {
          qb.andWhere('user.mentorApprovalStatus = :nmi', {
            nmi: MENTOR_APPROVAL_STATUS.NEEDS_MORE_INFO,
          });
        }
      }
    } else if (params.status === 'draft') {
      qb.andWhere('mp.isOnboardingComplete = :df', { df: false });
    } else if (params.status === 'all') {
      qb.andWhere('mp.isOnboardingComplete = :ic', { ic: true });
    } else {
      qb.andWhere('mp.isOnboardingComplete = :ic', { ic: true });
      qb.andWhere('mp.isApproved = :fa', { fa: false });
      qb.andWhere(
        '(user.mentorApprovalStatus IS NULL OR user.mentorApprovalStatus = :pen)',
        { pen: MENTOR_APPROVAL_STATUS.PENDING }
      );
    }

    if (params.country) {
      qb.andWhere('user.country = :country', { country: params.country });
    }

    if (params.dateFrom) {
      qb.andWhere('mp.updatedAt >= :df', { df: new Date(params.dateFrom) });
    }
    if (params.dateTo) {
      const end = new Date(params.dateTo);
      end.setHours(23, 59, 59, 999);
      qb.andWhere('mp.updatedAt <= :dt', { dt: end });
    }

    if (params.search?.trim()) {
      const term = `%${params.search.trim().replace(/[%_\\]/g, '')}%`;
      if (term.length > 2) {
        qb.andWhere(
          new Brackets((w) => {
            w.where('user.email LIKE :s', { s: term })
              .orWhere('user.firstName LIKE :s', { s: term })
              .orWhere('user.lastName LIKE :s', { s: term });
          })
        );
      }
    }

    const order = this.parseSort(params.sort);
    qb.orderBy(order.field, order.direction);

    const total = await qb.getCount();
    const rows = await qb.skip(skip).take(limit).getMany();

    const data = rows.map((mp) =>
      this.serializeListItem(mp, mp.user as User)
    );

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
    const key = sort?.replace(/^-/, '') || 'updatedAt';
    const map: Record<string, string> = {
      createdAt: 'mp.createdAt',
      updatedAt: 'mp.updatedAt',
      submittedAt: 'mp.updatedAt',
      email: 'user.email',
    };
    return { field: map[key] || 'mp.updatedAt', direction };
  }

  private serializeListItem(profile: MentorProfile, user: User) {
    return {
      id: user.id,
      applicationId: user.id,
      status: deriveApplicationStatus(user, profile),
      submittedAt: profile.isOnboardingComplete ? profile.updatedAt : null,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        country: user.country,
        mentorApprovalStatus: user.mentorApprovalStatus,
      },
    };
  }

  async getApplicationDetail(userId: string) {
    if (!isUuid(userId)) {
      throw new AppError('Invalid application id', 400);
    }
    const profile = await AppDataSource.getRepository(MentorProfile).findOne({
      where: { userId },
      relations: ['user'],
    });
    if (!profile?.user) {
      throw new AppError('Application not found', 404);
    }
    const user = profile.user;
    if (user.role !== USER_ROLE.MENTOR) {
      throw new AppError('Application not found', 404);
    }

    const { user: _omit, ...profileRest } = profile as MentorProfile & {
      user: User;
    };

    return {
      id: user.id,
      applicationId: user.id,
      status: deriveApplicationStatus(user, profile),
      submittedAt: profile.isOnboardingComplete ? profile.updatedAt : null,
      internalAdminNotes: profile.internalAdminNotes ?? [],
      user: this.safeUser(user),
      profile: profileRest,
      documents: {
        profileImage: profile.profileImage ?? null,
        videoIntroduction: profile.videoIntroduction ?? null,
      },
    };
  }

  private safeUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      middleName: user.middleName,
      country: user.country,
      countryCode: user.countryCode,
      role: user.role,
      mentorApprovalStatus: user.mentorApprovalStatus,
      mentorApprovedAt: user.mentorApprovedAt,
      isOnboardingComplete: user.isOnboardingComplete,
      createdAt: user.createdAt,
    };
  }

  async appendNote(
    userId: string,
    adminUserId: string,
    body: string,
    ip?: string
  ) {
    if (!isUuid(userId)) {
      throw new AppError('Invalid application id', 400);
    }
    await this.mentorProfileService.appendInternalAdminNote(
      userId,
      adminUserId,
      body
    );
    await adminAuditService.log({
      adminUserId,
      action: 'admin.mentor_application.note',
      targetType: 'user',
      targetId: userId,
      metadata: { length: body.length },
      ip: ip ?? null,
    });
    const detail = await this.getApplicationDetail(userId);
    return detail.internalAdminNotes;
  }

  async applyDecision(input: {
    userId: string;
    action: 'approve' | 'reject' | 'needs_more_info';
    messageOverride?: string;
    templateId?: string;
    adminUserId: string;
    ip?: string;
  }) {
    const { userId, action, messageOverride, templateId, adminUserId, ip } =
      input;
    if (!isUuid(userId)) {
      throw new AppError('Invalid application id', 400);
    }

    const tpl = resolveMentorApplicationTemplate(templateId, action);
    const emailBody = (messageOverride?.trim() || tpl.body).slice(0, 8000);
    const emailSubject = tpl.subject;

    switch (action) {
      case 'approve':
        await this.mentorProfileService.approveMentor(userId);
        break;
      case 'reject':
        await this.mentorProfileService.rejectMentor(userId, {
          reason: emailBody,
        });
        break;
      case 'needs_more_info':
        await this.mentorProfileService.markMentorNeedsMoreInfo(userId, {
          message: emailBody,
        });
        break;
    }

    const user = await AppDataSource.getRepository(User).findOne({
      where: { id: userId },
      select: ['id', 'email', 'firstName', 'isEmailVerified'],
    });

    if (user?.email && user.isEmailVerified) {
      try {
        await adminEmail().sendMentorApplicationStatusEmail({
          to: user.email,
          firstName: user.firstName || '',
          subject: emailSubject,
          message: emailBody,
          actionUrl: '/',
          actionText: 'Open Spiriment',
        });
      } catch (e) {
        this.logger.error(
          'Mentor application decision email failed',
          e instanceof Error ? e : new Error(String(e))
        );
      }
    }

    await adminAuditService.log({
      adminUserId,
      action: `admin.mentor_application.${action}`,
      targetType: 'user',
      targetId: userId,
      metadata: { templateId: templateId ?? null },
      ip: ip ?? null,
    });

    const freshUser = await AppDataSource.getRepository(User).findOne({
      where: { id: userId },
    });
    const freshProfile = await AppDataSource.getRepository(
      MentorProfile
    ).findOne({ where: { userId } });
    if (!freshUser || !freshProfile) {
      throw new AppError('Application not found after update', 500);
    }

    return {
      id: userId,
      applicationId: userId,
      status: deriveApplicationStatus(freshUser, freshProfile),
    };
  }

  getMessageTemplatePreview(templateId: string) {
    if (
      !MENTOR_APPLICATION_TEMPLATE_IDS.includes(
        templateId as (typeof MENTOR_APPLICATION_TEMPLATE_IDS)[number]
      )
    ) {
      throw new AppError('Unknown template', 404);
    }
    const tpl =
      MENTOR_APPLICATION_TEMPLATES[
        templateId as keyof typeof MENTOR_APPLICATION_TEMPLATES
      ];
    return { templateId, subject: tpl.subject, body: tpl.body };
  }
}

export const adminMentorApplicationService =
  new AdminMentorApplicationService();
