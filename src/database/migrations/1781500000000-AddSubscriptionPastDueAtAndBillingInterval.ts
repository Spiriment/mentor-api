import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSubscriptionPastDueAtAndBillingInterval1781500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const [{ db }] = await queryRunner.query(`SELECT DATABASE() as db`);

    for (const column of [
      { name: 'pastDueAt', ddl: 'datetime NULL' },
      { name: 'billingInterval', ddl: "varchar(16) NULL" },
    ]) {
      const rows = await queryRunner.query(
        `
          SELECT COUNT(*) as count
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = ?
            AND TABLE_NAME = ?
            AND COLUMN_NAME = ?
        `,
        [db, 'user_subscriptions', column.name],
      );

      if (Number(rows[0]?.count) === 0) {
        await queryRunner.query(
          `ALTER TABLE \`user_subscriptions\` ADD COLUMN \`${column.name}\` ${column.ddl}`,
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ db }] = await queryRunner.query(`SELECT DATABASE() as db`);

    for (const column of ['billingInterval', 'pastDueAt']) {
      const rows = await queryRunner.query(
        `
          SELECT COUNT(*) as count
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = ?
            AND TABLE_NAME = ?
            AND COLUMN_NAME = ?
        `,
        [db, 'user_subscriptions', column],
      );

      if (Number(rows[0]?.count) > 0) {
        await queryRunner.query(`ALTER TABLE \`user_subscriptions\` DROP COLUMN \`${column}\``);
      }
    }
  }
}
