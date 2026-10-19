import { Request, Response, NextFunction } from 'express';
import { MoreThanOrEqual } from 'typeorm';
import { AppDataSource } from '@/config/data-source';
import { sendSuccessResponse } from '@/common/helpers';
import { validate as isUuid } from 'uuid';
import { VideoUploadAttempt } from '@/database/entities/videoUploadAttempt.entity';
import { sanitizeVideoUploadAttempt } from '@/common/videoUploadAttempt';

export const videoUploadAttemptController = {
  /** App → POST /api/upload/video-introduction/attempts (one row per attempt) */
  async record(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
      const attempt = sanitizeVideoUploadAttempt(req.body ?? {});
      if (!attempt) {
        return res.status(400).json({ success: false, error: { message: 'Invalid upload attempt report' } });
      }
      const repo = AppDataSource.getRepository(VideoUploadAttempt);
      await repo.save(
        repo.create({
          userId,
          ...attempt,
          originalSizeBytes: attempt.originalSizeBytes?.toString() ?? null,
          uploadSizeBytes: attempt.uploadSizeBytes?.toString() ?? null,
        }),
      );
      return res.status(201).json({ success: true });
    } catch (e) {
      next(e);
    }
  },

  /**
   * Admin → GET /admin/mentor-applications/video-upload-attempts?userId=&days=
   * One applicant's attempts, or recent attempts across all mentors with a summary.
   */
  async adminList(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = typeof req.query.userId === 'string' && isUuid(req.query.userId) ? req.query.userId : null;
      const days = Math.min(Math.max(Number(req.query.days) || 7, 1), 90);
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const repo = AppDataSource.getRepository(VideoUploadAttempt);

      const attempts = await repo.find({
        where: userId ? { userId } : { createdAt: MoreThanOrEqual(since) },
        order: { createdAt: 'DESC' },
        take: userId ? 50 : 200,
      });
      const summary = { success: 0, failed: 0, rejected: 0 };
      for (const a of attempts) {
        if (a.outcome in summary) summary[a.outcome as keyof typeof summary]++;
      }
      return sendSuccessResponse(res, { days: userId ? null : days, summary, attempts });
    } catch (e) {
      next(e);
    }
  },
};
