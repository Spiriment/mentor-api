import { In } from 'typeorm';
import { AppDataSource } from '@/config/data-source';
import { User } from '@/database/entities/user.entity';
import { ChurchPortal } from '../entities/churchPortal.entity';
import {
  ChurchPortalJoinRequest,
  CHURCH_JOIN_REQUEST_STATUS,
} from '../entities/churchPortalJoinRequest.entity';
import { AppError } from '@/common/errors';
import { StatusCodes } from 'http-status-codes';

function portalPreview(portal: ChurchPortal) {
  return {
    id: portal.id,
    name: portal.name,
    slug: portal.slug,
    logoUrl: portal.logoUrl,
    denomination: portal.denomination,
  };
}

export class ChurchPortalJoinRequestService {
  async findPortalByCodeOrSlug(code?: string, slug?: string): Promise<ChurchPortal | null> {
    const repo = AppDataSource.getRepository(ChurchPortal);
    const normalizedCode = code?.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (normalizedCode && normalizedCode.length >= 4) {
      const byCode = await repo.findOne({
        where: { joinCode: normalizedCode, status: 'active' },
      });
      if (byCode) return byCode;
    }
    const s = slug?.trim().toLowerCase();
    if (s) {
      return repo.findOne({
        where: { slug: s, status: 'active' },
      });
    }
    return null;
  }

  async requestJoin(appUserId: string, opts: { code?: string; slug?: string }) {
    const portal = await this.findPortalByCodeOrSlug(opts.code, opts.slug);
    if (!portal) {
      throw new AppError(
        'Church not found. Check the code with your pastor.',
        StatusCodes.NOT_FOUND,
        'PORTAL_NOT_FOUND'
      );
    }

    const userRepo = AppDataSource.getRepository(User);
    const joinRepo = AppDataSource.getRepository(ChurchPortalJoinRequest);

    const user = await userRepo.findOne({
      where: { id: appUserId },
      select: ['id', 'churchPortalId'],
    });
    if (!user) {
      throw new AppError('User not found', StatusCodes.NOT_FOUND, 'USER_NOT_FOUND');
    }

    if (user.churchPortalId === portal.id) {
      return {
        membershipStatus: 'active' as const,
        message: `You are already part of ${portal.name}`,
        church: portalPreview(portal),
      };
    }

    if (user.churchPortalId && user.churchPortalId !== portal.id) {
      throw new AppError(
        'Leave your current church in settings before requesting to join another.',
        StatusCodes.BAD_REQUEST,
        'ALREADY_IN_CHURCH'
      );
    }

    let row = await joinRepo.findOne({
      where: { churchPortalId: portal.id, userId: appUserId },
    });

    if (row?.status === CHURCH_JOIN_REQUEST_STATUS.PENDING) {
      return {
        membershipStatus: 'pending' as const,
        message: 'Your request is pending pastor approval.',
        church: portalPreview(portal),
      };
    }

    if (row?.status === CHURCH_JOIN_REQUEST_STATUS.APPROVED) {
      await userRepo.update(appUserId, { churchPortalId: portal.id });
      return {
        membershipStatus: 'active' as const,
        message: `You are now linked to ${portal.name}`,
        church: portalPreview(portal),
      };
    }

    if (row?.status === CHURCH_JOIN_REQUEST_STATUS.REJECTED) {
      row.status = CHURCH_JOIN_REQUEST_STATUS.PENDING;
      row.resolvedAt = null;
      await joinRepo.save(row);
      return {
        membershipStatus: 'pending' as const,
        message: 'Join request sent. Your pastor will review it.',
        church: portalPreview(portal),
      };
    }

    const created = joinRepo.create({
      churchPortalId: portal.id,
      userId: appUserId,
      status: CHURCH_JOIN_REQUEST_STATUS.PENDING,
    });
    await joinRepo.save(created);

    return {
      membershipStatus: 'pending' as const,
      message: 'Join request sent. Your pastor will review it.',
      church: portalPreview(portal),
    };
  }

  async clearMembershipAndRequests(appUserId: string) {
    const userRepo = AppDataSource.getRepository(User);
    const joinRepo = AppDataSource.getRepository(ChurchPortalJoinRequest);
    await userRepo.update(appUserId, { churchPortalId: null, churchDiscountPercent: 0 });
    await joinRepo.delete({ userId: appUserId });
  }

  async getAppUserMembershipState(appUserId: string) {
    const userRepo = AppDataSource.getRepository(User);
    const portalRepo = AppDataSource.getRepository(ChurchPortal);
    const joinRepo = AppDataSource.getRepository(ChurchPortalJoinRequest);

    const user = await userRepo.findOne({
      where: { id: appUserId },
      select: ['churchPortalId'],
    });

    if (user?.churchPortalId) {
      const portal = await portalRepo.findOne({
        where: { id: user.churchPortalId },
        select: ['id', 'name', 'slug', 'logoUrl', 'denomination'],
      });
      return {
        membershipStatus: 'active' as const,
        church: portal ? portalPreview(portal as ChurchPortal) : null,
        pendingJoin: null,
      };
    }

    const pendingRow = await joinRepo.findOne({
      where: { userId: appUserId, status: CHURCH_JOIN_REQUEST_STATUS.PENDING },
    });

    if (pendingRow) {
      const portal = await portalRepo.findOne({
        where: { id: pendingRow.churchPortalId },
        select: ['id', 'name', 'slug', 'logoUrl', 'denomination'],
      });
      return {
        membershipStatus: 'pending' as const,
        church: null,
        pendingJoin: portal ? portalPreview(portal as ChurchPortal) : null,
      };
    }

    return {
      membershipStatus: 'none' as const,
      church: null,
      pendingJoin: null,
    };
  }

  async listPendingForPortal(churchPortalId: string) {
    const joinRepo = AppDataSource.getRepository(ChurchPortalJoinRequest);
    const userRepo = AppDataSource.getRepository(User);

    const rows = await joinRepo.find({
      where: { churchPortalId, status: CHURCH_JOIN_REQUEST_STATUS.PENDING },
      order: { createdAt: 'ASC' },
    });

    if (rows.length === 0) return [];

    const ids = rows.map((r) => r.userId);
    const users = await userRepo.find({
      where: { id: In(ids) },
      select: ['id', 'email', 'firstName', 'lastName', 'role'],
    });
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

    return rows.map((r) => {
      const u = userMap[r.userId];
      return {
        id: r.id,
        userId: r.userId,
        createdAt: r.createdAt,
        user: u
          ? {
              id: u.id,
              email: u.email,
              firstName: u.firstName,
              lastName: u.lastName,
              role: u.role,
            }
          : null,
      };
    });
  }

  async approve(churchPortalId: string, userId: string) {
    const joinRepo = AppDataSource.getRepository(ChurchPortalJoinRequest);
    const userRepo = AppDataSource.getRepository(User);
    const portalRepo = AppDataSource.getRepository(ChurchPortal);

    const row = await joinRepo.findOne({
      where: { churchPortalId, userId, status: CHURCH_JOIN_REQUEST_STATUS.PENDING },
    });
    if (!row) {
      throw new AppError('No pending request for this member.', StatusCodes.NOT_FOUND, 'NOT_FOUND');
    }

    const portal = await portalRepo.findOne({ where: { id: churchPortalId } });
    const discount = portal?.discountPercent ?? 0;

    await userRepo.update(userId, { churchPortalId, churchDiscountPercent: discount });
    row.status = CHURCH_JOIN_REQUEST_STATUS.APPROVED;
    row.resolvedAt = new Date();
    await joinRepo.save(row);

    return { message: 'Member approved and linked to your church.' };
  }

  async reject(churchPortalId: string, userId: string) {
    const joinRepo = AppDataSource.getRepository(ChurchPortalJoinRequest);
    const userRepo = AppDataSource.getRepository(User);

    const row = await joinRepo.findOne({
      where: { churchPortalId, userId, status: CHURCH_JOIN_REQUEST_STATUS.PENDING },
    });
    if (!row) {
      throw new AppError('No pending request for this member.', StatusCodes.NOT_FOUND, 'NOT_FOUND');
    }

    // Revoke any church discount since they were not approved
    await userRepo.update(userId, { churchDiscountPercent: 0 });
    row.status = CHURCH_JOIN_REQUEST_STATUS.REJECTED;
    row.resolvedAt = new Date();
    await joinRepo.save(row);

    return { message: 'Join request rejected.' };
  }
}

export const churchPortalJoinRequestService = new ChurchPortalJoinRequestService();
