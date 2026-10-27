import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * When each side first joined a session's call, so the missed-session job can tell a real
 * session from one where only one person turned up (it used to mark those completed).
 */
export class AddSessionParticipantJoinTimes1783420000000 implements MigrationInterface {
  name = 'AddSessionParticipantJoinTimes1783420000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('sessions', 'mentorJoinedAt'))) {
      await queryRunner.query('ALTER TABLE `sessions` ADD `mentorJoinedAt` datetime NULL');
    }
    if (!(await queryRunner.hasColumn('sessions', 'menteeJoinedAt'))) {
      await queryRunner.query('ALTER TABLE `sessions` ADD `menteeJoinedAt` datetime NULL');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('sessions', 'menteeJoinedAt')) {
      await queryRunner.query('ALTER TABLE `sessions` DROP COLUMN `menteeJoinedAt`');
    }
    if (await queryRunner.hasColumn('sessions', 'mentorJoinedAt')) {
      await queryRunner.query('ALTER TABLE `sessions` DROP COLUMN `mentorJoinedAt`');
    }
  }
}
