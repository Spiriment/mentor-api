import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateQuizTables1780000000000 implements MigrationInterface {
  name = 'CreateQuizTables1780000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`quiz_books\` (
        \`id\` varchar(36) NOT NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        \`book\` varchar(255) NOT NULL,
        \`category\` enum('OT','NT') NOT NULL,
        \`isActive\` tinyint NOT NULL DEFAULT 1,
        \`sortOrder\` int NOT NULL DEFAULT 0,
        UNIQUE KEY \`UQ_quiz_books_book\` (\`book\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`quiz_questions\` (
        \`id\` varchar(36) NOT NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        \`bookId\` varchar(36) NOT NULL,
        \`version\` int NOT NULL,
        \`questionNumber\` int NOT NULL,
        \`question\` text NOT NULL,
        \`options\` json NOT NULL,
        \`answer\` varchar(1) NOT NULL,
        \`verse\` varchar(255) NULL,
        \`isActive\` tinyint NOT NULL DEFAULT 1,
        INDEX \`IDX_quiz_questions_book_version\` (\`bookId\`, \`version\`),
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_quiz_questions_bookId\` FOREIGN KEY (\`bookId\`) REFERENCES \`quiz_books\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`quiz_attempts\` (
        \`id\` varchar(36) NOT NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        \`userId\` varchar(36) NOT NULL,
        \`book\` varchar(255) NOT NULL,
        \`version\` int NOT NULL,
        \`score\` int NOT NULL,
        \`total\` int NOT NULL,
        \`completedAt\` timestamp NOT NULL,
        \`answers\` json NULL,
        INDEX \`IDX_quiz_attempts_user_book_version\` (\`userId\`, \`book\`, \`version\`),
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_quiz_attempts_userId\` FOREIGN KEY (\`userId\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`quiz_streaks\` (
        \`id\` varchar(36) NOT NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        \`userId\` varchar(36) NOT NULL,
        \`currentStreak\` int NOT NULL DEFAULT 0,
        \`longestStreak\` int NOT NULL DEFAULT 0,
        \`lastQuizDate\` date NULL,
        \`weeklyData\` json NULL,
        \`monthlyData\` json NULL,
        \`highScores\` json NULL,
        UNIQUE KEY \`UQ_quiz_streaks_userId\` (\`userId\`),
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_quiz_streaks_userId\` FOREIGN KEY (\`userId\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`quiz_streaks\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`quiz_attempts\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`quiz_questions\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`quiz_books\``);
  }
}
