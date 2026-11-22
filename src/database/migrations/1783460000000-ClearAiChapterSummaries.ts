import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cached AI chapter summaries could belong to the wrong chapter: the app sometimes sent the
 * previous chapter's verses with the new chapter number (e.g. Nehemiah 7 showed chapter 6's
 * summary), and the first answer was cached for everyone. The server now summarizes text it
 * fetches itself, so clear the cache and let each summary regenerate correctly on first view.
 */
export class ClearAiChapterSummaries1783460000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM ai_chapter_summaries`);
  }

  public async down(): Promise<void> {
    // Deleted summaries regenerate on demand; nothing to restore.
  }
}
