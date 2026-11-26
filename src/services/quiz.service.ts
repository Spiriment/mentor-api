import { In } from 'typeorm';
import { AppDataSource } from '@/config/data-source';
import { QuizBook } from '@/database/entities/quizBook.entity';
import { QuizQuestion } from '@/database/entities/quizQuestion.entity';
import { QuizAttempt } from '@/database/entities/quizAttempt.entity';
import { QuizStreak } from '@/database/entities/quizStreak.entity';
import { User } from '@/database/entities/user.entity';
import { MenteeProfile } from '@/database/entities/menteeProfile.entity';
import { MentorProfile } from '@/database/entities/mentorProfile.entity';
import { MentorshipRequest, MENTORSHIP_REQUEST_STATUS } from '@/database/entities/mentorshipRequest.entity';
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
import { ACCOUNT_STATUS } from '@/common/constants/options';
import { computeProficiency, suggestNext, weeklyTrend } from '@/common/quizProficiency';
import {
  assignRanks,
  FUTURE_TOLERANCE_MS,
  isValidQuizVersion,
  leaderboardDisplayName,
  MAX_QUIZ_QUESTIONS,
  normalizeAttemptNumbers,
} from '@/common/quizLeaderboard';

export type LeaderboardEntry = {
  userId: string;
  name: string;
  profileImage: string | null;
  xp: number;
  rank: number;
  isCurrentUser: boolean;
};

/** Leaderboard shows 50; a little headroom */
const MAX_LEVEL_LOOKUPS = 60;

export class QuizService {
  private bookRepo = AppDataSource.getRepository(QuizBook);
  private questionRepo = AppDataSource.getRepository(QuizQuestion);
  private attemptRepo = AppDataSource.getRepository(QuizAttempt);
  private streakRepo = AppDataSource.getRepository(QuizStreak);
  private userRepo = AppDataSource.getRepository(User);
  private menteeProfileRepo = AppDataSource.getRepository(MenteeProfile);
  private mentorProfileRepo = AppDataSource.getRepository(MentorProfile);
  private mentorshipRequestRepo = AppDataSource.getRepository(MentorshipRequest);

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
    // The app grades the quiz and posts the result, so only accept what a real quiz can produce
    const version = Number(data?.version);
    if (!isValidQuizVersion(version)) {
      throw new AppError('Invalid quiz level', 400, 'INVALID_QUIZ_ATTEMPT');
    }
    const book = typeof data?.book === 'string' ? data.book.trim() : '';
    const bookEntity = book ? await this.bookRepo.findOne({ where: { book, isActive: true } }) : null;
    if (!bookEntity) {
      throw new AppError('Unknown quiz book', 400, 'INVALID_QUIZ_ATTEMPT');
    }
    const questionsAvailable = await this.questionRepo.count({
      where: { bookId: bookEntity.id, version, isActive: true },
    });
    if (questionsAvailable === 0) {
      throw new AppError('Unknown quiz level for this book', 400, 'INVALID_QUIZ_ATTEMPT');
    }
    const { score, total, completedAt } = normalizeAttemptNumbers(data, questionsAvailable);

    const attempt = this.attemptRepo.create({
      id: uuidv4(),
      userId,
      book: bookEntity.book,
      version,
      score,
      total,
      completedAt,
      answers: Array.isArray(data.answers) ? data.answers.slice(0, MAX_QUIZ_QUESTIONS) : undefined,
    });
    await this.attemptRepo.save(attempt);

    const streak = await this.incrementQuizStreak(userId, timezone, bookEntity.book, version, score);

    return { attempt, streak };
  }

  async getAttemptHistory(userId: string, book?: string, version?: number, limit = 50) {
    const take = Math.min(Math.max(limit || 50, 1), 500);
    const qb = this.attemptRepo
      .createQueryBuilder('a')
      .where('a.userId = :userId', { userId })
      .orderBy('a.completedAt', 'DESC')
      .limit(take);

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
        earnedAchievements: {},
        achievementStats: { totalQuizzes: 0, completedBooks: [] },
      });
      await this.streakRepo.save(streak);
    }
    return {
      ...streak,
      earnedAchievements: streak.earnedAchievements ?? {},
      achievementStats: streak.achievementStats ?? {
        totalQuizzes: 0,
        completedBooks: [],
      },
    };
  }

  /**
   * Merge client-earned achievements into the quiz streak row.
   * Keeps the earliest earnedAt for each id; never removes server awards.
   */
  async upsertAchievements(
    userId: string,
    payload: {
      earnedAchievements?: Record<string, string>;
      achievementStats?: {
        totalQuizzes?: number;
        completedBooks?: string[];
      };
    }
  ): Promise<QuizStreak> {
    const streak = await this.getQuizStreak(userId);
    const existing = { ...(streak.earnedAchievements ?? {}) };
    const incoming = payload.earnedAchievements ?? {};

    for (const [id, earnedAt] of Object.entries(incoming)) {
      if (!id || !earnedAt) continue;
      if (!existing[id]) {
        existing[id] = earnedAt;
      } else if (new Date(earnedAt).getTime() < new Date(existing[id]).getTime()) {
        existing[id] = earnedAt;
      }
    }
    streak.earnedAchievements = existing;

    const stats = {
      totalQuizzes: streak.achievementStats?.totalQuizzes ?? 0,
      completedBooks: [...(streak.achievementStats?.completedBooks ?? [])],
    };
    if (typeof payload.achievementStats?.totalQuizzes === 'number') {
      stats.totalQuizzes = Math.max(
        stats.totalQuizzes,
        payload.achievementStats.totalQuizzes
      );
    }
    if (Array.isArray(payload.achievementStats?.completedBooks)) {
      const set = new Set([
        ...stats.completedBooks,
        ...payload.achievementStats.completedBooks,
      ]);
      stats.completedBooks = Array.from(set);
    }
    streak.achievementStats = stats;

    return this.streakRepo.save(streak);
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
          earnedAchievements: {},
          achievementStats: { totalQuizzes: 0, completedBooks: [] },
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

      // Sync quiz activity into user.monthlyStreakData so the streak calendar shows quiz days
      const userRepo = manager.getRepository(User);
      const user = await userRepo.findOne({ where: { id: userId }, select: ['id', 'monthlyStreakData'] });
      if (user) {
        const userMonthly = user.monthlyStreakData ?? {};
        if (!userMonthly[monthKey]) userMonthly[monthKey] = [];
        if (!userMonthly[monthKey].includes(dayOfMonth)) {
          userMonthly[monthKey].push(dayOfMonth);
          userMonthly[monthKey].sort((a: number, b: number) => a - b);
        }
        await userRepo.update(userId, { monthlyStreakData: userMonthly });
      }

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
    period: 'week' | 'alltime',
    scope: 'global' | 'mentees' = 'global'
  ): Promise<{ entries: LeaderboardEntry[]; me: { rank: number; xp: number } | null }> {
    // Global XP leaderboard across ALL books and levels, optionally scoped to a mentor's own
    // accepted mentees. Best score per (userId, book, version) only, so replaying the same quiz
    // can't farm XP. Level multipliers: 1 → 1.0x | 2 → 1.5x | 3 → 2.0x | 4 → 3.0x
    //
    // Scores are posted by the app, so the query also caps what it counts the same way
    // submitAttempt now does: real books only, levels 1–4, at most MAX_QUIZ_QUESTIONS
    // per quiz, nothing dated in the future. That covers attempts stored before those checks.

    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const latestAllowed = new Date(now.getTime() + FUTURE_TOLERANCE_MS);

    let scopedUserIds: string[] | null = null;
    if (scope === 'mentees') {
      const acceptedRequests = await this.mentorshipRequestRepo.find({
        where: { mentorId: userId, status: MENTORSHIP_REQUEST_STATUS.ACCEPTED },
      });
      scopedUserIds = acceptedRequests.map((r) => r.menteeId);
      if (scopedUserIds.length === 0) return { entries: [], me: null };
    }

    // Inner subquery: best (capped) score per (userId, book, version)
    const innerQb = this.attemptRepo
      .createQueryBuilder('a')
      // Only real books count (an invented book name used to add a fresh quiz's worth of XP).
      // A book later switched off keeps the XP people earned on it.
      .innerJoin(QuizBook, 'qb', 'qb.book = a.book')
      // Deleted, suspended, blocked and deactivated accounts don't rank
      .innerJoin(User, 'u', 'u.id = a.userId')
      .select('a.userId', 'userId')
      .addSelect('a.book', 'book')
      .addSelect('a.version', 'version')
      .addSelect('MAX(LEAST(GREATEST(a.score, 0), a.total, :maxQuestions))', 'bestScore')
      .where('u.isActive = :userActive', { userActive: true })
      .andWhere('(u.accountStatus IS NULL OR u.accountStatus NOT IN (:...hiddenStatuses))', {
        hiddenStatuses: [ACCOUNT_STATUS.DELETED, ACCOUNT_STATUS.SUSPENDED, ACCOUNT_STATUS.BLOCKED],
      })
      .andWhere('a.version BETWEEN 1 AND 4')
      .andWhere('a.completedAt <= :latestAllowed', { latestAllowed })
      .setParameter('maxQuestions', MAX_QUIZ_QUESTIONS)
      .groupBy('a.userId')
      .addGroupBy('a.book')
      .addGroupBy('a.version');

    if (period === 'week') {
      innerQb.andWhere('a.completedAt >= :weekStart', { weekStart });
    }

    if (scopedUserIds) {
      innerQb.andWhere('a.userId IN (:...scopedUserIds)', { scopedUserIds });
    }

    const innerSql = innerQb.getQuery();
    const innerParams = innerQb.getParameters();

    // Outer query: apply the level multiplier and sum XP per user. Not limited, so the viewer's
    // own rank is known even when they're outside the top 50; ties break by user id so the
    // order doesn't shuffle between refreshes.
    const rows = await this.attemptRepo.manager
      .createQueryBuilder()
      .select('sub.userId', 'userId')
      .addSelect(
        `SUM(
          sub.bestScore * CASE sub.version
            WHEN 1 THEN 1.0
            WHEN 2 THEN 1.5
            WHEN 3 THEN 2.0
            WHEN 4 THEN 3.0
            ELSE 1.0
          END
        )`,
        'xp'
      )
      .from(`(${innerSql})`, 'sub')
      .setParameters(innerParams)
      .groupBy('sub.userId')
      .orderBy('xp', 'DESC')
      .addOrderBy('sub.userId', 'ASC')
      .getRawMany<{ userId: string; xp: string }>();

    if (rows.length === 0) return { entries: [], me: null };

    const ranked = assignRanks(rows.map((r) => ({ userId: r.userId, xp: Math.round(Number(r.xp)) })));
    const mine = ranked.find((r) => r.userId === userId);
    const me = mine ? { rank: mine.rank, xp: mine.xp } : null;

    const top = ranked.slice(0, 50);
    const topIds = top.map((r) => r.userId);

    const users = await this.userRepo.find({ where: topIds.map((id) => ({ id })) });
    const userById = new Map(users.map((u) => [u.id, u]));

    const [menteeProfiles, mentorProfiles] = await Promise.all([
      this.menteeProfileRepo.find({ where: topIds.map((id) => ({ userId: id })) }),
      this.mentorProfileRepo.find({ where: topIds.map((id) => ({ userId: id })) }),
    ]);
    const imageByUser = new Map<string, string | null>();
    for (const p of [...menteeProfiles, ...mentorProfiles]) {
      imageByUser.set(p.userId, p.profileImage ?? null);
    }

    const entries = top.map((r) => {
      const user = userById.get(r.userId);
      return {
        userId: r.userId,
        // First name and last initial: everyone with Basic can see this list
        name: leaderboardDisplayName(user?.firstName, user?.lastName),
        profileImage: imageByUser.get(r.userId) ?? null,
        xp: r.xp,
        rank: r.rank,
        isCurrentUser: r.userId === userId,
      };
    });

    return { entries, me };
  }

  /**
   * Scripture Proficiency (Seed → Oak of Righteousness) from this user's quiz results: an
   * overall score, one per area of the Bible, a 12-week trend and where to grow next.
   * Same caps as the leaderboard, so posted numbers can't inflate it.
   */
  async getProficiency(userId: string) {
    const now = new Date();
    const [books, rows] = await Promise.all([
      this.bookRepo.find({ where: { isActive: true }, select: { book: true } }),
      this.attemptRepo.find({
        where: { userId },
        select: { book: true, version: true, score: true, total: true, completedAt: true },
      }),
    ]);
    const availableBooks = books.map((b) => b.book);
    const latestAllowed = now.getTime() + FUTURE_TOLERANCE_MS;
    const attempts = rows
      .filter((a) => a.completedAt && new Date(a.completedAt).getTime() <= latestAllowed)
      .map((a) => ({
        book: a.book,
        version: Number(a.version),
        score: Number(a.score),
        total: Number(a.total),
        completedAt: new Date(a.completedAt),
      }));

    const { score, level, areas, mastery } = computeProficiency(attempts, availableBooks, now);
    return {
      score,
      level,
      areas,
      trend: weeklyTrend(attempts, availableBooks, now, 12),
      suggestion: suggestNext(areas, mastery, availableBooks),
      quizzesCounted: attempts.length,
    };
  }

  /**
   * Proficiency levels for several users at once (leaderboard emblems). One query for all of
   * their attempts; the leaderboard itself doesn't wait for this.
   */
  async getProficiencyLevels(userIds: string[]): Promise<Record<string, { key: string; name: string; score: number }>> {
    const ids = [...new Set(userIds.filter((id) => /^[0-9a-f-]{36}$/i.test(id)))].slice(0, MAX_LEVEL_LOOKUPS);
    if (ids.length === 0) return {};
    const now = new Date();
    const latestAllowed = now.getTime() + FUTURE_TOLERANCE_MS;
    const [books, rows] = await Promise.all([
      this.bookRepo.find({ where: { isActive: true }, select: { book: true } }),
      this.attemptRepo.find({
        where: { userId: In(ids) },
        select: { userId: true, book: true, version: true, score: true, total: true, completedAt: true },
      }),
    ]);
    const availableBooks = books.map((b) => b.book);
    const byUser = new Map<string, { book: string; version: number; score: number; total: number; completedAt: Date }[]>();
    for (const a of rows) {
      if (!a.completedAt || new Date(a.completedAt).getTime() > latestAllowed) continue;
      const list = byUser.get(a.userId) ?? [];
      list.push({ book: a.book, version: Number(a.version), score: Number(a.score), total: Number(a.total), completedAt: new Date(a.completedAt) });
      byUser.set(a.userId, list);
    }
    const out: Record<string, { key: string; name: string; score: number }> = {};
    for (const id of ids) {
      const { score, level } = computeProficiency(byUser.get(id) ?? [], availableBooks, now);
      out[id] = { key: level.key, name: level.name, score };
    }
    return out;
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
