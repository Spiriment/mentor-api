import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAiChapterSummaries1780500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE ai_chapter_summaries (
        id        VARCHAR(36) NOT NULL PRIMARY KEY,
        book      VARCHAR(100) NOT NULL,
        chapter   INT NOT NULL,
        summary   TEXT NOT NULL,
        createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE KEY uq_book_chapter (book, chapter)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS ai_chapter_summaries`);
  }
}
