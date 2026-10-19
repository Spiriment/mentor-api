import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateVideoUploadAttempts1783300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('video_upload_attempts')) return;
    await queryRunner.query(`
      CREATE TABLE \`video_upload_attempts\` (
        \`id\` varchar(36) NOT NULL,
        \`userId\` varchar(36) NOT NULL,
        \`outcome\` varchar(16) NOT NULL,
        \`stage\` varchar(16) NOT NULL,
        \`errorMessage\` varchar(500) NULL,
        \`originalSizeBytes\` bigint NULL,
        \`uploadSizeBytes\` bigint NULL,
        \`durationSeconds\` int NULL,
        \`compressionFailed\` tinyint NOT NULL DEFAULT 0,
        \`platform\` varchar(10) NULL,
        \`appVersion\` varchar(20) NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        INDEX \`IDX_video_upload_attempts_user_created\` (\`userId\`, \`createdAt\`),
        INDEX \`IDX_video_upload_attempts_outcome_created\` (\`outcome\`, \`createdAt\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('video_upload_attempts')) {
      await queryRunner.query('DROP TABLE `video_upload_attempts`');
    }
  }
}
