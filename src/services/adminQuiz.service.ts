import { AppDataSource } from '@/config/data-source';
import { QuizAttempt } from '@/database/entities/quizAttempt.entity';
import { QuizStreak } from '@/database/entities/quizStreak.entity';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Static quiz catalog — 66 Bible books, each with version(s) and question counts.
// Update this if new quiz content is added to the app's bibleQuiz.ts.
export const QUIZ_CATALOG = [
  { book: 'Genesis', versions: [{ version: 1, questionCount: 40 }, { version: 2, questionCount: 40 }] },
  { book: 'Exodus', versions: [{ version: 1, questionCount: 40 }, { version: 2, questionCount: 40 }] },
  { book: 'Leviticus', versions: [{ version: 1, questionCount: 40 }] },
  { book: 'Numbers', versions: [{ version: 1, questionCount: 40 }] },
  { book: 'Deuteronomy', versions: [{ version: 1, questionCount: 40 }] },
  { book: 'Joshua', versions: [{ version: 1, questionCount: 40 }] },
  { book: 'Judges', versions: [{ version: 1, questionCount: 40 }] },
  { book: 'Ruth', versions: [{ version: 1, questionCount: 10 }] },
  { book: '1 Samuel', versions: [{ version: 1, questionCount: 40 }] },
  { book: '2 Samuel', versions: [{ version: 1, questionCount: 40 }] },
  { book: '1 Kings', versions: [{ version: 1, questionCount: 40 }] },
  { book: '2 Kings', versions: [{ version: 1, questionCount: 40 }] },
  { book: '1 Chronicles', versions: [{ version: 1, questionCount: 40 }] },
  { book: '2 Chronicles', versions: [{ version: 1, questionCount: 40 }] },
  { book: 'Ezra', versions: [{ version: 1, questionCount: 10 }] },
  { book: 'Nehemiah', versions: [{ version: 1, questionCount: 40 }] },
  { book: 'Esther', versions: [{ version: 1, questionCount: 10 }] },
  { book: 'Job', versions: [{ version: 1, questionCount: 40 }] },
  { book: 'Psalms', versions: [{ version: 1, questionCount: 40 }, { version: 2, questionCount: 40 }] },
  { book: 'Proverbs', versions: [{ version: 1, questionCount: 40 }] },
  { book: 'Ecclesiastes', versions: [{ version: 1, questionCount: 10 }] },
  { book: 'Song of Solomon', versions: [{ version: 1, questionCount: 10 }] },
  { book: 'Isaiah', versions: [{ version: 1, questionCount: 40 }] },
  { book: 'Jeremiah', versions: [{ version: 1, questionCount: 40 }] },
  { book: 'Lamentations', versions: [{ version: 1, questionCount: 10 }] },
  { book: 'Ezekiel', versions: [{ version: 1, questionCount: 40 }] },
  { book: 'Daniel', versions: [{ version: 1, questionCount: 40 }] },
  { book: 'Hosea', versions: [{ version: 1, questionCount: 10 }] },
  { book: 'Joel', versions: [{ version: 1, questionCount: 10 }] },
  { book: 'Amos', versions: [{ version: 1, questionCount: 10 }] },
  { book: 'Obadiah', versions: [{ version: 1, questionCount: 10 }] },
  { book: 'Jonah', versions: [{ version: 1, questionCount: 10 }] },
  { book: 'Micah', versions: [{ version: 1, questionCount: 10 }] },
  { book: 'Nahum', versions: [{ version: 1, questionCount: 10 }] },
  { book: 'Habakkuk', versions: [{ version: 1, questionCount: 10 }] },
  { book: 'Zephaniah', versions: [{ version: 1, questionCount: 10 }] },
  { book: 'Haggai', versions: [{ version: 1, questionCount: 10 }] },
  { book: 'Zechariah', versions: [{ version: 1, questionCount: 10 }] },
  { book: 'Malachi', versions: [{ version: 1, questionCount: 10 }] },
  { book: 'Matthew', versions: [{ version: 1, questionCount: 40 }, { version: 2, questionCount: 40 }] },
  { book: 'Mark', versions: [{ version: 1, questionCount: 40 }] },
  { book: 'Luke', versions: [{ version: 1, questionCount: 40 }] },
  { book: 'John', versions: [{ version: 1, questionCount: 40 }, { version: 2, questionCount: 40 }] },
  { book: 'Acts', versions: [{ version: 1, questionCount: 40 }] },
  { book: 'Romans', versions: [{ version: 1, questionCount: 40 }] },
  { book: '1 Corinthians', versions: [{ version: 1, questionCount: 40 }] },
  { book: '2 Corinthians', versions: [{ version: 1, questionCount: 40 }] },
  { book: 'Galatians', versions: [{ version: 1, questionCount: 10 }] },
  { book: 'Ephesians', versions: [{ version: 1, questionCount: 10 }] },
  { book: 'Philippians', versions: [{ version: 1, questionCount: 10 }] },
  { book: 'Colossians', versions: [{ version: 1, questionCount: 10 }, { version: 2, questionCount: 39 }] },
  { book: '1 Thessalonians', versions: [{ version: 1, questionCount: 10 }] },
  { book: '2 Thessalonians', versions: [{ version: 1, questionCount: 10 }] },
  { book: '1 Timothy', versions: [{ version: 1, questionCount: 10 }] },
  { book: '2 Timothy', versions: [{ version: 1, questionCount: 10 }] },
  { book: 'Titus', versions: [{ version: 1, questionCount: 10 }] },
  { book: 'Philemon', versions: [{ version: 1, questionCount: 10 }] },
  { book: 'Hebrews', versions: [{ version: 1, questionCount: 40 }] },
  { book: 'James', versions: [{ version: 1, questionCount: 10 }] },
  { book: '1 Peter', versions: [{ version: 1, questionCount: 10 }] },
  { book: '2 Peter', versions: [{ version: 1, questionCount: 10 }] },
  { book: '1 John', versions: [{ version: 1, questionCount: 10 }] },
  { book: '2 John', versions: [{ version: 1, questionCount: 10 }] },
  { book: '3 John', versions: [{ version: 1, questionCount: 10 }] },
  { book: 'Jude', versions: [{ version: 1, questionCount: 10 }] },
  { book: 'Revelation', versions: [{ version: 1, questionCount: 40 }] },
];

export class AdminQuizService {
  getCatalog() {
    const catalog = QUIZ_CATALOG.map(b => ({
      book: b.book,
      versionCount: b.versions.length,
      totalQuestions: b.versions.reduce((s, v) => s + v.questionCount, 0),
      versions: b.versions,
    }));

    const totalBooks = catalog.length;
    const totalVersions = catalog.reduce((s, b) => s + b.versionCount, 0);
    const totalQuestions = catalog.reduce((s, b) => s + b.totalQuestions, 0);

    return { catalog, summary: { totalBooks, totalVersions, totalQuestions } };
  }

  async getQuizStats() {
    const [catalog, summary] = await Promise.all([
      Promise.resolve(this.getCatalog()),
      this.getSummaryMetrics(),
    ]);
    return { ...catalog, activity: summary };
  }

  /** Headline quiz metrics for admin dashboard summary. */
  async getSummaryMetrics() {
    const attemptRepo = AppDataSource.getRepository(QuizAttempt);
    const streakRepo = AppDataSource.getRepository(QuizStreak);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      totalAttempts,
      attemptsLast30Days,
      uniquePlayersLast30Days,
      avgScoreRaw,
      activeStreaks,
    ] = await Promise.all([
      attemptRepo.count(),
      attemptRepo
        .createQueryBuilder('a')
        .where('a.completedAt >= :since', { since: thirtyDaysAgo })
        .getCount(),
      attemptRepo
        .createQueryBuilder('a')
        .select('COUNT(DISTINCT a.userId)', 'count')
        .where('a.completedAt >= :since', { since: thirtyDaysAgo })
        .getRawOne<{ count: string }>(),
      attemptRepo
        .createQueryBuilder('a')
        .select('AVG(a.score * 100.0 / NULLIF(a.total, 0))', 'avg')
        .where('a.completedAt >= :since', { since: thirtyDaysAgo })
        .getRawOne<{ avg: string | null }>(),
      streakRepo
        .createQueryBuilder('s')
        .where('s.currentStreak > 0')
        .getCount(),
    ]);

    const avgScorePctLast30Days =
      avgScoreRaw?.avg != null ? Math.round(parseFloat(avgScoreRaw.avg)) : null;

    return {
      totalAttempts,
      attemptsLast30Days,
      uniquePlayersLast30Days: uniquePlayersLast30Days?.count
        ? parseInt(uniquePlayersLast30Days.count, 10)
        : 0,
      avgScorePctLast30Days,
      activeStreaks,
    };
  }

  /** Charts and recent activity for admin dashboard analytics. */
  async getAnalyticsMetrics() {
    const attemptRepo = AppDataSource.getRepository(QuizAttempt);
    const now = new Date();

    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const recentMonthBuckets: { key: string; label: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      recentMonthBuckets.push({ key: monthKey(d), label: MONTH_NAMES[d.getMonth()] });
    }

    const [dailyRaw, monthlyRaw, topBooksRaw, recentRows] = await Promise.all([
      attemptRepo
        .createQueryBuilder('a')
        .select(`DATE_FORMAT(a.completedAt, '%Y-%m-%d')`, 'day')
        .addSelect('COUNT(a.id)', 'attempts')
        .where('a.completedAt >= :sevenDaysAgo', { sevenDaysAgo })
        .groupBy(`DATE_FORMAT(a.completedAt, '%Y-%m-%d')`)
        .getRawMany<{ day: string; attempts: string }>(),
      attemptRepo
        .createQueryBuilder('a')
        .select(`DATE_FORMAT(a.completedAt, '%Y-%m')`, 'month')
        .addSelect('COUNT(a.id)', 'attempts')
        .where('a.completedAt >= :sixMonthsAgo', { sixMonthsAgo })
        .groupBy(`DATE_FORMAT(a.completedAt, '%Y-%m')`)
        .orderBy(`DATE_FORMAT(a.completedAt, '%Y-%m')`, 'ASC')
        .getRawMany<{ month: string; attempts: string }>(),
      attemptRepo
        .createQueryBuilder('a')
        .select('a.book', 'book')
        .addSelect('COUNT(a.id)', 'attempts')
        .where('a.completedAt >= :thirtyDaysAgo', { thirtyDaysAgo })
        .groupBy('a.book')
        .orderBy('attempts', 'DESC')
        .limit(5)
        .getRawMany<{ book: string; attempts: string }>(),
      attemptRepo.find({
        relations: ['user'],
        order: { completedAt: 'DESC' },
        take: 8,
      }),
    ]);

    const dailyByKey: Record<string, { day: string; attempts: number }> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      dailyByKey[key] = { day: DAY_NAMES[d.getDay()], attempts: 0 };
    }
    for (const row of dailyRaw) {
      if (dailyByKey[row.day]) {
        dailyByKey[row.day].attempts = parseInt(row.attempts, 10);
      }
    }
    const attemptsDaily = Object.values(dailyByKey);

    const monthlyMap: Record<string, number> = {};
    for (const bucket of recentMonthBuckets) monthlyMap[bucket.key] = 0;
    for (const row of monthlyRaw) {
      if (monthlyMap[row.month] !== undefined) {
        monthlyMap[row.month] = parseInt(row.attempts, 10);
      }
    }
    const attemptsMonthly = recentMonthBuckets.map(({ key, label }) => ({
      month: label,
      attempts: monthlyMap[key],
    }));

    const topBooksLast30Days = topBooksRaw.map((r) => ({
      book: r.book,
      attempts: parseInt(r.attempts, 10),
    }));

    const recentAttempts = recentRows.map((a) => {
      const u = a.user;
      return {
        id: a.id,
        userId: a.userId,
        userRole: u?.role ?? null,
        firstName: u?.firstName ?? null,
        lastName: u?.lastName ?? null,
        email: u?.email ?? null,
        book: a.book,
        version: a.version,
        score: a.score,
        total: a.total,
        completedAt: a.completedAt,
      };
    });

    return {
      attemptsDaily,
      attemptsMonthly,
      topBooksLast30Days,
      recentAttempts,
    };
  }

  /** Quiz attempts + streak for a single user (admin user/mentor detail). */
  async getUserQuizActivity(userId: string, attemptLimit = 100) {
    const attemptRepo = AppDataSource.getRepository(QuizAttempt);
    const streakRepo = AppDataSource.getRepository(QuizStreak);
    const limit = Math.min(Math.max(attemptLimit, 1), 200);

    const [totalAttempts, attempts, streak, avgScoreRaw] = await Promise.all([
      attemptRepo.count({ where: { userId } }),
      attemptRepo.find({
        where: { userId },
        order: { completedAt: 'DESC' },
        take: limit,
      }),
      streakRepo.findOne({ where: { userId } }),
      attemptRepo
        .createQueryBuilder('a')
        .select('AVG(a.score * 100.0 / NULLIF(a.total, 0))', 'avg')
        .where('a.userId = :userId', { userId })
        .getRawOne<{ avg: string | null }>(),
    ]);

    const avgScorePctAllTime =
      avgScoreRaw?.avg != null ? Math.round(parseFloat(avgScoreRaw.avg)) : null;

    const highScoreCount = streak?.highScores
      ? Object.keys(streak.highScores).length
      : 0;

    return {
      stats: {
        totalAttempts,
        avgScorePctAllTime,
        returnedAttempts: attempts.length,
      },
      streak: streak
        ? {
            currentStreak: streak.currentStreak,
            longestStreak: streak.longestStreak,
            lastQuizDate: streak.lastQuizDate ?? null,
            totalQuizzes: streak.achievementStats?.totalQuizzes ?? totalAttempts,
            completedBooksCount: streak.achievementStats?.completedBooks?.length ?? 0,
            completedBooks: streak.achievementStats?.completedBooks ?? [],
            highScoreEntries: highScoreCount,
            earnedAchievementsCount: streak.earnedAchievements
              ? Object.keys(streak.earnedAchievements).length
              : 0,
          }
        : null,
      attempts: attempts.map((a) => ({
        id: a.id,
        book: a.book,
        version: a.version,
        score: a.score,
        total: a.total,
        scorePct: a.total > 0 ? Math.round((a.score / a.total) * 100) : 0,
        completedAt: a.completedAt,
        helpful: a.helpful ?? null,
      })),
    };
  }
}

export const adminQuizService = new AdminQuizService();
