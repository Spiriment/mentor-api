import { MigrationInterface, QueryRunner } from 'typeorm';

/** People who signed up to the church portal demo (see DemoVisitor entity). */
export class CreateDemoVisitors1783500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('demo_visitors')) return;
    await queryRunner.query(`
      CREATE TABLE \`demo_visitors\` (
        \`id\` varchar(36) NOT NULL,
        \`email\` varchar(255) NOT NULL,
        \`firstName\` varchar(100) NOT NULL,
        \`lastName\` varchar(100) NULL,
        \`visits\` int NOT NULL DEFAULT 1,
        \`pageViews\` json NULL,
        \`lastSeenAt\` datetime NOT NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`UQ_demo_visitors_email\` (\`email\`),
        INDEX \`IDX_demo_visitors_last_seen\` (\`lastSeenAt\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `demo_visitors`');
  }
}
