import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '@/common';
import { sendSuccessResponse } from '@/common/helpers';
import { safetyService } from '@/services/safety.service';

/**
 * Report & block, for admins. Base path: /api/admin/safety
 * (reports themselves are listed and updated under /api/admin/reports)
 */
const router = Router();

const blocksQuerySchema = z.object({
  review: z.enum(['pending', 'cancelled', 'kept', 'withdrawn', 'none', 'all']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const sessionsDecisionSchema = z.object({
  decision: z.enum(['cancel', 'keep']),
  notes: z.string().max(2000).nullable().optional(),
});

router.get('/summary', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    return sendSuccessResponse(res, await safetyService.adminSummary());
  } catch (e) { next(e); }
});

router.get('/blocks', validate(blocksQuerySchema, 'query'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = req.query as Record<string, string | undefined>;
    return sendSuccessResponse(
      res,
      await safetyService.listBlocksForAdmin({
        review: q.review ?? 'pending',
        page: q.page ? Number(q.page) : undefined,
        limit: q.limit ? Number(q.limit) : undefined,
      }),
    );
  } catch (e) { next(e); }
});

/** Cancel or keep the sessions a block affects */
router.post(
  '/blocks/:id/sessions',
  validate(sessionsDecisionSchema, 'body'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      return sendSuccessResponse(
        res,
        await safetyService.resolveBlockSessions(req.params.id, req.body.decision, req.admin!.id, req.body.notes, req.ip),
      );
    } catch (e) { next(e); }
  },
);

export default router;
