import { Request, Response, NextFunction } from 'express';
import { BibleService } from '@/services/bible.service';

export class BibleController {
  private bible: BibleService;

  constructor(bible: BibleService) {
    this.bible = bible;
  }

  getChapter = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { book, chapter } = req.params as { book: string; chapter: string };
      const data = await this.bible.getChapter(book, Number(chapter));
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  getPassage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { reference } = req.query as { reference?: string };
      if (!reference) {
        return res
          .status(400)
          .json({ success: false, message: 'reference is required' });
      }
      const data = await this.bible.getPassage(reference);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };
}
