import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPushTokenToUser1733234700000 implements MigrationInterface {
  name = 'AddPushTokenToUser1733234700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add pushToken column to users table
    await queryRunner.query(`
      ALTER TABLE \`users\`
      ADD COLUMN \`pushToken\` varchar(255) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert: Remove the pushToken column
    await queryRunner.query(`
      ALTER TABLE \`users\`
      DROP COLUMN \`pushToken\`
    `);
  }
}
