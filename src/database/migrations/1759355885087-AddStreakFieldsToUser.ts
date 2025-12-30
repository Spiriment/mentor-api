import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStreakFieldsToUser1759355885087 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Helper function to check if column exists
    const columnExists = async (tableName: string, columnName: string): Promise<boolean> => {
      const result = await queryRunner.query(
        `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() 
         AND TABLE_NAME = '${tableName}' 
         AND COLUMN_NAME = '${columnName}'`
      );
      return result[0].count > 0;
    };

    // Add streak tracking fields to users table (only if they don't exist)
    if (!(await columnExists('users', 'currentStreak'))) {
      await queryRunner.query(
        `ALTER TABLE \`users\` ADD \`currentStreak\` int NOT NULL DEFAULT 0`
      );
    }
    if (!(await columnExists('users', 'longestStreak'))) {
      await queryRunner.query(
        `ALTER TABLE \`users\` ADD \`longestStreak\` int NOT NULL DEFAULT 0`
      );
    }
    if (!(await columnExists('users', 'lastStreakDate'))) {
      await queryRunner.query(
        `ALTER TABLE \`users\` ADD \`lastStreakDate\` date NULL`
      );
    }
    if (!(await columnExists('users', 'weeklyStreakData'))) {
      await queryRunner.query(
        `ALTER TABLE \`users\` ADD \`weeklyStreakData\` json NULL`
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove streak tracking fields from users table
    await queryRunner.query(
      `ALTER TABLE \`users\` DROP COLUMN \`weeklyStreakData\``
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` DROP COLUMN \`lastStreakDate\``
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` DROP COLUMN \`longestStreak\``
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` DROP COLUMN \`currentStreak\``
    );
  }
}
