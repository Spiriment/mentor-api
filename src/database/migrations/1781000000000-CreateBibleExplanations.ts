import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBibleExplanations1781000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE bible_explanations (
        id               VARCHAR(36) NOT NULL PRIMARY KEY,
        userId           VARCHAR(36) NOT NULL,
        translation      VARCHAR(50) NOT NULL,
        book             VARCHAR(100) NOT NULL,
        chapter          INT NOT NULL,
        verse            INT NOT NULL,
        explanation      TEXT NOT NULL,
        crossReferences  TEXT NULL,
        createdAt        DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt        DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        INDEX idx_bible_explanations_user (userId),
        INDEX idx_bible_explanations_user_book (userId, book)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS bible_explanations`);
  }
}
