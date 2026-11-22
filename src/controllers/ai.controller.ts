import { Request, Response, NextFunction } from 'express';
import { AppDataSource } from '@/config/data-source';
import { AiChapterSummary } from '@/database/entities/aiChapterSummary.entity';
import { MenteeProfile } from '@/database/entities/menteeProfile.entity';
import { aiService } from '@/services/ai.service';
import { BibleService } from '@/services/bible.service';
import { AppError } from '@/common';

// ─── Chapter Summary ──────────────────────────────────────────────────────────

const bibleService = new BibleService();

/**
 * The chapter's text from our own Bible source. The app also sends verseText, but when someone
 * moved to the next chapter it sometimes sent the *previous* chapter's verses (the new chapter
 * hadn't loaded yet). That summary was then cached for every user under the wrong chapter —
 * e.g. Nehemiah 7 showed chapter 6's summary. Returns '' if the text can't be fetched.
 */
async function fetchChapterText(book: string, chapter: number): Promise<string> {
  try {
    const data: any = await bibleService.getChapter(book, chapter, 'eng');
    const verses: any[] = Array.isArray(data?.verses) ? data.verses : [];
    return verses
      .map((v) => (typeof v?.text === 'string' ? v.text : ''))
      .join(' ')
      .trim();
  } catch {
    return '';
  }
}

export const getChapterSummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { book, chapter, verseText } = req.body as {
      book?: string;
      chapter?: number;
      verseText?: string;
    };

    if (!book || !chapter || !verseText) {
      throw new AppError('book, chapter, and verseText are required', 400);
    }

    const chapterNum = Number(chapter);
    if (!Number.isInteger(chapterNum) || chapterNum <= 0) {
      throw new AppError('chapter must be a positive integer', 400);
    }

    const repo = AppDataSource.getRepository(AiChapterSummary);

    // Return cached summary if it exists
    const cached = await repo.findOne({ where: { book, chapter: chapterNum } });
    if (cached) {
      return res.json({ success: true, data: { summary: cached.summary, cached: true } });
    }

    // Summarize the text we fetched ourselves. Only if that fails, fall back to what the app
    // sent — and then don't cache, so a possibly mismatched summary can't stick for everyone.
    const ownText = await fetchChapterText(book, chapterNum);
    const textIsTrusted = ownText.length > 0;
    const summary = await aiService.generateChapterSummary(
      book,
      chapterNum,
      textIsTrusted ? ownText : verseText
    );
    if (!summary) throw new AppError('Failed to generate summary', 500);

    if (textIsTrusted) {
      await repo.upsert({ book, chapter: chapterNum, summary }, ['book', 'chapter']);
    }

    res.json({ success: true, data: { summary, cached: false } });
  } catch (e) {
    next(e);
  }
};

// ─── Reflection Prompts ───────────────────────────────────────────────────────

export const getReflectionPrompts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { book, chapter, verse, verseText } = req.body as {
      book?: string;
      chapter?: number;
      verse?: string;
      verseText?: string;
    };

    if (!book || !chapter || !verse || !verseText) {
      throw new AppError('book, chapter, verse, and verseText are required', 400);
    }

    const prompts = await aiService.generateReflectionPrompts(book, chapter, verse, verseText);
    res.json({ success: true, data: { prompts } });
  } catch (e) {
    next(e);
  }
};

// ─── Explanation Prompts ──────────────────────────────────────────────────────

export const getExplanationPrompts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { book, chapter, verse, verseText } = req.body as {
      book?: string;
      chapter?: number;
      verse?: string;
      verseText?: string;
    };

    if (!book || !chapter || !verse || !verseText) {
      throw new AppError('book, chapter, verse, and verseText are required', 400);
    }

    const prompts = await aiService.generateExplanationPrompts(book, chapter, verse, verseText);
    res.json({ success: true, data: { prompts } });
  } catch (e) {
    next(e);
  }
};

// ─── Verse Explanation ────────────────────────────────────────────────────────

export const getVerseExplanation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { book, chapter, verse, verseText, translation, focusPrompt } = req.body as {
      book?: string;
      chapter?: number;
      verse?: string;
      verseText?: string;
      translation?: string;
      focusPrompt?: string;
    };

    if (!book || !chapter || !verse || !verseText) {
      throw new AppError('book, chapter, verse, and verseText are required', 400);
    }

    const result = await aiService.generateVerseExplanation(
      book,
      chapter,
      verse,
      verseText,
      translation || 'KJV',
      focusPrompt,
    );
    res.json({ success: true, data: result });
  } catch (e) {
    next(e);
  }
};

// ─── Reading Recommendations ──────────────────────────────────────────────────

export const getReadingRecommendations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;

    // Pull growth areas from mentee profile if available
    const menteeProfile = await AppDataSource.getRepository(MenteeProfile).findOne({
      where: { userId: user.id },
    });

    const growthAreas: string[] = menteeProfile?.spiritualGrowthAreas ?? [];

    const { recentBooks = [], currentStreak = 0 } = req.body as {
      recentBooks?: string[];
      currentStreak?: number;
    };

    const recommendations = await aiService.generateReadingRecommendations({
      growthAreas,
      recentBooks,
      currentStreak,
    });

    res.json({ success: true, data: { recommendations } });
  } catch (e) {
    next(e);
  }
};
