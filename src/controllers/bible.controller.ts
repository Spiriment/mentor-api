import { Request, Response, NextFunction } from 'express';
import { BibleService, BibleLanguage } from '@/services/bible.service';
import { sendSuccessResponse } from '@/common/helpers';

export class BibleController {
  private bible: BibleService;

  constructor(bible: BibleService) {
    this.bible = bible;
  }

  getChapter = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { book, chapter } = req.params as { book: string; chapter: string };
      const { lang, translation } = req.query as { lang?: string; translation?: string };

      // Reject if book is "user" - this should be handled by bibleUserRoutes
      if (book === 'user') {
        return res.status(404).json({
          success: false,
          error: { message: 'Route not found. Use /api/bible/user/* for user-specific endpoints.', code: 'ROUTE_NOT_FOUND' }
        });
      }

      // Validate book parameter
      if (!book || typeof book !== 'string' || book.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: { message: 'Book parameter is required and must be a non-empty string', code: 'INVALID_BOOK' }
        });
      }

      // Validate and parse chapter parameter
      const chapterNum = Number(chapter);
      if (!chapter || chapter.trim().length === 0 || isNaN(chapterNum) || chapterNum <= 0 || !Number.isInteger(chapterNum)) {
        return res.status(400).json({
          success: false,
          error: {
            message: `Chapter parameter is required and must be a positive integer. Received: ${chapter}`,
            code: 'INVALID_CHAPTER'
          }
        });
      }

      // Validate and normalize language code
      const language: BibleLanguage =
        lang === 'deu' || lang === 'nld' ? (lang as BibleLanguage) : 'eng';

      const data = await this.bible.getChapter(book, chapterNum, language, translation as any);
      return sendSuccessResponse(res, data);
    } catch (err) {
      next(err);
    }
  };

  getPassage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { reference, lang } = req.query as { reference?: string; lang?: string };
      if (!reference) {
        return res
          .status(400)
          .json({ success: false, error: { message: 'reference is required', code: 'MISSING_REFERENCE' } });
      }
      
      // Validate and normalize language code
      const language: BibleLanguage = 
        lang === 'deu' || lang === 'nld' ? (lang as BibleLanguage) : 'eng';
      
      const data = await this.bible.getPassage(reference, language);
      return sendSuccessResponse(res, data);
    } catch (err) {
      next(err);
    }
  };

  getAvailableLanguages = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const languages = this.bible.getAvailableLanguages();
      const languagesWithNames = languages.map(lang => ({
        code: lang,
        name: this.bible.getLanguageName(lang),
      }));
      return sendSuccessResponse(res, { languages: languagesWithNames });
    } catch (err) {
      next(err);
    }
  };

  getAvailableTranslations = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const translations = this.bible.getAvailableTranslations();
      return sendSuccessResponse(res, { translations });
    } catch (err) {
      next(err);
    }
  };
}
