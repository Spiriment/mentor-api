import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPromoRedemptionCompletedAt1781300000000 implements MigrationInterface {
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
      [db, 'promo_code_redemptions', 'completedAt'],
    );

    if (Number(rows[0]?.count) === 0) {
      await queryRunner.query(
        `ALTER TABLE \`promo_code_redemptions\` ADD COLUMN \`completedAt\` datetime NULL`,
      );
      await queryRunner.query(
        `UPDATE \`promo_code_redemptions\` SET \`completedAt\` = \`redeemedAt\` WHERE \`completedAt\` IS NULL`,
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
      [db, 'promo_code_redemptions', 'completedAt'],
    );

    if (Number(rows[0]?.count) > 0) {
      await queryRunner.query(
        `ALTER TABLE \`promo_code_redemptions\` DROP COLUMN \`completedAt\``,
      );
    }
  }
}
