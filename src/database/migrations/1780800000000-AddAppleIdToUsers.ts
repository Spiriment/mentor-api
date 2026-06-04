import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAppleIdToUsers1780800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasCol = await queryRunner.query(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'appleId'`
    );
    if (parseInt(hasCol[0].cnt, 10) === 0) {
      await queryRunner.query(
        `ALTER TABLE users ADD COLUMN appleId VARCHAR(255) NULL UNIQUE`
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE users DROP COLUMN appleId`);
  }
}
