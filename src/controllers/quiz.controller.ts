import { Request, Response, NextFunction } from 'express';
import { QuizService } from '@/services/quiz.service';

const quizService = new QuizService();

export const getBooks = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const books = await quizService.getBooks();
    res.json({ success: true, data: books });
  } catch (err) { next(err); }
};

export const getQuestions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { book } = req.params;
    const version = Number(req.query.version ?? 1);
    const questions = await quizService.getQuestions(book, version);
    res.json({ success: true, data: questions });
  } catch (err) { next(err); }
};

export const submitAttempt = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const timezone = (req.user as any)?.timezone ?? 'UTC';
    const result = await quizService.submitAttempt(userId, req.body, timezone);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

export const getAttemptHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { book, version } = req.query;
    const history = await quizService.getAttemptHistory(
      userId,
      book as string | undefined,
      version ? Number(version) : undefined
    );
    res.json({ success: true, data: history });
  } catch (err) { next(err); }
};

export const getQuizStreak = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const streak = await quizService.getQuizStreak(req.user!.id);
    res.json({ success: true, data: streak });
  } catch (err) { next(err); }
};

export const submitFeedback = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { book, version, helpful } = req.body;
    await quizService.submitFeedback(req.user!.id, book, Number(version), Boolean(helpful));
    res.json({ success: true });
  } catch (err) { next(err); }
};
