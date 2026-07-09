import { Request, Response, NextFunction } from 'express';
import { referralService } from '@/services/referral.service';

export class ReferralController {
  /** GET /referral/my-code — mentor gets their code + stats */
  getMyCode = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      const data = await referralService.getOrCreateCode(userId);
      res.json({ success: true, response: data });
    } catch (err) {
      next(err);
    }
  };

  /** GET /referral/stats — mentor gets full referral history */
  getStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      const data = await referralService.getStats(userId);
      res.json({ success: true, response: data });
    } catch (err) {
      next(err);
    }
  };

  /** GET /referral/lookup/:code — validate a code during signup (public) */
  lookupCode = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { code } = req.params;
      const referrer = await referralService.findReferrer(code);
      if (!referrer) {
        res.status(404).json({ success: false, error: { message: 'Invalid referral code.' } });
        return;
      }
      res.json({
        success: true,
        response: {
          valid: true,
          referrerName: referrer.firstName ? `${referrer.firstName} ${referrer.lastName ?? ''}`.trim() : 'A mentor',
        },
      });
    } catch (err) {
      next(err);
    }
  };
}

export const referralController = new ReferralController();
