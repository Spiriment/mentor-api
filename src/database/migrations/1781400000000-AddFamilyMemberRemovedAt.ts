import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFamilyMemberRemovedAt1781400000000 implements MigrationInterface {
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
      [db, 'family_members', 'removedAt'],
    );

    if (Number(rows[0]?.count) === 0) {
      await queryRunner.query(
        `ALTER TABLE \`family_members\` ADD COLUMN \`removedAt\` datetime NULL`,
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
      [db, 'family_members', 'removedAt'],
    );

    if (Number(rows[0]?.count) > 0) {
      await queryRunner.query(`ALTER TABLE \`family_members\` DROP COLUMN \`removedAt\``);
    }
  }
}
