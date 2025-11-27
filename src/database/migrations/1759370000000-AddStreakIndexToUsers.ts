import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStreakIndexToUsers1759370000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add index on lastStreakDate
    // This improves performance of getUsersAtRiskOfLosingStreak() query
    // Note: MySQL doesn't support partial indexes (WHERE clause), so we index all rows
    await queryRunner.query(
      `CREATE INDEX idx_users_last_streak_date ON users(lastStreakDate)`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove the index
    await queryRunner.query(
      `DROP INDEX idx_users_last_streak_date ON users`
    );
  }
}
