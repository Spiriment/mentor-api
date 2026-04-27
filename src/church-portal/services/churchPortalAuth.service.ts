import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { AppDataSource } from '@/config/data-source';
import { jwt } from '@/config/int-services';
import { EmailService } from '@/core/email.service';
import { AppError, NotFoundError, UnauthorizedError, ConflictError } from '@/common/errors';
import { ChurchPortal } from '../entities/churchPortal.entity';
import { ChurchPortalUser } from '../entities/churchPortalUser.entity';
import { ChurchPortalRefreshToken } from '../entities/churchPortalRefreshToken.entity';
import type { UpdateProfileInput } from '../validation/churchPortalAuth.validation';

const SALT_ROUNDS = 12;
const OTP_EXPIRY_MINUTES = 15;
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

export class ChurchPortalAuthService {
  private emailService: EmailService;

  constructor(emailService: EmailService) {
    this.emailService = emailService;
  }

  async getPortalInfo(slug: string) {
    const repo = AppDataSource.getRepository(ChurchPortal);
    const portal = await repo.findOne({
      where: { slug, status: 'active' },
      select: ['id', 'name', 'slug', 'logoUrl', 'denomination', 'timezone'],
    });
    if (!portal) throw new NotFoundError('Church portal not found');
    return portal;
  }

  async login(email: string, password: string, churchPortalId: string) {
    const userRepo = AppDataSource.getRepository(ChurchPortalUser);
    const portalRepo = AppDataSource.getRepository(ChurchPortal);

    const portal = await portalRepo.findOne({
      where: { id: churchPortalId, status: 'active' },
      select: ['id', 'name', 'slug', 'logoUrl'],
    });
    if (!portal) throw new UnauthorizedError('Church portal not found or inactive');

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
      portal: { id: portal.id, name: portal.name, slug: portal.slug, logoUrl: portal.logoUrl },
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
    const userRepo = AppDataSource.getRepository(ChurchPortalUser);
    const user = await userRepo.findOne({
      where: { email: email.toLowerCase(), churchPortalId },
      select: ['id', 'email', 'firstName'],
    });

    // Always return success to prevent email enumeration
    if (!user) return { message: 'If that email exists, a reset code has been sent.' };

    const otp = crypto.randomInt(100000, 999999).toString();
    const expiry = new Date();
    expiry.setMinutes(expiry.getMinutes() + OTP_EXPIRY_MINUTES);

    const hashedOtp = await bcrypt.hash(otp, 10);
    await userRepo.update(user.id, {
      inviteToken: hashedOtp,
      inviteTokenExpiresAt: expiry,
    });

    await this.emailService.sendEmailWithTemplate({
      to: user.email,
      subject: 'Your Church Portal Password Reset Code',
      partialName: 'otp-email',
      templateData: {
        name: user.firstName || 'Pastor',
        otp,
        expiryMinutes: OTP_EXPIRY_MINUTES,
      },
    });

    return { message: 'If that email exists, a reset code has been sent.' };
  }

  async resetPassword(email: string, otp: string, newPassword: string, churchPortalId: string) {
    const userRepo = AppDataSource.getRepository(ChurchPortalUser);
    const user = await userRepo.findOne({
      where: { email: email.toLowerCase(), churchPortalId },
      select: ['id', 'inviteToken', 'inviteTokenExpiresAt'],
    });

    if (!user || !user.inviteToken || !user.inviteTokenExpiresAt) {
      throw new AppError('Invalid or expired reset code', 400, 'INVALID_OTP');
    }
    if (user.inviteTokenExpiresAt < new Date()) {
      throw new AppError('Reset code has expired', 400, 'OTP_EXPIRED');
    }

    const valid = await bcrypt.compare(otp, user.inviteToken);
    if (!valid) throw new AppError('Invalid reset code', 400, 'INVALID_OTP');

    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await userRepo.update(user.id, {
      password: hashedPassword,
      inviteToken: null,
      inviteTokenExpiresAt: null,
    });

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
        expiryHours: 48,
      },
    });
  }
}
