import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Like, ILike } from 'typeorm';
import { AppDataSource } from '@/config/data-source';
import { jwt } from '@/config/int-services';
import { EmailService } from '@/core/email.service';
import { ChurchPortal } from '@/church-portal/entities/churchPortal.entity';
import { ChurchPortalUser } from '@/church-portal/entities/churchPortalUser.entity';
import { User } from '@/database/entities/user.entity';
import { Session, SESSION_STATUS } from '@/database/entities/session.entity';
import { USER_ROLE } from '@/common/constants';
import { ConflictError, NotFoundError } from '@/common/errors';
import { generateUniqueJoinCode } from '@/church-portal/utils/joinCode';
import type {
  CreateChurchPortalInput,
  UpdateChurchPortalInput,
  CreateChurchPortalUserInput,
  ListChurchPortalsQuery,
} from '@/validation/adminChurchPortals.validation';

const INVITE_TOKEN_EXPIRY_HOURS = 48;

export class AdminChurchPortalService {
  constructor(private readonly emailService: EmailService) {}

  async listPortals(query: ListChurchPortalsQuery) {
    const repo = AppDataSource.getRepository(ChurchPortal);
    const where: Record<string, any> = {};

    if (query.status) where.status = query.status;
    if (query.search) where.name = ILike(`%${query.search}%`);

    const [portals, total] = await repo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: query.limit,
      skip: (query.page - 1) * query.limit,
    });

    // Attach member counts
    const userRepo = AppDataSource.getRepository(User);
    const withCounts = await Promise.all(
      portals.map(async (p) => {
        const [mentors, mentees] = await Promise.all([
          userRepo.count({ where: { churchPortalId: p.id, role: USER_ROLE.MENTOR } }),
          userRepo.count({ where: { churchPortalId: p.id, role: USER_ROLE.MENTEE } }),
        ]);
        return { ...p, mentorCount: mentors, menteeCount: mentees };
      })
    );

    return {
      data: withCounts,
      meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) },
    };
  }

  async getPortal(portalId: string) {
    const repo = AppDataSource.getRepository(ChurchPortal);
    const portal = await repo.findOne({ where: { id: portalId } });
    if (!portal) throw new NotFoundError('Church portal not found');

    const userRepo = AppDataSource.getRepository(User);
    const [mentors, mentees] = await Promise.all([
      userRepo.count({ where: { churchPortalId: portalId, role: USER_ROLE.MENTOR } }),
      userRepo.count({ where: { churchPortalId: portalId, role: USER_ROLE.MENTEE } }),
    ]);

    return { ...portal, mentorCount: mentors, menteeCount: mentees };
  }

  async createPortal(data: CreateChurchPortalInput) {
    const repo = AppDataSource.getRepository(ChurchPortal);

    const existing = await repo.findOne({ where: { slug: data.slug } });
    if (existing) throw new ConflictError(`Slug "${data.slug}" is already taken`);

    const portal = repo.create({
      name: data.name,
      slug: data.slug,
      orgPlanId: data.orgPlanId ?? null,
      denomination: data.denomination ?? null,
      city: data.city ?? null,
      country: data.country ?? null,
      timezone: data.timezone ?? 'UTC',
      logoUrl: data.logoUrl ?? null,
      status: 'active',
    });

    let saved = await repo.save(portal);
    saved.joinCode = await generateUniqueJoinCode(repo);
    saved = await repo.save(saved);
    return saved;
  }

  async updatePortal(portalId: string, data: UpdateChurchPortalInput) {
    const repo = AppDataSource.getRepository(ChurchPortal);
    const portal = await repo.findOne({ where: { id: portalId } });
    if (!portal) throw new NotFoundError('Church portal not found');

    Object.assign(portal, data);
    return repo.save(portal);
  }

  // ── Portal Users (pastors) ──────────────────────────────────────────────

  async listPortalUsers(portalId: string) {
    await this._requirePortal(portalId);
    const repo = AppDataSource.getRepository(ChurchPortalUser);
    return repo.find({
      where: { churchPortalId: portalId },
      select: ['id', 'email', 'firstName', 'lastName', 'role', 'isActive', 'lastLoginAt', 'createdAt'],
      order: { createdAt: 'DESC' },
    });
  }

  async createPortalUser(portalId: string, data: CreateChurchPortalUserInput) {
    const portal = await this._requirePortal(portalId);
    const repo = AppDataSource.getRepository(ChurchPortalUser);

    const existing = await repo.findOne({ where: { email: data.email.toLowerCase() } });
    if (existing) throw new ConflictError('A portal user with this email already exists');

    // Generate a signed invite JWT (48h expiry)
    const tempUser = repo.create({
      churchPortalId: portalId,
      email: data.email.toLowerCase(),
      firstName: data.firstName ?? null,
      lastName: data.lastName ?? null,
      role: data.role ?? 'pastor',
      isActive: false,
      password: null,
    });
    const saved = await repo.save(tempUser);

    const inviteToken = jwt.signChurchPortalInviteToken(
      { portalUserId: saved.id, churchPortalId: portalId, email: saved.email },
      `${INVITE_TOKEN_EXPIRY_HOURS}h`
    );

    const inviteTokenExpiresAt = new Date();
    inviteTokenExpiresAt.setHours(inviteTokenExpiresAt.getHours() + INVITE_TOKEN_EXPIRY_HOURS);

    await repo.update(saved.id, { inviteToken, inviteTokenExpiresAt });

    // Send invite email
    await this._sendInviteEmail(saved, portal, inviteToken);

    return {
      id: saved.id,
      email: saved.email,
      firstName: saved.firstName,
      lastName: saved.lastName,
      role: saved.role,
      isActive: saved.isActive,
      createdAt: saved.createdAt,
      message: `Invite email sent to ${saved.email}`,
    };
  }

  async deactivatePortalUser(portalId: string, userId: string) {
    await this._requirePortal(portalId);
    const repo = AppDataSource.getRepository(ChurchPortalUser);
    const user = await repo.findOne({ where: { id: userId, churchPortalId: portalId } });
    if (!user) throw new NotFoundError('Portal user not found');
    await repo.update(userId, { isActive: false });
    return { message: 'Portal user deactivated' };
  }

  async reactivatePortalUser(portalId: string, userId: string) {
    await this._requirePortal(portalId);
    const repo = AppDataSource.getRepository(ChurchPortalUser);
    const user = await repo.findOne({ where: { id: userId, churchPortalId: portalId } });
    if (!user) throw new NotFoundError('Portal user not found');
    await repo.update(userId, { isActive: true });
    return { message: 'Portal user reactivated' };
  }

  async resendInvite(portalId: string, userId: string) {
    const portal = await this._requirePortal(portalId);
    const repo = AppDataSource.getRepository(ChurchPortalUser);
    const user = await repo.findOne({
      where: { id: userId, churchPortalId: portalId },
      select: ['id', 'email', 'firstName', 'lastName', 'role', 'isActive', 'password'],
    });
    if (!user) throw new NotFoundError('Portal user not found');
    if (user.password) throw new ConflictError('User has already accepted the invite and set their password');

    const inviteToken = jwt.signChurchPortalInviteToken(
      { portalUserId: user.id, churchPortalId: portalId, email: user.email },
      `${INVITE_TOKEN_EXPIRY_HOURS}h`
    );
    const inviteTokenExpiresAt = new Date();
    inviteTokenExpiresAt.setHours(inviteTokenExpiresAt.getHours() + INVITE_TOKEN_EXPIRY_HOURS);

    await repo.update(user.id, { inviteToken, inviteTokenExpiresAt });
    await this._sendInviteEmail(user, portal, inviteToken);

    return { message: `Invite resent to ${user.email}` };
  }

  // ── App Members in this portal ──────────────────────────────────────────

  async listPortalMembers(portalId: string, role?: string, page = 1, limit = 20) {
    await this._requirePortal(portalId);
    const userRepo = AppDataSource.getRepository(User);

    const where: Record<string, any> = { churchPortalId: portalId };
    if (role === 'mentor') where.role = USER_ROLE.MENTOR;
    if (role === 'mentee') where.role = USER_ROLE.MENTEE;

    const [users, total] = await userRepo.findAndCount({
      where,
      select: ['id', 'firstName', 'lastName', 'email', 'role', 'currentStreak', 'lastActiveAt', 'createdAt'],
      order: { createdAt: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });

    return {
      data: users,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getPortalReport(portalId: string) {
    await this._requirePortal(portalId);
    const userRepo = AppDataSource.getRepository(User);
    const sessionRepo = AppDataSource.getRepository(Session);

    const [totalMentors, totalMentees] = await Promise.all([
      userRepo.count({ where: { churchPortalId: portalId, role: USER_ROLE.MENTOR } }),
      userRepo.count({ where: { churchPortalId: portalId, role: USER_ROLE.MENTEE } }),
    ]);

    const allUsers = await userRepo.find({
      where: { churchPortalId: portalId },
      select: ['currentStreak', 'longestStreak'],
    });

    const avgStreak = allUsers.length
      ? Math.round(allUsers.reduce((a, u) => a + u.currentStreak, 0) / allUsers.length)
      : 0;

    const totalCompletedSessions = await sessionRepo
      .createQueryBuilder('s')
      .innerJoin(User, 'mentor', 'mentor.id = s.mentorId AND mentor.churchPortalId = :cpId')
      .where('s.status = :status', { status: SESSION_STATUS.COMPLETED })
      .setParameter('cpId', portalId)
      .getCount();

    return { totalMentors, totalMentees, avgStreak, totalCompletedSessions };
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  private async _requirePortal(portalId: string): Promise<ChurchPortal> {
    const repo = AppDataSource.getRepository(ChurchPortal);
    const portal = await repo.findOne({ where: { id: portalId } });
    if (!portal) throw new NotFoundError('Church portal not found');
    return portal;
  }

  private async _sendInviteEmail(user: ChurchPortalUser, portal: ChurchPortal, inviteToken: string) {
    const baseUrl = process.env.CHURCH_PORTAL_URL || 'https://admin.spiriment.com';
    const inviteUrl = `${baseUrl}/church/${portal.slug}/accept-invite?token=${inviteToken}`;

    await this.emailService.sendEmailWithTemplate({
      to: user.email,
      subject: `You've been invited to manage ${portal.name} on Spiriment`,
      partialName: 'church-portal-invite',
      templateData: {
        name: user.firstName || 'Pastor',
        churchName: portal.name,
        role: user.role,
        inviteUrl,
        expiryHours: INVITE_TOKEN_EXPIRY_HOURS,
      },
    });
  }
}
