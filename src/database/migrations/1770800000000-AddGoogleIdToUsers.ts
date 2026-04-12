import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGoogleIdToUsers1770800000000 implements MigrationInterface {
  name = 'AddGoogleIdToUsers1770800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD COLUMN \`googleId\` VARCHAR(255) NULL UNIQUE`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`users\` DROP COLUMN \`googleId\``
    );
  }
}
