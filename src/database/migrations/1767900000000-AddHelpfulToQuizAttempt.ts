import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHelpfulToQuizAttempt1767900000000 implements MigrationInterface {
  name = 'AddHelpfulToQuizAttempt1767900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const [{ db }] = await queryRunner.query(`SELECT DATABASE() as db`);

    const rows = await queryRunner.query(
      `
        SELECT COUNT(*) as count
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = ?
          AND TABLE_NAME = ?
          AND COLUMN_NAME = ?
      `,
      [db, 'quiz_attempts', 'helpful'],
    );

    if (Number(rows[0]?.count) === 0) {
      await queryRunner.query(
        `ALTER TABLE \`quiz_attempts\` ADD COLUMN \`helpful\` tinyint(1) NULL`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ db }] = await queryRunner.query(`SELECT DATABASE() as db`);

    const rows = await queryRunner.query(
      `
        SELECT COUNT(*) as count
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = ?
          AND TABLE_NAME = ?
          AND COLUMN_NAME = ?
      `,
      [db, 'quiz_attempts', 'helpful'],
    );

    if (Number(rows[0]?.count) > 0) {
      await queryRunner.query(
        `ALTER TABLE \`quiz_attempts\` DROP COLUMN \`helpful\``,
      );
    }
  }
}
