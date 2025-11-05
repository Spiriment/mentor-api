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
      const { lang } = req.query as { lang?: string };
      
      // Validate and normalize language code
      const language: BibleLanguage = 
        lang === 'deu' || lang === 'nld' ? (lang as BibleLanguage) : 'eng';
      
      const data = await this.bible.getChapter(book, Number(chapter), language);
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
}
