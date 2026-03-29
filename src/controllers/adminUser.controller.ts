import { Request, Response, NextFunction } from 'express';
import { sendSuccessResponse } from '@/common/helpers';
import { adminUserService } from '@/services/adminUser.service';
import { adminSubscriptionService } from '@/services/adminSubscription.service';

export class AdminUserController {
  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = req.query as Record<string, string | undefined>;
      const result = await adminUserService.listUsers({
        page: q.page ? Number(q.page) : undefined,
        limit: q.limit ? Number(q.limit) : undefined,
        sort: q.sort,
        search: q.search,
        role: q.role as 'mentee' | 'mentor' | 'all' | undefined,
        country: q.country,
        churchSearch: q.churchSearch,
      });
      return sendSuccessResponse(res, result);
    } catch (e) {
      next(e);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const detail = await adminUserService.getUserDetail(req.params.userId);
      return sendSuccessResponse(res, detail);
    } catch (e) {
      next(e);
    }
  };

  postDiscount = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const created = await adminUserService.addDiscount(
        req.params.userId,
        {
          type: req.body.type,
          value: req.body.value,
          label: req.body.label,
          validFrom: req.body.validFrom,
          validUntil: req.body.validUntil,
        },
        req.admin!.id,
        req.ip
      );
      return sendSuccessResponse(res, created, 201);
    } catch (e) {
      next(e);
    }
  };

  deleteDiscount = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await adminUserService.removeDiscount(
        req.params.userId,
        req.params.discountId,
        req.admin!.id,
        req.ip
      );
      return sendSuccessResponse(res, result);
    } catch (e) {
      next(e);
    }
  };

  putSubscription = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updated = await adminSubscriptionService.upsertForUser(
        req.params.userId,
        {
          tier: req.body.tier,
          status: req.body.status,
          mrrCents: req.body.mrrCents,
          currency: req.body.currency,
          expiresAt: req.body.expiresAt,
          externalProvider: req.body.externalProvider,
          externalRef: req.body.externalRef,
          notes: req.body.notes,
        },
        req.admin!.id,
        req.ip
      );
      return sendSuccessResponse(res, updated);
    } catch (e) {
      next(e);
    }
  };
}

export const adminUserController = new AdminUserController();
