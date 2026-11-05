import { MigrationInterface, QueryRunner } from 'typeorm';

/** Records which members agreed to the church privacy notice, and when. */
export class CreateChurchPrivacyAcceptances1783440000000 implements MigrationInterface {
  name = 'CreateChurchPrivacyAcceptances1783440000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('church_privacy_acceptances')) return;
    await queryRunner.query(`
      CREATE TABLE \`church_privacy_acceptances\` (
        \`id\` varchar(36) NOT NULL,
        \`userId\` varchar(36) NOT NULL,
        \`churchPortalId\` varchar(36) NOT NULL,
        \`noticeVersion\` varchar(10) NOT NULL,
        \`source\` varchar(20) NOT NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`UQ_church_privacy_acceptance\` (\`userId\`, \`churchPortalId\`, \`noticeVersion\`)
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('church_privacy_acceptances')) {
      await queryRunner.query('DROP TABLE `church_privacy_acceptances`');
    }
  }
}
