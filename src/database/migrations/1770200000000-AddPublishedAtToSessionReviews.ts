import { MigrationInterface, QueryRunner } from 'typeorm';
import { logger } from '@/config/int-services';

export class AddPublishedAtToSessionReviews1770200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const columnExists = await queryRunner.query(
      `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'session_reviews'
       AND COLUMN_NAME = 'publishedAt'`
    );

    if (columnExists[0].count > 0) {
      logger.info('publishedAt column already exists on session_reviews, skipping');
      return;
    }

    await queryRunner.query(
      `ALTER TABLE session_reviews ADD COLUMN publishedAt datetime NULL AFTER mentorViewedAt`
    );

    // Back-fill: for existing reviews, set publishedAt = sessions.scheduledAt + sessions.duration minutes
    await queryRunner.query(
      `UPDATE session_reviews sr
       JOIN sessions s ON s.id = sr.sessionId
       SET sr.publishedAt = DATE_ADD(s.scheduledAt, INTERVAL s.duration MINUTE)
       WHERE sr.publishedAt IS NULL AND sr.sessionId IS NOT NULL`
    );

    logger.info('Added publishedAt column to session_reviews and back-filled existing rows');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE session_reviews DROP COLUMN publishedAt`
    );
  }
}
