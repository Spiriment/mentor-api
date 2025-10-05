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
      const list = await repo.find({ where: { userId: req.user!.id } });
      res.json({ success: true, data: list });
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
