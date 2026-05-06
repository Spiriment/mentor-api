import { Request, Response, NextFunction } from 'express';
import { sendSuccessResponse } from '@/common/helpers';
import { adminSubscriptionService } from '@/services/adminSubscription.service';
import { AppError } from '@/common';
import { PromoCodeType } from '@/database/entities/promoCode.entity';

export class AdminSubscriptionController {
  getSummary = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const summary = await adminSubscriptionService.getSummary(
        req.admin!.role
      );
      return sendSuccessResponse(res, summary);
    } catch (e) {
      next(e);
    }
  };

  listIndividual = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const result = await adminSubscriptionService.listIndividualSubscribers(
        page,
        limit
      );
      return sendSuccessResponse(res, result);
    } catch (e) {
      next(e);
    }
  };

  // ─── Promo codes ───────────────────────────────────────────────────────────

  createPromoCode = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type, discountPercent, tier, usageLimit, expiresAt, notes } =
        req.body as {
          type: PromoCodeType;
          discountPercent?: number;
          tier?: string;
          usageLimit?: number | null;
          expiresAt?: string | null;
          notes?: string | null;
        };

      if (!['ambassador', 'internal_test'].includes(type)) {
        throw new AppError('type must be ambassador or internal_test', 400);
      }

      const result = await adminSubscriptionService.createPromoCode(
        { type, discountPercent, tier, usageLimit, expiresAt, notes },
        req.admin!.id,
        req.ip,
      );
      return sendSuccessResponse(res, result);
    } catch (e) {
      next(e);
    }
  };

  listPromoCodes = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const type = req.query.type as PromoCodeType | undefined;

      const result = await adminSubscriptionService.listPromoCodes(page, limit, type);
      return sendSuccessResponse(res, result);
    } catch (e) {
      next(e);
    }
  };

  updatePromoCode = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { discountPercent, tier, usageLimit, expiresAt, isActive, notes } =
        req.body as {
          discountPercent?: number;
          tier?: string;
          usageLimit?: number | null;
          expiresAt?: string | null;
          isActive?: boolean;
          notes?: string | null;
        };

      const result = await adminSubscriptionService.updatePromoCode(
        id,
        { discountPercent, tier, usageLimit, expiresAt, isActive, notes },
        req.admin!.id,
        req.ip,
      );
      return sendSuccessResponse(res, result);
    } catch (e) {
      next(e);
    }
  };
}

export const adminSubscriptionController = new AdminSubscriptionController();
