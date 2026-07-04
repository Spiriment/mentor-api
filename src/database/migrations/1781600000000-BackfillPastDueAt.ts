import { MigrationInterface, QueryRunner } from 'typeorm';

export class BackfillPastDueAt1781600000000 implements MigrationInterface {
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
      [db, 'user_subscriptions', 'pastDueAt'],
    );

    if (Number(rows[0]?.count) === 0) return;

    await queryRunner.query(`
      UPDATE \`user_subscriptions\`
      SET \`pastDueAt\` = \`updatedAt\`
      WHERE \`status\` = 'past_due'
        AND \`pastDueAt\` IS NULL
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Non-destructive backfill — no rollback.
  }
}
