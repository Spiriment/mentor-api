import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * One row per cron job per minute it was due (see common/cronRuns.ts). The unique key is
 * what stops the second backend process from running the same job again.
 */
export class CreateCronRuns1783520000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('cron_runs')) return;
    await queryRunner.query(`
      CREATE TABLE \`cron_runs\` (
        \`job\` varchar(64) NOT NULL,
        \`runAt\` datetime NOT NULL,
        \`startedAt\` datetime NOT NULL,
        \`finishedAt\` datetime NULL,
        PRIMARY KEY (\`job\`, \`runAt\`),
        INDEX \`IDX_cron_runs_runAt\` (\`runAt\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `cron_runs`');
  }
}
