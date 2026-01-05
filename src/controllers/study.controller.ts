import { Request, Response, NextFunction, Router } from 'express';
import { AppDataSource } from '@/config/data-source';
import { StudyService } from '@/services/study.service';
import { authenticateToken } from '../middleware/auth.middleware';

const studyService = new StudyService(AppDataSource);

export const studyRoutes = Router();

// All routes require authentication
studyRoutes.use(authenticateToken);

// Progress
studyRoutes.get(
  '/progress',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id as string;
      const progress = await studyService.getProgress(userId);
      res.json({ data: progress });
    } catch (error) {
      next(error);
    }
  }
);

studyRoutes.put(
  '/progress',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id as string;
      const updated = await studyService.upsertProgress({
        ...req.body,
        userId,
      });
      res.json({ data: updated });
    } catch (error) {
      next(error);
    }
  }
);

// Sessions
studyRoutes.get(
  '/sessions',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id as string;
      const sessions = await studyService.listSessions(userId);
      res.json({ data: sessions });
    } catch (error) {
      next(error);
    }
  }
);

studyRoutes.post(
  '/sessions',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id as string;
      const created = await studyService.addSession({
        ...req.body,
        userId,
      } as any);
      res.status(201).json({ data: created });
    } catch (error) {
      next(error);
    }
  }
);

// Reflections
studyRoutes.get(
  '/reflections',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id as string;
      const { book, page, limit, startDate, endDate } = req.query;

      const result = await studyService.listReflections(userId, {
        book: book as string | undefined,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
      });

      res.json({
        success: true,
        data: result.reflections,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get reflection books for filter dropdown
studyRoutes.get(
  '/reflections/books',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id as string;
      const books = await studyService.getReflectionBooks(userId);
      res.json({ success: true, data: books });
    } catch (error) {
      next(error);
    }
  }
);

studyRoutes.post(
  '/reflections',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id as string;
      const created = await studyService.addReflection({
        ...req.body,
        userId,
      } as any);
      res.status(201).json({ data: created });
    } catch (error) {
      next(error);
    }
  }
);

export default studyRoutes;
