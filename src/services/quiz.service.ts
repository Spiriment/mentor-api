import { AppDataSource } from '@/config/data-source';
import { QuizBook } from '@/database/entities/quizBook.entity';
import { QuizQuestion } from '@/database/entities/quizQuestion.entity';
import { QuizAttempt } from '@/database/entities/quizAttempt.entity';
import { QuizStreak } from '@/database/entities/quizStreak.entity';
import { User } from '@/database/entities/user.entity';
import { MenteeProfile } from '@/database/entities/menteeProfile.entity';
import { MentorProfile } from '@/database/entities/mentorProfile.entity';
import { AppError } from '@/common';
import { logger } from '@/config/int-services';
import { v4 as uuidv4 } from 'uuid';
import {
  startOfDay,
  startOfWeek,
  differenceInCalendarDays,
  format,
  getDay,
  isSameWeek,
  parseISO,
} from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

export class QuizService {
  private bookRepo = AppDataSource.getRepository(QuizBook);
  private questionRepo = AppDataSource.getRepository(QuizQuestion);
  private attemptRepo = AppDataSource.getRepository(QuizAttempt);
  private streakRepo = AppDataSource.getRepository(QuizStreak);
  private userRepo = AppDataSource.getRepository(User);
  private menteeProfileRepo = AppDataSource.getRepository(MenteeProfile);
  private mentorProfileRepo = AppDataSource.getRepository(MentorProfile);

  // ─── Books ───────────────────────────────────────────────────────────────

  async getBooks(): Promise<{ id: string; book: string; category: string; versions: number[]; questionCounts: Record<number, number> }[]> {
    const books = await this.bookRepo.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', book: 'ASC' },
    });

    const result = await Promise.all(books.map(async (b) => {
      const rows = await this.questionRepo
        .createQueryBuilder('q')
        .select('q.version', 'version')
        .addSelect('COUNT(q.id)', 'count')
        .where('q.bookId = :id AND q.isActive = true', { id: b.id })
        .groupBy('q.version')
        .getRawMany();

      const versions = rows.map((r) => Number(r.version)).sort();
      const questionCounts: Record<number, number> = {};
      rows.forEach((r) => { questionCounts[Number(r.version)] = Number(r.count); });

      return { id: b.id, book: b.book, category: b.category, versions, questionCounts };
    }));

    return result.filter((b) => b.versions.length > 0);
  }

  async getQuestions(book: string, version: number): Promise<QuizQuestion[]> {
    const bookEntity = await this.bookRepo.findOne({ where: { book, isActive: true } });
    if (!bookEntity) throw new AppError(`Book not found: ${book}`, 404);

    const questions = await this.questionRepo.find({
      where: { bookId: bookEntity.id, version, isActive: true },
      order: { questionNumber: 'ASC' },
    });

    if (questions.length === 0) throw new AppError(`No questions found for ${book} v${version}`, 404);
    return questions;
  }

  // ─── Attempts ────────────────────────────────────────────────────────────

  async submitAttempt(
    userId: string,
    data: {
      book: string;
      version: number;
      score: number;
      total: number;
      completedAt: string;
      answers?: { questionId: string; selected: string; correct: boolean }[];
    },
    timezone = 'UTC'
  ): Promise<{ attempt: QuizAttempt; streak: QuizStreak }> {
    const attempt = this.attemptRepo.create({
      id: uuidv4(),
      userId,
      book: data.book,
      version: data.version,
      score: data.score,
      total: data.total,
      completedAt: new Date(data.completedAt),
      answers: data.answers,
    });
    await this.attemptRepo.save(attempt);

    const streak = await this.incrementQuizStreak(userId, timezone, data.book, data.version, data.score);

    return { attempt, streak };
  }

  async getAttemptHistory(userId: string, book?: string, version?: number) {
    const qb = this.attemptRepo
      .createQueryBuilder('a')
      .where('a.userId = :userId', { userId })
      .orderBy('a.completedAt', 'DESC')
      .limit(50);

    if (book) qb.andWhere('a.book = :book', { book });
    if (version) qb.andWhere('a.version = :version', { version });

    return qb.getMany();
  }

  // ─── Quiz Streak (race-condition safe with pessimistic locking) ──────────

  async getQuizStreak(userId: string): Promise<QuizStreak> {
    let streak = await this.streakRepo.findOne({ where: { userId } });
    if (!streak) {
      streak = this.streakRepo.create({
        id: uuidv4(),
        userId,
        currentStreak: 0,
        longestStreak: 0,
        weeklyData: new Array(7).fill(false),
        monthlyData: {},
        highScores: {},
      });
      await this.streakRepo.save(streak);
    }
    return streak;
  }

  private async incrementQuizStreak(
    userId: string,
    timezone: string,
    book: string,
    version: number,
    score: number
  ): Promise<QuizStreak> {
    return AppDataSource.transaction(async (manager) => {
      // Pessimistic write lock — prevents concurrent requests from racing
      const streakRepo = manager.getRepository(QuizStreak);

      let streak = await streakRepo.findOne({
        where: { userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!streak) {
        streak = streakRepo.create({
          id: uuidv4(),
          userId,
          currentStreak: 0,
          longestStreak: 0,
          weeklyData: new Array(7).fill(false),
          monthlyData: {},
          highScores: {},
        });
      }

      const now = new Date();
      const todayInTz = startOfDay(toZonedTime(now, timezone));
      const todayStr = format(todayInTz, 'yyyy-MM-dd');

      // Update high score for this book+version
      const highScoreKey = `${book}_${version}`;
      const highScores = streak.highScores ?? {};
      if ((highScores[highScoreKey] ?? 0) < score) {
        highScores[highScoreKey] = score;
        streak.highScores = highScores;
      }

      // Already completed a quiz today — update high score only, don't increment streak
      if (streak.lastQuizDate) {
        const lastStr = streak.lastQuizDate instanceof Date
          ? format(streak.lastQuizDate, 'yyyy-MM-dd')
          : String(streak.lastQuizDate).split('T')[0];

        if (lastStr === todayStr) {
          await streakRepo.save(streak);
          return streak;
        }
      }

      // Compute streak delta
      let weeklyData: boolean[] = Array.isArray(streak.weeklyData)
        ? [...streak.weeklyData]
        : new Array(7).fill(false);

      let lastDate: Date | null = null;
      if (streak.lastQuizDate) {
        const raw = streak.lastQuizDate instanceof Date
          ? format(streak.lastQuizDate, 'yyyy-MM-dd')
          : String(streak.lastQuizDate).split('T')[0];
        lastDate = startOfDay(parseISO(raw));
      }

      // Reset weekly data if new week
      if (lastDate && !isSameWeek(lastDate, todayInTz, { weekStartsOn: 0 })) {
        weeklyData = new Array(7).fill(false);
      }

      let newStreak = streak.currentStreak;
      if (!lastDate) {
        newStreak = 1;
      } else {
        const diff = differenceInCalendarDays(todayInTz, lastDate);
        if (diff === 1) {
          newStreak = streak.currentStreak + 1;
        } else if (diff > 1) {
          newStreak = 1;
          weeklyData = new Array(7).fill(false);
        }
      }

      weeklyData[getDay(todayInTz)] = true;

      // Monthly data
      const monthKey = format(todayInTz, 'yyyy-MM');
      const monthlyData = streak.monthlyData ?? {};
      if (!monthlyData[monthKey]) monthlyData[monthKey] = [];
      const dayOfMonth = todayInTz.getDate();
      if (!monthlyData[monthKey].includes(dayOfMonth)) {
        monthlyData[monthKey].push(dayOfMonth);
        monthlyData[monthKey].sort((a, b) => a - b);
      }

      streak.currentStreak = newStreak;
      streak.longestStreak = Math.max(streak.longestStreak, newStreak);
      streak.lastQuizDate = todayInTz;
      streak.weeklyData = weeklyData;
      streak.monthlyData = monthlyData;

      await streakRepo.save(streak);

      logger.info('Quiz streak updated', { userId, newStreak, book, version });
      return streak;
    });
  }

  // ─── Admin ───────────────────────────────────────────────────────────────

  async adminGetBooks() {
    return this.bookRepo.find({ order: { sortOrder: 'ASC', book: 'ASC' } });
  }

  async adminGetBookWithQuestions(bookId: string) {
    const book = await this.bookRepo.findOne({ where: { id: bookId } });
    if (!book) throw new AppError('Book not found', 404);

    const questions = await this.questionRepo.find({
      where: { bookId },
      order: { version: 'ASC', questionNumber: 'ASC' },
    });

    return { ...book, questions };
  }

  async adminCreateBook(data: { book: string; category: 'OT' | 'NT'; sortOrder?: number }) {
    const existing = await this.bookRepo.findOne({ where: { book: data.book } });
    if (existing) throw new AppError(`Book "${data.book}" already exists`, 409);

    const book = this.bookRepo.create({ id: uuidv4(), ...data, isActive: true });
    return this.bookRepo.save(book);
  }

  async adminUpdateBook(bookId: string, data: Partial<{ book: string; category: 'OT' | 'NT'; isActive: boolean; sortOrder: number }>) {
    const book = await this.bookRepo.findOne({ where: { id: bookId } });
    if (!book) throw new AppError('Book not found', 404);
    Object.assign(book, data);
    return this.bookRepo.save(book);
  }

  async adminDeleteBook(bookId: string) {
    const book = await this.bookRepo.findOne({ where: { id: bookId } });
    if (!book) throw new AppError('Book not found', 404);
    await this.bookRepo.remove(book);
  }

  async adminCreateQuestion(bookId: string, data: {
    version: number;
    questionNumber: number;
    question: string;
    options: { key: 'A' | 'B' | 'C' | 'D'; text: string }[];
    answer: string;
    verse?: string;
  }) {
    const book = await this.bookRepo.findOne({ where: { id: bookId } });
    if (!book) throw new AppError('Book not found', 404);

    const question = this.questionRepo.create({ id: uuidv4(), bookId, ...data, isActive: true });
    return this.questionRepo.save(question);
  }

  async adminUpdateQuestion(questionId: string, data: Partial<{
    version: number;
    questionNumber: number;
    question: string;
    options: { key: 'A' | 'B' | 'C' | 'D'; text: string }[];
    answer: string;
    verse: string;
    isActive: boolean;
  }>) {
    const question = await this.questionRepo.findOne({ where: { id: questionId } });
    if (!question) throw new AppError('Question not found', 404);
    Object.assign(question, data);
    return this.questionRepo.save(question);
  }

  async adminDeleteQuestion(questionId: string) {
    const question = await this.questionRepo.findOne({ where: { id: questionId } });
    if (!question) throw new AppError('Question not found', 404);
    await this.questionRepo.remove(question);
  }

  async adminBulkImportQuestions(bookId: string, version: number, questions: {
    question: string;
    options: { key: 'A' | 'B' | 'C' | 'D'; text: string }[];
    answer: string;
    verse?: string;
  }[]) {
    const book = await this.bookRepo.findOne({ where: { id: bookId } });
    if (!book) throw new AppError('Book not found', 404);

    // Delete existing for this version first
    await this.questionRepo.delete({ bookId, version });

    const entities = questions.map((q, idx) =>
      this.questionRepo.create({
        id: uuidv4(),
        bookId,
        version,
        questionNumber: idx + 1,
        question: q.question,
        options: q.options,
        answer: q.answer,
        verse: q.verse,
        isActive: true,
      })
    );

    await this.questionRepo.save(entities);
    return { imported: entities.length };
  }

  // ─── Feedback ─────────────────────────────────────────────────────────────

  // ─── Leaderboard ──────────────────────────────────────────────────────────

  async getLeaderboard(
    userId: string,
    book: string,
    period: 'week' | 'alltime'
  ): Promise<{ userId: string; name: string; profileImage: string | null; score: number; total: number; isCurrentUser: boolean }[]> {
    // Global leaderboard — all users ranked by best score for this book
    const qb = this.attemptRepo
      .createQueryBuilder('a')
      .select('a.userId', 'userId')
      .addSelect('MAX(a.score)', 'score')
      .addSelect('a.total', 'total')
      .where('a.book = :book', { book })
      .groupBy('a.userId')
      .addGroupBy('a.total')
      .orderBy('MAX(a.score)', 'DESC')
      .limit(50);

    if (period === 'week') {
      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
      qb.andWhere('a.completedAt >= :weekStart', { weekStart });
    }

    const rows = await qb.getRawMany<{ userId: string; score: string; total: string }>();

    // Collapse to one best row per user (highest score, then highest total)
    const bestByUser = new Map<string, { score: number; total: number }>();
    for (const row of rows) {
      const score = Number(row.score);
      const total = Number(row.total);
      const existing = bestByUser.get(row.userId);
      if (!existing || score > existing.score || (score === existing.score && total > existing.total)) {
        bestByUser.set(row.userId, { score, total });
      }
    }

    if (bestByUser.size === 0) return [];

    const rankedUserIds = [...bestByUser.keys()];
    const users = await this.userRepo.find({ where: rankedUserIds.map((id) => ({ id })) });
    const userById = new Map(users.map((u) => [u.id, u]));

    const [menteeProfiles, mentorProfiles] = await Promise.all([
      this.menteeProfileRepo.find({ where: rankedUserIds.map((id) => ({ userId: id })) }),
      this.mentorProfileRepo.find({ where: rankedUserIds.map((id) => ({ userId: id })) }),
    ]);
    const imageByUser = new Map<string, string | null>();
    for (const p of [...menteeProfiles, ...mentorProfiles]) {
      imageByUser.set(p.userId, p.profileImage ?? null);
    }

    return rankedUserIds
      .map((uid) => {
        const user = userById.get(uid);
        const best = bestByUser.get(uid)!;
        const name = user
          ? [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || 'User'
          : 'User';
        return {
          userId: uid,
          name,
          profileImage: imageByUser.get(uid) ?? null,
          score: best.score,
          total: best.total,
          isCurrentUser: uid === userId,
        };
      })
      .sort((a, b) => b.score - a.score || b.total - a.total);
  }

  async submitFeedback(userId: string, book: string, version: number, helpful: boolean): Promise<void> {
    // Update the most recent attempt for this user/book/version
    const attempt = await this.attemptRepo.findOne({
      where: { userId, book, version },
      order: { completedAt: 'DESC' },
    });
    if (attempt) {
      attempt.helpful = helpful;
      await this.attemptRepo.save(attempt);
    }
  }
}
