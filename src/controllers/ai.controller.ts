import { Request, Response, NextFunction } from 'express';
import { AppDataSource } from '@/config/data-source';
import { AiChapterSummary } from '@/database/entities/aiChapterSummary.entity';
import { MenteeProfile } from '@/database/entities/menteeProfile.entity';
import { aiService } from '@/services/ai.service';
import { AppError } from '@/common';

// ─── Chapter Summary ──────────────────────────────────────────────────────────

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

    const repo = AppDataSource.getRepository(AiChapterSummary);

    // Return cached summary if it exists
    const cached = await repo.findOne({ where: { book, chapter } });
    if (cached) {
      return res.json({ success: true, data: { summary: cached.summary, cached: true } });
    }

    const summary = await aiService.generateChapterSummary(book, chapter, verseText);
    if (!summary) throw new AppError('Failed to generate summary', 500);

    // Cache it
    await repo.upsert({ book, chapter, summary }, ['book', 'chapter']);

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
