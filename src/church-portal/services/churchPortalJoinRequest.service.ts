import { In, Not } from 'typeorm';
import { AppDataSource } from '@/config/data-source';
import { User } from '@/database/entities/user.entity';
import { ChurchPortal } from '../entities/churchPortal.entity';
import {
  ChurchPortalJoinRequest,
  CHURCH_JOIN_REQUEST_STATUS,
} from '../entities/churchPortalJoinRequest.entity';
import { AppError } from '@/common/errors';
import { StatusCodes } from 'http-status-codes';
import { syncChurchCouponsInBackground } from '@/services/churchDiscountSync.service';

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

    // One pending request at a time: asking to join this church withdraws requests elsewhere,
    // so two pastors can't both approve and silently move the member between churches
    await joinRepo.delete({
      userId: appUserId,
      status: CHURCH_JOIN_REQUEST_STATUS.PENDING,
      churchPortalId: Not(portal.id),
    });

    const pending = {
      membershipStatus: 'pending' as const,
      message: 'Join request sent. Your pastor will review it.',
      church: portalPreview(portal),
    };

    const row = await joinRepo.findOne({
      where: { churchPortalId: portal.id, userId: appUserId },
    });

    if (row?.status === CHURCH_JOIN_REQUEST_STATUS.PENDING) {
      return { ...pending, message: 'Your request is pending pastor approval.' };
    }

    if (row) {
      // Rejected, or approved earlier but no longer a member (removed by the pastor, or left):
      // either way the pastor decides again. Re-linking an old approval would let removed
      // members walk straight back in.
      row.status = CHURCH_JOIN_REQUEST_STATUS.PENDING;
      row.resolvedAt = null;
      await joinRepo.save(row);
      return pending;
    }

    try {
      await joinRepo.save(
        joinRepo.create({
          churchPortalId: portal.id,
          userId: appUserId,
          status: CHURCH_JOIN_REQUEST_STATUS.PENDING,
        })
      );
    } catch (err: any) {
      // Double tap: the other request created the row (unique churchPortalId + userId)
      if (err?.code !== 'ER_DUP_ENTRY') throw err;
    }
    return pending;
  }

  async clearMembershipAndRequests(appUserId: string) {
    const userRepo = AppDataSource.getRepository(User);
    const joinRepo = AppDataSource.getRepository(ChurchPortalJoinRequest);
    const user = await userRepo.findOne({
      where: { id: appUserId },
      select: ['id', 'churchPortalId'],
    });
    const previousPortalId = user?.churchPortalId ?? null;
    await userRepo.update(appUserId, { churchPortalId: null, churchDiscountPercent: 0 });
    await joinRepo.delete({ userId: appUserId });
    if (previousPortalId) {
      const { adminOrgPlanService } = await import('@/services/adminOrgPlan.service');
      // Leaving the church also ends what the church pays for (seat + church-billed plan)
      await adminOrgPlanService.endChurchPaidAccessForPortal(appUserId, previousPortalId);
      await adminOrgPlanService.syncChurchPortalMemberDiscounts(previousPortalId);
      syncChurchCouponsInBackground([appUserId], 'left church');
    }
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

    const portal = await AppDataSource.getRepository(ChurchPortal).findOne({ where: { id: churchPortalId } });
    if (!portal) {
      throw new AppError('Church portal not found.', StatusCodes.NOT_FOUND, 'NOT_FOUND');
    }

    // Lock the member so two approvals (this church and another) can't both link them
    const outcome = await AppDataSource.transaction(async (manager) => {
      const row = await manager.getRepository(ChurchPortalJoinRequest).findOne({
        where: { churchPortalId, userId, status: CHURCH_JOIN_REQUEST_STATUS.PENDING },
        lock: { mode: 'pessimistic_write' },
      });
      if (!row) return 'no_request' as const;

      const user = await manager.getRepository(User).findOne({
        where: { id: userId },
        select: ['id', 'churchPortalId'],
        lock: { mode: 'pessimistic_write' },
      });
      if (!user) return 'stale' as const;
      if (user.churchPortalId && user.churchPortalId !== churchPortalId) return 'other_church' as const;

      await manager.getRepository(User).update(userId, { churchPortalId });
      row.status = CHURCH_JOIN_REQUEST_STATUS.APPROVED;
      row.resolvedAt = new Date();
      await manager.getRepository(ChurchPortalJoinRequest).save(row);
      return 'approved' as const;
    });

    if (outcome === 'no_request') {
      throw new AppError('No pending request for this member.', StatusCodes.NOT_FOUND, 'NOT_FOUND');
    }
    if (outcome === 'stale' || outcome === 'other_church') {
      // Clear it from the pastor's list; the member can ask again after leaving
      await joinRepo.delete({ churchPortalId, userId, status: CHURCH_JOIN_REQUEST_STATUS.PENDING });
      throw new AppError(
        outcome === 'stale'
          ? 'This account no longer exists.'
          : 'This person has already joined another church. They need to leave it in the app before joining yours.',
        StatusCodes.CONFLICT,
        outcome === 'stale' ? 'USER_NOT_FOUND' : 'ALREADY_IN_OTHER_CHURCH'
      );
    }

    const { adminOrgPlanService } = await import('@/services/adminOrgPlan.service');
    const discount = await adminOrgPlanService.syncChurchPortalMemberDiscounts(churchPortalId);

    return {
      message: 'Member approved and linked to your church.',
      discountPercent: discount,
    };
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
