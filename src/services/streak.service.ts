import { AppDataSource } from '@/config/data-source';
import { User } from '@/database/entities/user.entity';
import { logger } from '@/config/int-services';
import { AppError } from '@/common/errors';
import { StatusCodes } from 'http-status-codes';

export class StreakService {
  private userRepository = AppDataSource.getRepository(User);

  /**
   * Increment user's streak for Bible reading
   */
  async incrementStreak(userId: string): Promise<{
    currentStreak: number;
    longestStreak: number;
    weeklyStreakData: boolean[];
  }> {
    try {
      const user = await this.userRepository.findOne({
        where: { id: userId },
      });

      if (!user) {
        throw new AppError('User not found', StatusCodes.NOT_FOUND);
      }

      const today = new Date();
      const todayString = today.toISOString().split('T')[0]; // YYYY-MM-DD format
      const lastStreakDate = user.lastStreakDate?.toISOString().split('T')[0];

      // Initialize weekly streak data if not exists
      if (!user.weeklyStreakData) {
        user.weeklyStreakData = new Array(7).fill(false);
      }

      // Check if user already has streak for today
      if (lastStreakDate === todayString) {
        return {
          currentStreak: user.currentStreak,
          longestStreak: user.longestStreak,
          weeklyStreakData: user.weeklyStreakData,
        };
      }

      // Get day of week (0 = Sunday, 1 = Monday, etc.)
      const dayOfWeek = today.getDay();

      // Check if streak should continue or reset
      let newCurrentStreak = user.currentStreak;

      if (lastStreakDate) {
        const lastDate = new Date(lastStreakDate);
        const daysDiff = Math.floor(
          (today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysDiff === 1) {
          // Consecutive day - increment streak
          newCurrentStreak = user.currentStreak + 1;
        } else if (daysDiff > 1) {
          // Streak broken - reset to 1
          newCurrentStreak = 1;
        }
        // If daysDiff === 0, already handled above (same day)
      } else {
        // First time - start streak at 1
        newCurrentStreak = 1;
      }

      // Update longest streak if current streak is higher
      const newLongestStreak = Math.max(user.longestStreak, newCurrentStreak);

      // Update weekly streak data
      const newWeeklyStreakData = [...user.weeklyStreakData];
      newWeeklyStreakData[dayOfWeek] = true;

      // Update user in database
      await this.userRepository.update(userId, {
        currentStreak: newCurrentStreak,
        longestStreak: newLongestStreak,
        lastStreakDate: today,
        weeklyStreakData: newWeeklyStreakData,
      });

      logger.info('Streak incremented successfully', {
        userId,
        currentStreak: newCurrentStreak,
        longestStreak: newLongestStreak,
        dayOfWeek,
      });

      return {
        currentStreak: newCurrentStreak,
        longestStreak: newLongestStreak,
        weeklyStreakData: newWeeklyStreakData,
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
  }> {
    try {
      const user = await this.userRepository.findOne({
        where: { id: userId },
        select: [
          'currentStreak',
          'longestStreak',
          'lastStreakDate',
          'weeklyStreakData',
        ],
      });

      if (!user) {
        throw new AppError('User not found', StatusCodes.NOT_FOUND);
      }

      return {
        currentStreak: user.currentStreak,
        longestStreak: user.longestStreak,
        weeklyStreakData: user.weeklyStreakData || new Array(7).fill(false),
        lastStreakDate: user.lastStreakDate,
      };
    } catch (error: any) {
      logger.error('Error getting streak data', error);
      throw error;
    }
  }

  /**
   * Reset weekly streak data (called on Sunday)
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
}
