import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSessionSummaryAndReviewTable1762790000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add sessionSummary and assignments columns to sessions table
    await queryRunner.query(`
      ALTER TABLE \`sessions\`
      ADD COLUMN \`sessionSummary\` text NULL AFTER \`sessionNotes\`,
      ADD COLUMN \`assignments\` json NULL AFTER \`sessionSummary\`
    `);

    // Create reviews table
    await queryRunner.query(`
      CREATE TABLE \`reviews\` (
        \`id\` varchar(36) NOT NULL,
        \`sessionId\` varchar(36) NOT NULL,
        \`mentorId\` varchar(36) NOT NULL,
        \`menteeId\` varchar(36) NOT NULL,
        \`rating\` int NOT NULL,
        \`comment\` text NOT NULL,
        \`isVisible\` tinyint NOT NULL DEFAULT 1,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        INDEX \`IDX_reviews_sessionId\` (\`sessionId\`),
        INDEX \`IDX_reviews_mentorId\` (\`mentorId\`),
        INDEX \`IDX_reviews_menteeId\` (\`menteeId\`),
        CONSTRAINT \`FK_reviews_session\` FOREIGN KEY (\`sessionId\`) REFERENCES \`sessions\`(\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`FK_reviews_mentor\` FOREIGN KEY (\`mentorId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`FK_reviews_mentee\` FOREIGN KEY (\`menteeId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop reviews table
    await queryRunner.query(`DROP TABLE \`reviews\``);

    // Remove columns from sessions table
    await queryRunner.query(`
      ALTER TABLE \`sessions\`
      DROP COLUMN \`assignments\`,
      DROP COLUMN \`sessionSummary\`
    `);
  }
}

