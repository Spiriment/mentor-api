import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddChurchDiscountFields1781100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE church_portals ADD COLUMN discountPercent int NOT NULL DEFAULT 0`
    );
    await queryRunner.query(
      `ALTER TABLE users ADD COLUMN churchDiscountPercent int NOT NULL DEFAULT 0`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE users DROP COLUMN churchDiscountPercent`);
    await queryRunner.query(`ALTER TABLE church_portals DROP COLUMN discountPercent`);
  }
}
