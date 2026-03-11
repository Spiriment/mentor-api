import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFortyFiveMinutesToSessionDuration1770100000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`sessions\`
      MODIFY COLUMN \`duration\` enum('30','45','60','90','120') NOT NULL DEFAULT '60'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // First update any 45-min sessions to 60 min to avoid constraint violation on rollback
    await queryRunner.query(`
      UPDATE \`sessions\` SET \`duration\` = '60' WHERE \`duration\` = '45'
    `);
    await queryRunner.query(`
      ALTER TABLE \`sessions\`
      MODIFY COLUMN \`duration\` enum('30','60','90','120') NOT NULL DEFAULT '60'
    `);
  }
}
