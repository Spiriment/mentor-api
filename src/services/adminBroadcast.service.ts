import crypto from 'crypto';
import ExcelJS from 'exceljs';
import { In } from 'typeorm';
import { AppDataSource } from '@/config/data-source';
import { AppError, Config, USER_ROLE } from '@/common';
import { User } from '@/database/entities/user.entity';
import {
  EmailCampaign,
  EmailCampaignAudienceType,
  EmailCampaignStatus,
  EmailCampaignAudienceConfig,
} from '@/database/entities/emailCampaign.entity';
import {
  EmailCampaignRecipient,
  EmailCampaignRecipientStatus,
} from '@/database/entities/emailCampaignRecipient.entity';
import { EmailService } from '@/core/email.service';
import { adminAuditService } from './adminAudit.service';
import { assertBroadcastImagesReady, prepareBroadcastHtmlForSend } from '@/common/broadcastHtml.util';

let emailSingleton: EmailService | null = null;
function broadcastEmail(): EmailService {
  if (!emailSingleton) {
    emailSingleton = new EmailService(null);
  }
  return emailSingleton;
}

const DEFAULT_PAGE = 1;
const MAX_LIMIT = 50;
const SEND_DELAY_MS = 150;
const activeSendJobs = new Set<string>();

export type CreateCampaignInput = {
  name: string;
  subject: string;
  htmlContent: string;
  audienceType: EmailCampaignAudienceType;
  audienceConfig?: EmailCampaignAudienceConfig;
  replyTo?: string;
  scheduledAt?: string | null;
};

export class AdminBroadcastService {
  private campaignRepo = () => AppDataSource.getRepository(EmailCampaign);
  private recipientRepo = () =>
    AppDataSource.getRepository(EmailCampaignRecipient);

  async listCampaigns(params: {
    page?: number;
    limit?: number;
    status?: EmailCampaignStatus;
    templatesOnly?: boolean;
  }) {
    const page = Math.max(1, params.page ?? DEFAULT_PAGE);
    const limit = Math.min(MAX_LIMIT, Math.max(1, params.limit ?? 20));
    const skip = (page - 1) * limit;

    const qb = this.campaignRepo()
      .createQueryBuilder('c')
      .where('c.isTemplate = :isTemplate', {
        isTemplate: params.templatesOnly ? true : false,
      });

    if (params.status) {
      qb.andWhere('c.status = :status', { status: params.status });
    }

    qb.orderBy('c.updatedAt', 'DESC').skip(skip).take(limit);

    const [items, total] = await qb.getManyAndCount();
    return {
      items: items.map((c) => this.serializeCampaign(c)),
      pagination: { page, limit, total },
    };
  }

  async getCampaign(id: string) {
    const campaign = await this.campaignRepo().findOne({ where: { id } });
    if (!campaign) {
      throw new AppError('Campaign not found', 404, 'CAMPAIGN_NOT_FOUND');
    }
    return this.serializeCampaign(campaign);
  }

  async createCampaign(input: CreateCampaignInput, adminUserId: string) {
    const campaign = this.campaignRepo().create({
      name: input.name.trim(),
      subject: input.subject.trim(),
      htmlContent: input.htmlContent,
      audienceType: input.audienceType,
      audienceConfig: input.audienceConfig ?? {},
      replyTo: input.replyTo?.trim() || 'info@spiriment.com',
      status: input.scheduledAt
        ? EmailCampaignStatus.SCHEDULED
        : EmailCampaignStatus.DRAFT,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      createdByAdminId: adminUserId,
    });

    const saved = await this.campaignRepo().save(campaign);
    return this.serializeCampaign(saved);
  }

  async updateCampaign(
    id: string,
    input: Partial<CreateCampaignInput>,
    adminUserId: string
  ) {
    const campaign = await this.campaignRepo().findOne({ where: { id } });
    if (!campaign) {
      throw new AppError('Campaign not found', 404, 'CAMPAIGN_NOT_FOUND');
    }
    if (
      ![EmailCampaignStatus.DRAFT, EmailCampaignStatus.SCHEDULED].includes(
        campaign.status
      )
    ) {
      throw new AppError(
        'Only draft or scheduled campaigns can be edited',
        400,
        'CAMPAIGN_NOT_EDITABLE'
      );
    }

    if (input.name !== undefined) campaign.name = input.name.trim();
    if (input.subject !== undefined) campaign.subject = input.subject.trim();
    if (input.htmlContent !== undefined) campaign.htmlContent = input.htmlContent;
    if (input.audienceType !== undefined) campaign.audienceType = input.audienceType;
    if (input.audienceConfig !== undefined) {
      campaign.audienceConfig = input.audienceConfig;
    }
    if (input.replyTo !== undefined) {
      campaign.replyTo = input.replyTo.trim() || 'info@spiriment.com';
    }
    if (input.scheduledAt !== undefined) {
      campaign.scheduledAt = input.scheduledAt
        ? new Date(input.scheduledAt)
        : null;
      campaign.status = input.scheduledAt
        ? EmailCampaignStatus.SCHEDULED
        : EmailCampaignStatus.DRAFT;
    }

    const saved = await this.campaignRepo().save(campaign);

    await adminAuditService.log({
      adminUserId,
      action: 'admin.broadcast.update',
      targetType: 'email_campaign',
      targetId: id,
      metadata: { name: saved.name },
    });

    return this.serializeCampaign(saved);
  }

  async deleteCampaign(id: string, adminUserId: string) {
    const campaign = await this.campaignRepo().findOne({ where: { id } });
    if (!campaign) {
      throw new AppError('Campaign not found', 404, 'CAMPAIGN_NOT_FOUND');
    }
    if (
      ![EmailCampaignStatus.DRAFT, EmailCampaignStatus.CANCELLED].includes(
        campaign.status
      )
    ) {
      throw new AppError(
        'Only draft or cancelled campaigns can be deleted',
        400,
        'CAMPAIGN_NOT_DELETABLE'
      );
    }

    await this.recipientRepo().delete({ campaignId: id });
    await this.campaignRepo().delete({ id });

    await adminAuditService.log({
      adminUserId,
      action: 'admin.broadcast.delete',
      targetType: 'email_campaign',
      targetId: id,
      metadata: { name: campaign.name },
    });

    return { deleted: true };
  }

  async previewAudience(id: string) {
    const campaign = await this.campaignRepo().findOne({ where: { id } });
    if (!campaign) {
      throw new AppError('Campaign not found', 404, 'CAMPAIGN_NOT_FOUND');
    }

    const recipients = await this.resolveRecipients(campaign);
    return {
      count: recipients.length,
      sample: recipients.slice(0, 5).map((r) => ({
        email: r.email,
        firstName: r.firstName ?? null,
      })),
    };
  }

  async parseExcelRecipients(filePath: string): Promise<
    { email: string; firstName?: string }[]
  > {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new AppError('Excel file has no worksheets', 400, 'INVALID_EXCEL');
    }

    const headerRow = worksheet.getRow(1);
    const headers: Record<number, string> = {};
    headerRow.eachCell((cell, colNumber) => {
      headers[colNumber] = String(cell.value ?? '')
        .trim()
        .toLowerCase();
    });

    let emailCol = 0;
    let firstNameCol = 0;
    for (const [col, header] of Object.entries(headers)) {
      if (['email', 'e-mail', 'email address', 'emailaddress'].includes(header)) {
        emailCol = Number(col);
      }
      if (['firstname', 'first name', 'first_name', 'name'].includes(header)) {
        firstNameCol = Number(col);
      }
    }

    if (!emailCol) {
      emailCol = 1;
      firstNameCol = firstNameCol || 2;
    }

    const results: { email: string; firstName?: string }[] = [];
    const seen = new Set<string>();

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const emailRaw = row.getCell(emailCol).text?.trim().toLowerCase();
      if (!emailRaw || !emailRaw.includes('@')) return;

      if (seen.has(emailRaw)) return;
      seen.add(emailRaw);

      const firstName = firstNameCol
        ? row.getCell(firstNameCol).text?.trim() || undefined
        : undefined;

      results.push({ email: emailRaw, firstName });
    });

    if (results.length === 0) {
      throw new AppError(
        'No valid email addresses found in Excel file',
        400,
        'NO_RECIPIENTS'
      );
    }

    return results;
  }

  async importExcel(id: string, filePath: string, adminUserId: string) {
    const campaign = await this.campaignRepo().findOne({ where: { id } });
    if (!campaign) {
      throw new AppError('Campaign not found', 404, 'CAMPAIGN_NOT_FOUND');
    }
    if (
      ![EmailCampaignStatus.DRAFT, EmailCampaignStatus.SCHEDULED].includes(
        campaign.status
      )
    ) {
      throw new AppError('Campaign cannot be edited', 400, 'CAMPAIGN_NOT_EDITABLE');
    }

    const parsed = await this.parseExcelRecipients(filePath);
    campaign.audienceType = EmailCampaignAudienceType.EXCEL_LIST;
    campaign.audienceConfig = {
      ...(campaign.audienceConfig ?? {}),
      emails: parsed.map((r) => r.email),
      excelNames: parsed.reduce(
        (acc, r) => {
          if (r.firstName) acc[r.email] = r.firstName;
          return acc;
        },
        {} as Record<string, string>
      ),
    } as EmailCampaignAudienceConfig & { excelNames?: Record<string, string> };

    const saved = await this.campaignRepo().save(campaign);

    await adminAuditService.log({
      adminUserId,
      action: 'admin.broadcast.import_excel',
      targetType: 'email_campaign',
      targetId: id,
      metadata: { count: parsed.length },
    });

    return {
      campaign: this.serializeCampaign(saved),
      imported: parsed.length,
    };
  }

  async sendCampaign(id: string, adminUserId: string, ip?: string) {
    const campaign = await this.campaignRepo().findOne({ where: { id } });
    if (!campaign) {
      throw new AppError('Campaign not found', 404, 'CAMPAIGN_NOT_FOUND');
    }
    if (
      ![EmailCampaignStatus.DRAFT, EmailCampaignStatus.SCHEDULED].includes(
        campaign.status
      )
    ) {
      throw new AppError(
        'Campaign is already sending or has been sent',
        400,
        'CAMPAIGN_NOT_SENDABLE'
      );
    }

    if (activeSendJobs.has(id)) {
      throw new AppError('Campaign is already being sent', 409, 'CAMPAIGN_SENDING');
    }

    try {
      assertBroadcastImagesReady(campaign.htmlContent);
    } catch (err) {
      throw new AppError(
        err instanceof Error ? err.message : 'Invalid images in email',
        400,
        'BROADCAST_BROKEN_IMAGES'
      );
    }

    await this.prepareRecipients(campaign);

    campaign.status = EmailCampaignStatus.SENDING;
    campaign.scheduledAt = null;
    await this.campaignRepo().save(campaign);

    await adminAuditService.log({
      adminUserId,
      action: 'admin.broadcast.send',
      targetType: 'email_campaign',
      targetId: id,
      metadata: {
        subject: campaign.subject,
        totalRecipients: campaign.totalRecipients,
      },
      ip: ip ?? null,
    });

    setImmediate(() => {
      this.processSendQueue(id).catch((err) => {
        console.error(`Broadcast send failed for campaign ${id}:`, err);
      });
    });

    return {
      started: true,
      campaignId: id,
      totalRecipients: campaign.totalRecipients,
    };
  }

  async scheduleCampaign(
    id: string,
    scheduledAt: string,
    adminUserId: string,
    ip?: string
  ) {
    const campaign = await this.campaignRepo().findOne({ where: { id } });
    if (!campaign) {
      throw new AppError('Campaign not found', 404, 'CAMPAIGN_NOT_FOUND');
    }
    if (
      ![EmailCampaignStatus.DRAFT, EmailCampaignStatus.SCHEDULED].includes(
        campaign.status
      )
    ) {
      throw new AppError('Campaign cannot be scheduled', 400, 'CAMPAIGN_NOT_SCHEDULABLE');
    }

    const when = new Date(scheduledAt);
    if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
      throw new AppError(
        'Scheduled time must be in the future',
        400,
        'INVALID_SCHEDULE'
      );
    }

    campaign.status = EmailCampaignStatus.SCHEDULED;
    campaign.scheduledAt = when;
    await this.campaignRepo().save(campaign);

    await adminAuditService.log({
      adminUserId,
      action: 'admin.broadcast.schedule',
      targetType: 'email_campaign',
      targetId: id,
      metadata: { scheduledAt: when.toISOString() },
      ip: ip ?? null,
    });

    return this.serializeCampaign(campaign);
  }

  async cancelCampaign(id: string, adminUserId: string, ip?: string) {
    const campaign = await this.campaignRepo().findOne({ where: { id } });
    if (!campaign) {
      throw new AppError('Campaign not found', 404, 'CAMPAIGN_NOT_FOUND');
    }
    if (
      ![EmailCampaignStatus.SCHEDULED, EmailCampaignStatus.SENDING].includes(
        campaign.status
      )
    ) {
      throw new AppError('Campaign cannot be cancelled', 400, 'CAMPAIGN_NOT_CANCELLABLE');
    }

    campaign.status = EmailCampaignStatus.CANCELLED;
    campaign.scheduledAt = null;
    await this.campaignRepo().save(campaign);

    await this.recipientRepo().update(
      { campaignId: id, status: EmailCampaignRecipientStatus.PENDING },
      { status: EmailCampaignRecipientStatus.SKIPPED }
    );

    await adminAuditService.log({
      adminUserId,
      action: 'admin.broadcast.cancel',
      targetType: 'email_campaign',
      targetId: id,
      metadata: { name: campaign.name },
      ip: ip ?? null,
    });

    return this.serializeCampaign(campaign);
  }

  async duplicateCampaign(id: string, adminUserId: string) {
    const source = await this.campaignRepo().findOne({ where: { id } });
    if (!source) {
      throw new AppError('Campaign not found', 404, 'CAMPAIGN_NOT_FOUND');
    }

    const copy = this.campaignRepo().create({
      name: `${source.name} (copy)`,
      subject: source.subject,
      htmlContent: source.htmlContent,
      audienceType: source.audienceType,
      audienceConfig: source.audienceConfig,
      replyTo: source.replyTo,
      status: EmailCampaignStatus.DRAFT,
      createdByAdminId: adminUserId,
      isTemplate: false,
    });

    const saved = await this.campaignRepo().save(copy);
    return this.serializeCampaign(saved);
  }

  async saveAsTemplate(id: string, templateName: string, adminUserId: string) {
    const campaign = await this.campaignRepo().findOne({ where: { id } });
    if (!campaign) {
      throw new AppError('Campaign not found', 404, 'CAMPAIGN_NOT_FOUND');
    }

    const template = this.campaignRepo().create({
      name: templateName.trim(),
      templateName: templateName.trim(),
      subject: campaign.subject,
      htmlContent: campaign.htmlContent,
      audienceType: campaign.audienceType,
      audienceConfig: campaign.audienceConfig,
      replyTo: campaign.replyTo,
      status: EmailCampaignStatus.DRAFT,
      createdByAdminId: adminUserId,
      isTemplate: true,
    });

    const saved = await this.campaignRepo().save(template);
    return this.serializeCampaign(saved);
  }

  async listRecipients(
    campaignId: string,
    params: { page?: number; limit?: number; status?: EmailCampaignRecipientStatus }
  ) {
    const page = Math.max(1, params.page ?? DEFAULT_PAGE);
    const limit = Math.min(100, Math.max(1, params.limit ?? 50));
    const skip = (page - 1) * limit;

    const qb = this.recipientRepo()
      .createQueryBuilder('r')
      .where('r.campaignId = :campaignId', { campaignId });

    if (params.status) {
      qb.andWhere('r.status = :status', { status: params.status });
    }

    qb.orderBy('r.createdAt', 'ASC').skip(skip).take(limit);
    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      pagination: { page, limit, total },
    };
  }

  async processScheduledCampaigns() {
    const due = await this.campaignRepo().find({
      where: {
        status: EmailCampaignStatus.SCHEDULED,
      },
    });

    const now = Date.now();
    for (const campaign of due) {
      if (!campaign.scheduledAt || campaign.scheduledAt.getTime() > now) {
        continue;
      }
      if (activeSendJobs.has(campaign.id)) continue;

      try {
        await this.prepareRecipients(campaign);
        campaign.status = EmailCampaignStatus.SENDING;
        campaign.scheduledAt = null;
        await this.campaignRepo().save(campaign);

        setImmediate(() => {
          this.processSendQueue(campaign.id).catch((err) => {
            console.error(
              `Scheduled broadcast send failed for ${campaign.id}:`,
              err
            );
          });
        });
      } catch (err) {
        campaign.status = EmailCampaignStatus.FAILED;
        await this.campaignRepo().save(campaign);
        console.error(`Failed to start scheduled campaign ${campaign.id}:`, err);
      }
    }
  }

  generateUnsubscribeUrl(email: string): string {
    const secret =
      process.env.JWT_SECRET || process.env.MARKETING_UNSUBSCRIBE_SECRET || 'spiriment-marketing';
    const token = crypto
      .createHmac('sha256', secret)
      .update(email.toLowerCase())
      .digest('hex');
    const apiBase = Config.appUrl || process.env.API_BASE_URL || '';
    const base = apiBase.replace(/\/$/, '');
    return `${base}/api/marketing/unsubscribe?email=${encodeURIComponent(email)}&token=${token}`;
  }

  async sendTestEmail(campaignId: string, to: string, adminUserId: string) {
    const email = to.trim().toLowerCase();
    if (!email.includes('@')) {
      throw new AppError('Invalid email address', 400, 'INVALID_EMAIL');
    }

    const campaign = await this.campaignRepo().findOne({
      where: { id: campaignId },
    });
    if (!campaign) {
      throw new AppError('Campaign not found', 404, 'CAMPAIGN_NOT_FOUND');
    }

    try {
      assertBroadcastImagesReady(campaign.htmlContent);
    } catch (err) {
      throw new AppError(
        err instanceof Error ? err.message : 'Invalid images in email',
        400,
        'BROADCAST_BROKEN_IMAGES'
      );
    }

    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({
      where: { email },
      select: ['id', 'firstName'],
    });

    const emailService = broadcastEmail();
    await emailService.sendBroadcastCampaignEmail({
      to: email,
      subject: `[TEST] ${campaign.subject}`,
      htmlContent: prepareBroadcastHtmlForSend(campaign.htmlContent),
      firstName: user?.firstName ?? undefined,
      unsubscribeUrl: this.generateUnsubscribeUrl(email),
      replyTo: campaign.replyTo ?? 'info@spiriment.com',
    });

    await adminAuditService.log({
      adminUserId,
      action: 'admin.broadcast.send_test',
      targetType: 'email_campaign',
      targetId: campaignId,
      metadata: { to: email },
    });

    return { sent: true, to: email };
  }

  async unsubscribeEmail(email: string, token: string): Promise<boolean> {
    const expected = crypto
      .createHmac(
        'sha256',
        process.env.JWT_SECRET ||
          process.env.MARKETING_UNSUBSCRIBE_SECRET ||
          'spiriment-marketing'
      )
      .update(email.toLowerCase())
      .digest('hex');

    if (token !== expected) {
      return false;
    }

    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({
      where: { email: email.toLowerCase() },
    });

    if (user) {
      user.marketingEmailsOptOut = true;
      await userRepo.save(user);
    }

    return true;
  }

  private async prepareRecipients(campaign: EmailCampaign) {
    await this.recipientRepo().delete({ campaignId: campaign.id });

    const resolved = await this.resolveRecipients(campaign);
    if (resolved.length === 0) {
      throw new AppError('No recipients for this campaign', 400, 'NO_RECIPIENTS');
    }

    const rows = resolved.map((r) =>
      this.recipientRepo().create({
        campaignId: campaign.id,
        email: r.email,
        userId: r.userId ?? null,
        firstName: r.firstName ?? null,
        status: EmailCampaignRecipientStatus.PENDING,
      })
    );

    const batchSize = 500;
    for (let i = 0; i < rows.length; i += batchSize) {
      await this.recipientRepo().save(rows.slice(i, i + batchSize));
    }

    campaign.totalRecipients = rows.length;
    campaign.sentCount = 0;
    campaign.failedCount = 0;
    await this.campaignRepo().save(campaign);
  }

  private async resolveRecipients(campaign: EmailCampaign): Promise<
    { email: string; firstName?: string; userId?: string }[]
  > {
    const config = campaign.audienceConfig ?? {};
    const requireVerified = config.requireVerified !== false;
    const seen = new Map<string, { email: string; firstName?: string; userId?: string }>();

    if (campaign.audienceType === EmailCampaignAudienceType.EXCEL_LIST) {
      const emails = config.emails ?? [];
      const excelNames =
        (config as EmailCampaignAudienceConfig & { excelNames?: Record<string, string> })
          .excelNames ?? {};

      const userRepo = AppDataSource.getRepository(User);
      const users =
        emails.length > 0
          ? await userRepo.find({
              where: { email: In(emails) },
              select: ['id', 'email', 'firstName', 'marketingEmailsOptOut'],
            })
          : [];
      const userByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u]));

      for (const raw of emails) {
        const email = raw.toLowerCase();
        const user = userByEmail.get(email);
        if (user?.marketingEmailsOptOut) continue;

        seen.set(email, {
          email,
          firstName: user?.firstName || excelNames[email],
          userId: user?.id,
        });
      }

      return Array.from(seen.values());
    }

    const qb = AppDataSource.getRepository(User)
      .createQueryBuilder('user')
      .select(['user.id', 'user.email', 'user.firstName', 'user.marketingEmailsOptOut'])
      .where('user.isActive = :active', { active: true })
      .andWhere('user.marketingEmailsOptOut = :optOut', { optOut: false });

    if (requireVerified) {
      qb.andWhere('user.isEmailVerified = :verified', { verified: true });
    }

    if (
      campaign.audienceType === EmailCampaignAudienceType.ROLE_FILTER &&
      config.role &&
      config.role !== 'all'
    ) {
      qb.andWhere('user.role = :role', {
        role: config.role === 'mentor' ? USER_ROLE.MENTOR : USER_ROLE.MENTEE,
      });
    }

    const users = await qb.getMany();
    for (const user of users) {
      const email = user.email.toLowerCase();
      seen.set(email, {
        email,
        firstName: user.firstName,
        userId: user.id,
      });
    }

    return Array.from(seen.values());
  }

  private async processSendQueue(campaignId: string) {
    if (activeSendJobs.has(campaignId)) return;
    activeSendJobs.add(campaignId);

    try {
      const campaign = await this.campaignRepo().findOne({
        where: { id: campaignId },
      });
      if (!campaign || campaign.status !== EmailCampaignStatus.SENDING) {
        return;
      }

      try {
        assertBroadcastImagesReady(campaign.htmlContent);
      } catch (err) {
        campaign.status = EmailCampaignStatus.FAILED;
        await this.campaignRepo().save(campaign);
        console.error(`Campaign ${campaignId} has broken images:`, err);
        return;
      }

      const emailService = broadcastEmail();
      let sent = campaign.sentCount;
      let failed = campaign.failedCount;

      while (true) {
        const current = await this.campaignRepo().findOne({
          where: { id: campaignId },
        });
        if (!current || current.status === EmailCampaignStatus.CANCELLED) {
          break;
        }

        const batch = await this.recipientRepo().find({
          where: {
            campaignId,
            status: EmailCampaignRecipientStatus.PENDING,
          },
          take: 50,
          order: { createdAt: 'ASC' },
        });

        if (batch.length === 0) break;

        for (const recipient of batch) {
          const live = await this.campaignRepo().findOne({
            where: { id: campaignId },
          });
          if (!live || live.status === EmailCampaignStatus.CANCELLED) {
            await this.recipientRepo().update(
              { id: recipient.id },
              { status: EmailCampaignRecipientStatus.SKIPPED }
            );
            continue;
          }

          try {
            const unsubscribeUrl = this.generateUnsubscribeUrl(recipient.email);
            await emailService.sendBroadcastCampaignEmail({
              to: recipient.email,
              subject: campaign.subject,
              htmlContent: prepareBroadcastHtmlForSend(campaign.htmlContent),
              firstName: recipient.firstName ?? undefined,
              unsubscribeUrl,
              replyTo: campaign.replyTo ?? 'info@spiriment.com',
            });

            recipient.status = EmailCampaignRecipientStatus.SENT;
            recipient.sentAt = new Date();
            recipient.errorMessage = null;
            await this.recipientRepo().save(recipient);
            sent++;
          } catch (err) {
            recipient.status = EmailCampaignRecipientStatus.FAILED;
            recipient.errorMessage =
              err instanceof Error ? err.message : String(err);
            await this.recipientRepo().save(recipient);
            failed++;
          }

          await new Promise((r) => setTimeout(r, SEND_DELAY_MS));
        }

        await this.campaignRepo().update(campaignId, {
          sentCount: sent,
          failedCount: failed,
        });
      }

      const final = await this.campaignRepo().findOne({
        where: { id: campaignId },
      });
      if (final && final.status === EmailCampaignStatus.SENDING) {
        final.status =
          final.failedCount > 0 && final.sentCount === 0
            ? EmailCampaignStatus.FAILED
            : EmailCampaignStatus.SENT;
        final.sentAt = new Date();
        await this.campaignRepo().save(final);
      }
    } finally {
      activeSendJobs.delete(campaignId);
    }
  }

  private serializeCampaign(campaign: EmailCampaign) {
    return {
      id: campaign.id,
      name: campaign.name,
      subject: campaign.subject,
      htmlContent: campaign.htmlContent,
      audienceType: campaign.audienceType,
      audienceConfig: campaign.audienceConfig,
      status: campaign.status,
      scheduledAt: campaign.scheduledAt?.toISOString() ?? null,
      sentAt: campaign.sentAt?.toISOString() ?? null,
      createdByAdminId: campaign.createdByAdminId,
      totalRecipients: campaign.totalRecipients,
      sentCount: campaign.sentCount,
      failedCount: campaign.failedCount,
      replyTo: campaign.replyTo,
      isTemplate: campaign.isTemplate,
      templateName: campaign.templateName,
      createdAt: campaign.createdAt.toISOString(),
      updatedAt: campaign.updatedAt.toISOString(),
    };
  }
}

export const adminBroadcastService = new AdminBroadcastService();
