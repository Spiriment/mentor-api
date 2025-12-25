import { Request, Response, NextFunction } from 'express';
import { AppDataSource } from '@/config/data-source';
import {
  BibleBookmark,
  BibleHighlight,
  BibleReflection,
  BibleProgress,
} from '@/database/entities';

export class BibleUserController {
  addBookmark = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const repo = AppDataSource.getRepository(BibleBookmark);
      const entity = repo.create({ userId: req.user!.id, ...req.body });
      const saved = await repo.save(entity);
      res.json({ success: true, data: saved });
    } catch (err) {
      next(err);
    }
  };

  getBookmarks = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const repo = AppDataSource.getRepository(BibleBookmark);
      const { book, page, limit } = req.query;

      const pageNum = page ? parseInt(page as string) : 1;
      const limitNum = limit ? parseInt(limit as string) : 20;
      const skip = (pageNum - 1) * limitNum;

      // Build where clause
      const where: any = { userId: req.user!.id };
      if (book) {
        where.book = book as string;
      }

      // Get total count
      const total = await repo.count({ where });

      // Get paginated bookmarks
      const list = await repo.find({
        where,
        order: { createdAt: 'DESC' },
        take: limitNum,
        skip,
      });

      res.json({
        success: true,
        data: list,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      });
    } catch (err) {
      next(err);
    }
  };

  getBookmarkBooks = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const repo = AppDataSource.getRepository(BibleBookmark);
      const bookmarks = await repo.find({
        where: { userId: req.user!.id },
        select: ['book'],
      });

      // Get unique books
      const books = Array.from(new Set(bookmarks.map(b => b.book)));
      res.json({ success: true, data: books.sort() });
    } catch (err) {
      next(err);
    }
  };

  addHighlight = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const repo = AppDataSource.getRepository(BibleHighlight);
      const entity = repo.create({ userId: req.user!.id, ...req.body });
      const saved = await repo.save(entity);
      res.json({ success: true, data: saved });
    } catch (err) {
      next(err);
    }
  };

  getHighlights = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const repo = AppDataSource.getRepository(BibleHighlight);
      const list = await repo.find({ where: { userId: req.user!.id } });
      res.json({ success: true, data: list });
    } catch (err) {
      next(err);
    }
  };

  addReflection = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const repo = AppDataSource.getRepository(BibleReflection);
      const entity = repo.create({ userId: req.user!.id, ...req.body });
      const saved = await repo.save(entity);
      res.json({ success: true, data: saved });
    } catch (err) {
      next(err);
    }
  };

  getReflections = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const repo = AppDataSource.getRepository(BibleReflection);
      const list = await repo.find({ where: { userId: req.user!.id } });
      res.json({ success: true, data: list });
    } catch (err) {
      next(err);
    }
  };

  getProgress = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const repo = AppDataSource.getRepository(BibleProgress);
      const item = await repo.findOne({
        where: { userId: req.user!.id, plan: req.params.plan },
      });
      res.json({ success: true, data: item });
    } catch (err) {
      next(err);
    }
  };

  updateProgress = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const repo = AppDataSource.getRepository(BibleProgress);
      let item = await repo.findOne({
        where: { userId: req.user!.id, plan: req.params.plan },
      });
      if (!item) {
        item = repo.create({
          userId: req.user!.id,
          plan: req.params.plan,
          currentDay: 0,
          completedDays: [],
        });
      }
      Object.assign(item, req.body);
      const saved = await repo.save(item);
      res.json({ success: true, data: saved });
    } catch (err) {
      next(err);
    }
  };
}
