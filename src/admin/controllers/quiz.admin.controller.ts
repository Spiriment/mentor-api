import { Request, Response, NextFunction } from 'express';
import { QuizService } from '@/services/quiz.service';

const quizService = new QuizService();

export const adminGetBooks = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const books = await quizService.adminGetBooks();
    res.json({ success: true, data: books });
  } catch (err) { next(err); }
};

export const adminGetBook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await quizService.adminGetBookWithQuestions(req.params.bookId);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

export const adminCreateBook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const book = await quizService.adminCreateBook(req.body);
    res.status(201).json({ success: true, data: book });
  } catch (err) { next(err); }
};

export const adminUpdateBook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const book = await quizService.adminUpdateBook(req.params.bookId, req.body);
    res.json({ success: true, data: book });
  } catch (err) { next(err); }
};

export const adminDeleteBook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await quizService.adminDeleteBook(req.params.bookId);
    res.json({ success: true });
  } catch (err) { next(err); }
};

export const adminCreateQuestion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const question = await quizService.adminCreateQuestion(req.params.bookId, req.body);
    res.status(201).json({ success: true, data: question });
  } catch (err) { next(err); }
};

export const adminUpdateQuestion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const question = await quizService.adminUpdateQuestion(req.params.questionId, req.body);
    res.json({ success: true, data: question });
  } catch (err) { next(err); }
};

export const adminDeleteQuestion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await quizService.adminDeleteQuestion(req.params.questionId);
    res.json({ success: true });
  } catch (err) { next(err); }
};

export const adminBulkImport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { version, questions } = req.body;
    const result = await quizService.adminBulkImportQuestions(req.params.bookId, version, questions);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};
