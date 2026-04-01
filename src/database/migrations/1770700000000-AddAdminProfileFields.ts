import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAdminProfileFields1770700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`admin_users\`
      ADD COLUMN \`firstName\` varchar(120) NULL,
      ADD COLUMN \`lastName\` varchar(120) NULL,
      ADD COLUMN \`avatarUrl\` varchar(500) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`admin_users\`
      DROP COLUMN \`avatarUrl\`,
      DROP COLUMN \`lastName\`,
      DROP COLUMN \`firstName\`
    `);
  }
}
