import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddChurchPortalIdToUsers1780100000000 implements MigrationInterface {
  name = 'AddChurchPortalIdToUsers1780100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`users\`
        ADD COLUMN \`churchPortalId\` VARCHAR(36) NULL AFTER \`orgPlanId\`,
        ADD INDEX \`IDX_users_churchPortalId\` (\`churchPortalId\`)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`users\` DROP INDEX \`IDX_users_churchPortalId\``);
    await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`churchPortalId\``);
  }
}
