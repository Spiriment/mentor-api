import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { AppDataSource } from '@/config/data-source';
import { jwt, logger } from '@/config/int-services';
import { EmailService } from '@/core/email.service';
import { AppError, NotFoundError, UnauthorizedError, ConflictError } from '@/common/errors';
import { ChurchPortal, CHURCH_PORTAL_STATUS } from '../entities/churchPortal.entity';
import { PORTAL_SUSPENDED_MESSAGE } from '../middleware/churchPortalAuth.middleware';
import { ChurchPortalUser } from '../entities/churchPortalUser.entity';
import { ChurchPortalRefreshToken } from '../entities/churchPortalRefreshToken.entity';
import type { UpdateProfileInput } from '../validation/churchPortalAuth.validation';

const SALT_ROUNDS = 12;
const OTP_EXPIRY_MINUTES = 15;
const MAX_RESET_ATTEMPTS = 5;
const INVITE_EXPIRY_HOURS = 48;
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

export class ChurchPortalAuthService {
  private emailService: EmailService;

  constructor(emailService: EmailService) {
    this.emailService = emailService;
  }

  async getPortalInfo(slug?: string, joinCode?: string) {
    const repo = AppDataSource.getRepository(ChurchPortal);
    const normalizedCode = joinCode?.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (normalizedCode && normalizedCode.length >= 4) {
      const byCode = await repo.findOne({
        where: { joinCode: normalizedCode, status: 'active' },
        select: ['id', 'name', 'slug', 'logoUrl', 'denomination', 'timezone'],
      });
      if (byCode) return byCode;
    }
    const s = slug?.trim().toLowerCase();
    if (!s) throw new NotFoundError('Church portal not found');
    const portal = await repo.findOne({
      where: { slug: s, status: 'active' },
      select: ['id', 'name', 'slug', 'logoUrl', 'denomination', 'timezone'],
    });
    if (!portal) throw new NotFoundError('Church portal not found');
    return portal;
  }

  async login(email: string, password: string, churchPortalId: string) {
    const userRepo = AppDataSource.getRepository(ChurchPortalUser);
    const portalRepo = AppDataSource.getRepository(ChurchPortal);

    const portal = await portalRepo.findOne({
      where: { id: churchPortalId },
      select: ['id', 'name', 'slug', 'logoUrl', 'joinCode', 'status'],
    });
    if (!portal) throw new UnauthorizedError('Church portal not found');
    if (portal.status !== CHURCH_PORTAL_STATUS.ACTIVE) throw new UnauthorizedError(PORTAL_SUSPENDED_MESSAGE);

    const user = await userRepo.findOne({
      where: { email: email.toLowerCase(), churchPortalId },
      select: ['id', 'email', 'firstName', 'lastName', 'role', 'isActive', 'churchPortalId', 'password'],
    });

    if (!user || !user.isActive) throw new UnauthorizedError('Invalid credentials');
    if (!user.password) throw new UnauthorizedError('Account setup not complete — please check your invite email');

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) throw new UnauthorizedError('Invalid credentials');

    const accessToken = jwt.signChurchPortalAccessToken({
      portalUserId: user.id,
      churchPortalId: user.churchPortalId,
      email: user.email,
      role: user.role,
    });

    const refreshTokenValue = jwt.signChurchPortalRefreshToken(user.id);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    const tokenRepo = AppDataSource.getRepository(ChurchPortalRefreshToken);
    await tokenRepo.save(tokenRepo.create({ churchPortalUserId: user.id, token: refreshTokenValue, expiresAt }));

    await userRepo.update(user.id, { lastLoginAt: new Date() });

    return {
      accessToken,
      refreshToken: refreshTokenValue,
      portalUser: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role },
      portal: {
        id: portal.id,
        name: portal.name,
        slug: portal.slug,
        logoUrl: portal.logoUrl,
        joinCode: portal.joinCode ?? null,
      },
    };
  }

  async logout(refreshToken: string) {
    const tokenRepo = AppDataSource.getRepository(ChurchPortalRefreshToken);
    await tokenRepo.delete({ token: refreshToken });
  }

  async refreshToken(refreshToken: string) {
    const decoded = jwt.verifyChurchPortalRefreshToken(refreshToken);

    const tokenRepo = AppDataSource.getRepository(ChurchPortalRefreshToken);
    const stored = await tokenRepo.findOne({ where: { token: refreshToken } });
    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedError('Refresh token expired or invalid');
    }

    const userRepo = AppDataSource.getRepository(ChurchPortalUser);
    const user = await userRepo.findOne({
      where: { id: decoded.portalUserId },
      select: ['id', 'email', 'role', 'isActive', 'churchPortalId'],
    });
    if (!user || !user.isActive) throw new UnauthorizedError('Account not found or inactive');

    const portalActive = await AppDataSource.getRepository(ChurchPortal).exist({
      where: { id: user.churchPortalId, status: CHURCH_PORTAL_STATUS.ACTIVE },
    });
    if (!portalActive) {
      await tokenRepo.delete({ token: refreshToken });
      throw new UnauthorizedError(PORTAL_SUSPENDED_MESSAGE);
    }

    const accessToken = jwt.signChurchPortalAccessToken({
      portalUserId: user.id,
      churchPortalId: user.churchPortalId,
      email: user.email,
      role: user.role,
    });

    return { accessToken };
  }

  async acceptInvite(inviteToken: string, password: string) {
    const decoded = jwt.verifyChurchPortalInviteToken(inviteToken);

    const userRepo = AppDataSource.getRepository(ChurchPortalUser);
    const user = await userRepo.findOne({
      where: { id: decoded.portalUserId, churchPortalId: decoded.churchPortalId },
      select: ['id', 'email', 'firstName', 'lastName', 'role', 'isActive', 'churchPortalId', 'inviteToken', 'inviteTokenExpiresAt', 'password'],
    });

    if (!user) throw new NotFoundError('Account not found');
    if (user.password) throw new ConflictError('Account already activated — please log in');
    if (!user.inviteToken || user.inviteToken !== inviteToken) throw new UnauthorizedError('Invalid invite link');
    if (user.inviteTokenExpiresAt && user.inviteTokenExpiresAt < new Date()) throw new UnauthorizedError('Invite link has expired — contact your administrator');

    const hashed = await bcrypt.hash(password, SALT_ROUNDS);
    await userRepo.update(user.id, {
      password: hashed,
      isActive: true,
      inviteToken: null,
      inviteTokenExpiresAt: null,
    });

    return { message: 'Password set successfully. You can now log in.' };
  }

  async forgotPassword(email: string, churchPortalId: string) {
    // Same answer whatever happens, so the form can't be used to discover pastor emails
    const genericReply = { message: 'If that email belongs to a portal account, we have sent it instructions.' };

    const userRepo = AppDataSource.getRepository(ChurchPortalUser);
    const user = await userRepo.findOne({
      where: { email: email.toLowerCase(), churchPortalId },
      select: ['id', 'email', 'firstName', 'lastName', 'role', 'isActive', 'churchPortalId', 'password'],
    });
    const portal = user
      ? await AppDataSource.getRepository(ChurchPortal).findOne({ where: { id: churchPortalId } })
      : null;
    if (!user || !user.isActive || !portal || portal.status !== CHURCH_PORTAL_STATUS.ACTIVE) {
      return genericReply;
    }

    try {
      if (!user.password) {
        // Never finished the invite: the reset code would overwrite the invite link, so send a
        // fresh invite instead
        const inviteToken = jwt.signChurchPortalInviteToken(
          { portalUserId: user.id, churchPortalId, email: user.email },
          `${INVITE_EXPIRY_HOURS}h`
        );
        await userRepo.update(user.id, {
          inviteToken,
          inviteTokenExpiresAt: new Date(Date.now() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000),
        });
        await this.sendInviteEmail(user, portal, inviteToken);
        return genericReply;
      }

      const otp = crypto.randomInt(100000, 1000000).toString();
      await userRepo.update(user.id, {
        inviteToken: await bcrypt.hash(otp, 10),
        inviteTokenExpiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
        resetAttempts: 0,
      });

      await this.emailService.sendEmailWithTemplate({
        to: user.email,
        subject: 'Your church portal password reset code',
        partialName: 'church-portal-reset-code',
        templateData: {
          name: user.firstName || 'Pastor',
          churchName: portal.name,
          otp,
          expiryMinutes: OTP_EXPIRY_MINUTES,
        },
      });
    } catch (err) {
      logger.error('Church portal password reset email failed', err instanceof Error ? err : new Error(String(err)), {
        portalUserId: user.id,
      });
    }
    return genericReply;
  }

  async resetPassword(email: string, otp: string, newPassword: string, churchPortalId?: string) {
    const userRepo = AppDataSource.getRepository(ChurchPortalUser);
    const user = await userRepo.findOne({
      where: { email: email.toLowerCase(), ...(churchPortalId ? { churchPortalId } : {}) },
      select: ['id', 'password', 'inviteToken', 'inviteTokenExpiresAt', 'resetAttempts'],
    });

    // Only accounts that already have a password carry a reset code (others hold an invite link)
    if (!user || !user.password || !user.inviteToken || !user.inviteTokenExpiresAt) {
      throw new AppError('Invalid or expired reset code', 400, 'INVALID_OTP');
    }
    if (user.inviteTokenExpiresAt < new Date()) {
      throw new AppError('Reset code has expired. Request a new one.', 400, 'OTP_EXPIRED');
    }

    const valid = await bcrypt.compare(otp, user.inviteToken);
    if (!valid) {
      // A 6-digit code must not be guessable: burn it after a few wrong tries
      const attempts = (user.resetAttempts ?? 0) + 1;
      if (attempts >= MAX_RESET_ATTEMPTS) {
        await userRepo.update(user.id, { inviteToken: null, inviteTokenExpiresAt: null, resetAttempts: 0 });
        throw new AppError('Too many wrong codes. Request a new one.', 400, 'OTP_LOCKED');
      }
      await userRepo.update(user.id, { resetAttempts: attempts });
      throw new AppError('Invalid reset code', 400, 'INVALID_OTP');
    }

    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await userRepo.update(user.id, {
      password: hashedPassword,
      inviteToken: null,
      inviteTokenExpiresAt: null,
      resetAttempts: 0,
    });
    // Sign out every other session, in case the old password was the problem
    await AppDataSource.getRepository(ChurchPortalRefreshToken).delete({ churchPortalUserId: user.id });

    return { message: 'Password reset successfully.' };
  }

  async getMe(portalUserId: string) {
    const userRepo = AppDataSource.getRepository(ChurchPortalUser);
    const user = await userRepo.findOne({
      where: { id: portalUserId },
      select: ['id', 'email', 'firstName', 'lastName', 'role', 'isActive', 'churchPortalId', 'lastLoginAt', 'createdAt'],
    });
    if (!user) throw new NotFoundError('User not found');
    return user;
  }

  async updateMe(portalUserId: string, data: UpdateProfileInput) {
    const userRepo = AppDataSource.getRepository(ChurchPortalUser);
    await userRepo.update(portalUserId, data);
    return this.getMe(portalUserId);
  }

  async sendInviteEmail(portalUser: ChurchPortalUser, portal: ChurchPortal, inviteToken: string) {
    const inviteUrl = `${process.env.CHURCH_PORTAL_URL || 'https://admin.spiriment.com'}/church/${portal.slug}/accept-invite?token=${inviteToken}`;

    await this.emailService.sendEmailWithTemplate({
      to: portalUser.email,
      subject: `You've been invited to manage ${portal.name} on Spiriment`,
      partialName: 'church-portal-invite',
      templateData: {
        name: portalUser.firstName || 'Pastor',
        churchName: portal.name,
        role: portalUser.role,
        inviteUrl,
        expiryHours: INVITE_EXPIRY_HOURS,
      },
    });
  }
}
