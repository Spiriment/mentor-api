import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStreakFieldsToUser1759355885087 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add streak tracking fields to users table
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD \`currentStreak\` int NOT NULL DEFAULT 0`
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD \`longestStreak\` int NOT NULL DEFAULT 0`
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD \`lastStreakDate\` date NULL`
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD \`weeklyStreakData\` json NULL`
    );
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
