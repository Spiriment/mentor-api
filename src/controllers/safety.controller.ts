import { Request, Response, NextFunction } from 'express';
import { safetyService } from '@/services/safety.service';

/** Report & block, for the apps. Base path: /api/safety */
export const createReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await safetyService.report(req.user!.id, req.body);
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
};

export const listBlocks = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: await safetyService.listMyBlocks(req.user!.id) });
  } catch (err) { next(err); }
};

export const blockStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: await safetyService.blockStatus(req.user!.id, req.params.userId) });
  } catch (err) { next(err); }
};

export const blockUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await safetyService.block(req.user!.id, req.params.userId);
    res.json({ success: true, data: { blocked: true } });
  } catch (err) { next(err); }
};

export const unblockUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await safetyService.unblock(req.user!.id, req.params.userId);
    res.json({ success: true, data: { blocked: false } });
  } catch (err) { next(err); }
};
