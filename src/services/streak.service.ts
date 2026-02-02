import { AppDataSource } from '@/config/data-source';
import { User } from '@/database/entities/user.entity';
import { logger } from '@/config/int-services';
import { AppError } from '@/common/errors';
import { StatusCodes } from 'http-status-codes';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import {
  format,
  startOfDay,
  differenceInCalendarDays,
  parseISO,
  getDay,
  isSameWeek,
} from 'date-fns';
import { StreakNotificationService } from './streakNotification.service';
import { getAppNotificationService } from './appNotification.service';
import { AppNotificationType } from '@/database/entities/appNotification.entity';

export class StreakService {
  private userRepository = AppDataSource.getRepository(User);

  /**
   * Get today's date in user's timezone
   */
  private getTodayInUserTimezone(timezone: string): Date {
    const now = new Date();
    return startOfDay(toZonedTime(now, timezone));
  }

  /**
   * Format date as YYYY-MM-DD string
   */
  private formatDateString(date: Date): string {
    return format(date, 'yyyy-MM-dd');
  }

  /**
   * Format date as YYYY-MM for monthly key
   */
  private formatMonthKey(date: Date): string {
    return format(date, 'yyyy-MM');
  }

  /**
   * Award streak freeze when user reaches milestone
   */
  private awardStreakFreeze(currentStreak: number): boolean {
    // Award 1 freeze every 10 days
    return currentStreak > 0 && currentStreak % 10 === 0;
  }

  /**
   * Update monthly streak history
   */
  private updateMonthlyStreakData(
    monthlyStreakData: { [key: string]: number[] } | null,
    date: Date
  ): { [key: string]: number[] } {
    const data = monthlyStreakData || {};
    const monthKey = this.formatMonthKey(date);
    const dayOfMonth = date.getDate();

    if (!data[monthKey]) {
      data[monthKey] = [];
    }

    // Add day if not already present
    if (!data[monthKey].includes(dayOfMonth)) {
      data[monthKey].push(dayOfMonth);
      data[monthKey].sort((a, b) => a - b); // Keep sorted
    }

    return data;
  }

  /**
   * Check if weekly data should reset
   */
  private shouldResetWeeklyData(
    lastStreakDate: Date | null,
    currentDate: Date
  ): boolean {
    if (!lastStreakDate) return false;

    // Reset if NOT in the same week (Sunday start)
    return !isSameWeek(lastStreakDate, currentDate, { weekStartsOn: 0 });
  }

  /**
   * Increment user's streak for Bible reading
   */
  async incrementStreak(userId: string): Promise<{
    currentStreak: number;
    longestStreak: number;
    weeklyStreakData: boolean[];
    streakFreezeCount: number;
    freezeAwarded: boolean;
    freezeUsed: boolean;
    monthlyStreakData: { [key: string]: number[] };
  }> {
    try {
      const user = await this.userRepository.findOne({
        where: { id: userId },
      });

      if (!user) {
        throw new AppError('User not found', StatusCodes.NOT_FOUND);
      }

      // Get today's date in user's timezone
      const userTimezone = user.timezone || 'UTC';
      const todayInUserTz = this.getTodayInUserTimezone(userTimezone);
      const todayString = this.formatDateString(todayInUserTz);

      // Parse last streak date
      let lastStreakDate: Date | null = null;
      if (user.lastStreakDate) {
        const lastDateString =
          typeof user.lastStreakDate === 'string'
            ? user.lastStreakDate
            : user.lastStreakDate.toISOString().split('T')[0];
        lastStreakDate = startOfDay(parseISO(lastDateString));
      }

      const lastStreakString = lastStreakDate
        ? this.formatDateString(lastStreakDate)
        : null;

      // Check if user already has streak for today
      if (lastStreakString === todayString) {
        return {
          currentStreak: user.currentStreak,
          longestStreak: user.longestStreak,
          weeklyStreakData: Array.isArray(user.weeklyStreakData)
            ? user.weeklyStreakData
            : new Array(7).fill(false),
          streakFreezeCount: user.streakFreezeCount,
          freezeAwarded: false,
          freezeUsed: false,
          monthlyStreakData: user.monthlyStreakData || {},
        };
      }

      // Initialize weekly streak data
      let weeklyStreakData: boolean[] = Array.isArray(user.weeklyStreakData)
        ? user.weeklyStreakData.map((v: any) => Boolean(v))
        : new Array(7).fill(false);

      // Check if we should reset weekly data
      if (this.shouldResetWeeklyData(lastStreakDate, todayInUserTz)) {
        weeklyStreakData = new Array(7).fill(false);
      }

      // Ensure array has 7 elements
      while (weeklyStreakData.length < 7) {
        weeklyStreakData.push(false);
      }

      // Calculate days difference
      let daysDiff = 0;
      if (lastStreakDate) {
        daysDiff = differenceInCalendarDays(todayInUserTz, lastStreakDate);
      }

      // Check if streak should continue, use freeze, or reset
      let newCurrentStreak = user.currentStreak;
      let freezeUsed = false;
      let streakBroken = false;

      if (lastStreakDate) {
        if (daysDiff === 1) {
          // Consecutive day - increment streak
          newCurrentStreak = user.currentStreak + 1;
        } else if (daysDiff === 2 && user.streakFreezeCount > 0) {
          // Missed 1 day but have freeze available - use it!
          newCurrentStreak = user.currentStreak + 1;
          user.streakFreezeCount -= 1;
          freezeUsed = true;
          logger.info('Streak freeze used', {
            userId,
            currentStreak: newCurrentStreak,
            remainingFreezes: user.streakFreezeCount,
          });

          // Send freeze used notification
          try {
            const notificationService = new StreakNotificationService();
            await notificationService.sendStreakFreezeUsedNotification(
              userId,
              newCurrentStreak,
              user.streakFreezeCount
            );
          } catch (notifError: any) {
            logger.error('Failed to send freeze used notification', notifError);
          }
        } else if (daysDiff > 1) {
          // Streak broken - reset to 1
          newCurrentStreak = 1;
          streakBroken = true;
          weeklyStreakData = new Array(7).fill(false); // Clear previous week/streak data
          logger.info('Streak broken', {
            userId,
            previousStreak: user.currentStreak,
            daysMissed: daysDiff - 1,
          });

          // Send streak broken notification
          try {
            const notificationService = getAppNotificationService();
            await notificationService.createNotification({
              userId: userId,
              type: AppNotificationType.STREAK_BROKEN,
              title: '💔 Streak Lost',
              message: `Your ${user.currentStreak}-day streak ended. Start fresh today!`,
              data: {
                previousStreak: user.currentStreak,
                daysMissed: daysDiff - 1,
              },
            });
          } catch (notifError: any) {
            logger.error('Failed to send streak broken notification', notifError);
          }
        }
      } else {
        // First time - start streak at 1
        newCurrentStreak = 1;
      }

      // Update longest streak if current streak is higher
      const newLongestStreak = Math.max(user.longestStreak, newCurrentStreak);

      // Check if user earned a streak freeze (every 10 days)
      const freezeAwarded = this.awardStreakFreeze(newCurrentStreak);
      if (freezeAwarded && !freezeUsed) {
        user.streakFreezeCount += 1;
        logger.info('Streak freeze awarded', {
          userId,
          currentStreak: newCurrentStreak,
          totalFreezes: user.streakFreezeCount,
        });

        // Send freeze award notification
        try {
          const notificationService = new StreakNotificationService();
          await notificationService.sendStreakFreezeAwardNotification(
            userId,
            newCurrentStreak,
            user.streakFreezeCount
          );
        } catch (notifError: any) {
          logger.error('Failed to send freeze award notification', notifError);
        }
      }

      // Update weekly streak data
      const dayOfWeek = getDay(todayInUserTz);
      const newWeeklyStreakData = [...weeklyStreakData];
      newWeeklyStreakData[dayOfWeek] = true;

      // Update monthly streak data
      const newMonthlyStreakData = this.updateMonthlyStreakData(
        user.monthlyStreakData || null,
        todayInUserTz
      );

      // Update user in database
      await this.userRepository.update(userId, {
        currentStreak: newCurrentStreak,
        longestStreak: newLongestStreak,
        lastStreakDate: todayInUserTz,
        weeklyStreakData: newWeeklyStreakData,
        streakFreezeCount: user.streakFreezeCount,
        monthlyStreakData: newMonthlyStreakData,
      });

      // Check for milestone achievements
      const milestones = [7, 30, 100, 365];
      if (milestones.includes(newCurrentStreak)) {
        try {
          const notificationService = new StreakNotificationService();
          await notificationService.sendStreakMilestoneNotification(
            userId,
            newCurrentStreak
          );
        } catch (notifError: any) {
          logger.error('Failed to send milestone notification', notifError);
        }
      }

      logger.info('Streak incremented successfully', {
        userId,
        currentStreak: newCurrentStreak,
        longestStreak: newLongestStreak,
        dayOfWeek,
        freezeAwarded,
        freezeUsed,
        streakBroken,
      });

      return {
        currentStreak: newCurrentStreak,
        longestStreak: newLongestStreak,
        weeklyStreakData: newWeeklyStreakData,
        streakFreezeCount: user.streakFreezeCount,
        freezeAwarded,
        freezeUsed,
        monthlyStreakData: newMonthlyStreakData,
      };
    } catch (error: any) {
      logger.error('Error incrementing streak', error);
      throw error;
    }
  }

  /**
   * Get user's streak data
   */
  async getStreakData(userId: string): Promise<{
    currentStreak: number;
    longestStreak: number;
    weeklyStreakData: boolean[];
    lastStreakDate?: Date;
    streakFreezeCount: number;
    monthlyStreakData: { [key: string]: number[] };
  }> {
    try {
      const user = await this.userRepository.findOne({
        where: { id: userId },
        select: [
          'id',
          'currentStreak',
          'longestStreak',
          'lastStreakDate',
          'weeklyStreakData',
          'streakFreezeCount',
          'monthlyStreakData',
          'timezone',
        ],
      });

      if (!user) {
        throw new AppError('User not found', StatusCodes.NOT_FOUND);
      }

        // Proactively check if weekly data should be reset
        if (user.lastStreakDate) {
          const userTimezone = user.timezone || 'UTC';
          const todayInUserTz = this.getTodayInUserTimezone(userTimezone);

          const lDate = user.lastStreakDate as any;
          const lastDateString =
            lDate instanceof Date
              ? format(lDate, 'yyyy-MM-dd')
              : typeof lDate === 'string'
                ? lDate.split('T')[0]
                : null;

          if (lastDateString) {
            const lastStreakDateParsed = parseISO(lastDateString);
            const daysDiff = differenceInCalendarDays(todayInUserTz, lastStreakDateParsed);

            let needsUpdate = false;
            const updates: any = {};

            // 1. Reset weekly data if it's a new week
            if (this.shouldResetWeeklyData(lastStreakDateParsed, todayInUserTz)) {
              logger.info('Resetting weekly streak data for new week', {
                userId,
                lastStreakDate: lastDateString,
                currentDate: format(todayInUserTz, 'yyyy-MM-dd'),
              });
              user.weeklyStreakData = new Array(7).fill(false);
              updates.weeklyStreakData = user.weeklyStreakData;
              needsUpdate = true;
            }

            // 2. Reset current streak and weekly data if a day was missed
            if (daysDiff > 1) {
              logger.info('Streak expired or ghost data detected', {
                userId,
                previousStreak: user.currentStreak,
                daysDiff,
                lastStreakDate: lastDateString,
              });

              user.currentStreak = 0;
              user.weeklyStreakData = new Array(7).fill(false);
              updates.currentStreak = 0;
              updates.weeklyStreakData = user.weeklyStreakData;
              needsUpdate = true;
            }

            if (needsUpdate) {
              await this.userRepository.update(userId, updates);
            }
          }
        } else {
          // If no lastStreakDate but we have weekly data, clear it for consistency
          if (user.weeklyStreakData && user.weeklyStreakData.some(v => v === true)) {
            user.weeklyStreakData = new Array(7).fill(false);
            await this.userRepository.update(userId, { weeklyStreakData: user.weeklyStreakData });
          }
        }

      return {
        currentStreak: user.currentStreak,
        longestStreak: user.longestStreak,
        weeklyStreakData: Array.isArray(user.weeklyStreakData)
          ? user.weeklyStreakData
          : new Array(7).fill(false),
        lastStreakDate: user.lastStreakDate,
        streakFreezeCount: user.streakFreezeCount,
        monthlyStreakData: user.monthlyStreakData || {},
      };
    } catch (error: any) {
      logger.error('Error getting streak data', error);
      throw error;
    }
  }

  /**
   * Get monthly streak data for a specific month
   */
  async getMonthlyStreakData(
    userId: string,
    year: number,
    month: number
  ): Promise<number[]> {
    try {
      if (!userId) {
        logger.error('getMonthlyStreakData called with invalid userId', undefined, { userId });
        throw new AppError('User ID is required', StatusCodes.BAD_REQUEST);
      }

      logger.info('Fetching monthly streak data', { userId, year, month });

      const user = await this.userRepository.findOne({
        where: { id: userId },
        select: ['id', 'monthlyStreakData'],
      });

      if (!user) {
        logger.error('User not found in getMonthlyStreakData', undefined, { userId });
        throw new AppError('User not found', StatusCodes.NOT_FOUND);
      }

      const monthKey = `${year}-${String(month).padStart(2, '0')}`;
      const monthlyData = user.monthlyStreakData || {};

      logger.info('Monthly streak data retrieved', {
        userId,
        monthKey,
        hasData: !!monthlyData[monthKey],
        streakDays: monthlyData[monthKey] || [],
      });

      return monthlyData[monthKey] || [];
    } catch (error: any) {
      logger.error(
        'Error getting monthly streak data',
        error instanceof Error ? error : new Error(String(error)),
        {
          userId,
          year,
          month,
        }
      );
      throw error;
    }
  }

  /**
   * Reset weekly streak data (called on Sunday or for admin)
   */
  async resetWeeklyStreakData(userId: string): Promise<void> {
    try {
      await this.userRepository.update(userId, {
        weeklyStreakData: new Array(7).fill(false),
      });

      logger.info('Weekly streak data reset', { userId });
    } catch (error: any) {
      logger.error('Error resetting weekly streak data', error);
      throw error;
    }
  }

  /**
   * Check for users at risk of losing their streak
   * Returns users who haven't read today and have an active streak
   */
  async getUsersAtRiskOfLosingStreak(): Promise<
    Array<{
      id: string;
      email: string;
      firstName?: string;
      currentStreak: number;
      lastStreakDate: Date;
      timezone: string;
    }>
  > {
    try {
      const users = await this.userRepository
        .createQueryBuilder('user')
        .select([
          'user.id',
          'user.email',
          'user.firstName',
          'user.currentStreak',
          'user.lastStreakDate',
          'user.timezone',
        ])
        .where('user.currentStreak > 0')
        .andWhere('user.lastStreakDate IS NOT NULL')
        .getMany();

      const usersAtRisk: Array<{
        id: string;
        email: string;
        firstName?: string;
        currentStreak: number;
        lastStreakDate: Date;
        timezone: string;
      }> = [];

      for (const user of users) {
        const userTimezone = user.timezone || 'UTC';
        const todayInUserTz = this.getTodayInUserTimezone(userTimezone);
        const todayString = this.formatDateString(todayInUserTz);

        const lastDateString =
          typeof user.lastStreakDate === 'string'
            ? user.lastStreakDate
            : user.lastStreakDate?.toISOString().split('T')[0];

        // User is at risk if they haven't read today
        if (lastDateString !== todayString) {
          usersAtRisk.push({
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            currentStreak: user.currentStreak,
            lastStreakDate: user.lastStreakDate!,
            timezone: userTimezone,
          });
        }
      }

      return usersAtRisk;
    } catch (error: any) {
      logger.error('Error getting users at risk of losing streak', error);
      throw error;
    }
  }
}
