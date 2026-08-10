import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEarnedAchievementsToQuizStreak1782600000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasEarned = await queryRunner.hasColumn(
      'quiz_streaks',
      'earnedAchievements'
    );
    if (!hasEarned) {
      await queryRunner.query(`
        ALTER TABLE \`quiz_streaks\`
        ADD COLUMN \`earnedAchievements\` json NULL
      `);
    }

    const hasStats = await queryRunner.hasColumn(
      'quiz_streaks',
      'achievementStats'
    );
    if (!hasStats) {
      await queryRunner.query(`
        ALTER TABLE \`quiz_streaks\`
        ADD COLUMN \`achievementStats\` json NULL
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('quiz_streaks', 'achievementStats')) {
      await queryRunner.query(`
        ALTER TABLE \`quiz_streaks\` DROP COLUMN \`achievementStats\`
      `);
    }
    if (await queryRunner.hasColumn('quiz_streaks', 'earnedAchievements')) {
      await queryRunner.query(`
        ALTER TABLE \`quiz_streaks\` DROP COLUMN \`earnedAchievements\`
      `);
    }
  }
}
