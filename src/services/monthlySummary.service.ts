import { AppDataSource } from '@/config/data-source';
import { MonthlySummary } from '@/database/entities/monthlySummary.entity';
import { User } from '@/database/entities/user.entity';
import { StudySession } from '@/database/entities/studySession.entity';
import { Session, SESSION_STATUS } from '@/database/entities/session.entity';
import { logger } from '@/config/int-services';
import { AppError } from '@/common/errors';
import { StatusCodes } from 'http-status-codes';
import { startOfMonth, endOfMonth, format, differenceInCalendarDays } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { Between } from 'typeorm';

export class MonthlySummaryService {
  private summaryRepo = AppDataSource.getRepository(MonthlySummary);
  private userRepo = AppDataSource.getRepository(User);
  private studySessionRepo = AppDataSource.getRepository(StudySession);
  private sessionRepo = AppDataSource.getRepository(Session);

  /**
   * Generate monthly summary for a user
   */
  async generateMonthlySummary(userId: string, year: number, month: number): Promise<MonthlySummary> {
    try {
      const user = await this.userRepo.findOne({ where: { id: userId } });
      if (!user) {
        throw new AppError('User not found', StatusCodes.NOT_FOUND);
      }

      const userTimezone = user.timezone || 'UTC';
      // Create date for the first day of the target month
      const startDate = startOfMonth(new Date(year, month - 1));
      const endDate = endOfMonth(new Date(year, month - 1));

      logger.info('Generating monthly summary', { userId, year, month, startDate, endDate });

      // 1. Fetch study sessions for the month
      const studySessions = await this.studySessionRepo.find({
        where: {
          userId,
          completedAt: Between(startDate, endDate)
        },
        order: { completedAt: 'ASC' }
      });

      // 2. Fetch completed mentorship sessions for the month
      const mentorshipSessionsCount = await this.sessionRepo.count({
        where: {
          menteeId: userId,
          status: SESSION_STATUS.COMPLETED,
          scheduledAt: Between(startDate, endDate)
        }
      });

      // 3. Calculate metrics
      // 3.1 Most read bible book
      const bookCounts: Record<string, number> = {};
      studySessions.forEach(s => {
        bookCounts[s.book] = (bookCounts[s.book] || 0) + 1;
      });
      const topBookEntry = Object.entries(bookCounts).sort((a, b) => b[1] - a[1])[0];
      const topBook = topBookEntry ? topBookEntry[0] : undefined;
      const topBookChapters = topBookEntry ? topBookEntry[1] : 0;

      // 3.2 Reading time preference
      const timeSlots = { morning: 0, afternoon: 0, evening: 0 };
      studySessions.forEach(s => {
        const hour = toZonedTime(s.completedAt, userTimezone).getHours();
        if (hour >= 4 && hour < 12) timeSlots.morning++;
        else if (hour >= 12 && hour < 17) timeSlots.afternoon++;
        else timeSlots.evening++;
      });
      const readingTimePreferenceEntry = studySessions.length > 0 
        ? Object.entries(timeSlots).sort((a, b) => b[1] - a[1])[0]
        : null;
      const readingTimePreference = readingTimePreferenceEntry ? readingTimePreferenceEntry[0] : 'None';

      // 3.3 Testament Focus
      let otCount = 0;
      let ntCount = 0;
      studySessions.forEach(s => {
        if (this.isOldTestament(s.book)) otCount++;
        else ntCount++;
      });
      
      let testamentFocus = 'None';
      if (otCount > 0 || ntCount > 0) {
        testamentFocus = 'Balanced';
        if (otCount > ntCount * 2) testamentFocus = 'Old Testament';
        else if (ntCount > otCount * 2) testamentFocus = 'New Testament';
      }

      // 3.4 Longest consecutive days read in this month
      const sessionDates = Array.from(new Set(
        studySessions.map(s => format(toZonedTime(s.completedAt, userTimezone), 'yyyy-MM-dd'))
      )).sort();
      const totalDaysRead = sessionDates.length;
      const longestConsecutiveDays = this.calculateConsecutiveDaysFromDates(sessionDates);

      // 3.5 Total reading minutes
      const totalReadingMinutes = studySessions.reduce((acc, s) => acc + (s.duration || 0), 0);

      // 4. Update or create summary
      let summary = await this.summaryRepo.findOne({
        where: { userId, year, month }
      });

      const summaryData = {
        userId,
        year,
        month,
        currentStreak: user.currentStreak,
        longestStreak: user.longestStreak,
        longestConsecutiveDays,
        topBook,
        topBookChapters,
        totalDaysRead,
        readingTimePreference,
        testamentFocus,
        sessionsCount: mentorshipSessionsCount,
        totalReadingMinutes
      };

      if (summary) {
        summary = this.summaryRepo.merge(summary, summaryData);
      } else {
        summary = this.summaryRepo.create(summaryData);
      }

      const savedSummary = await this.summaryRepo.save(summary);
      logger.info('Monthly summary saved', { summaryId: savedSummary.id, userId, year, month });
      
      return savedSummary;
    } catch (error) {
      logger.error('Error generating monthly summary', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Helper to determine testament
   */
  private isOldTestament(bookName: string): boolean {
    const ntBooks = [
      'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans', '1 Corinthians', '2 Corinthians',
      'Galatians', 'Ephesians', 'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians',
      '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews', 'James', '1 Peter', '2 Peter',
      '1 John', '2 John', '3 John', 'Jude', 'Revelation'
    ];
    return !ntBooks.includes(bookName);
  }

  /**
   * Helper to calculate consecutive days
   */
  private calculateConsecutiveDaysFromDates(sessionDates: string[]): number {
    if (sessionDates.length === 0) return 0;

    let maxConsecutive = 0;
    let currentConsecutive = 1;

    for (let i = 1; i < sessionDates.length; i++) {
        const prev = new Date(sessionDates[i-1]);
        const curr = new Date(sessionDates[i]);
        const diff = differenceInCalendarDays(curr, prev);

        if (diff === 1) {
            currentConsecutive++;
        } else {
            maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
            currentConsecutive = 1;
        }
    }

    return Math.max(maxConsecutive, currentConsecutive);
  }

  /**
   * Get summary for a user
   */
  async getMonthlySummary(userId: string, year: number, month: number): Promise<MonthlySummary | null> {
    // If it's the current month, we might want to generate it on the fly
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    if (year === currentYear && month === currentMonth) {
      return this.generateMonthlySummary(userId, year, month);
    }

    let summary = await this.summaryRepo.findOne({
      where: { userId, year, month }
    });

    // If no summary found for past month, try to generate it once
    if (!summary && (year < currentYear || (year === currentYear && month < currentMonth))) {
       summary = await this.generateMonthlySummary(userId, year, month);
    }

    return summary;
  }

  /**
   * Process and send monthly reports for all users
   */
  async processMonthlyReportsForAllUsers(emailService: any, year: number, month: number): Promise<void> {
    try {
      logger.info('Starting batch processing of monthly reports', { year, month });
      
      const users = await this.userRepo.find({
        select: ['id', 'email', 'firstName', 'lastName']
      });

      const monthName = format(new Date(year, month - 1), 'MMMM');
      let successCount = 0;
      let failCount = 0;

      for (const user of users) {
        if (!user.email) continue;

        try {
          const summary = await this.getMonthlySummary(user.id, year, month);
          if (summary) {
            await emailService.sendMonthlyReportEmail({
              to: user.email,
              userName: user.firstName || user.email,
              monthName,
              year,
              totalReadingMinutes: Math.round(summary.totalReadingMinutes),
              longestStreak: summary.longestStreak,
              sessionsCount: summary.sessionsCount,
              topBook: summary.topBook || 'None',
            });
            successCount++;
          }
        } catch (error) {
          failCount++;
          logger.error(`Failed to process monthly report for user ${user.id}`, error instanceof Error ? error : new Error(String(error)));
        }
      }

      logger.info('Batch processing of monthly reports completed', { 
        total: users.length, 
        success: successCount, 
        failed: failCount 
      });
    } catch (error) {
      logger.error('Error in processMonthlyReportsForAllUsers', error instanceof Error ? error : new Error(String(error)));
    }
  }
}
