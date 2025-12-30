import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSessionDurationToMentorProfile1733234500000
  implements MigrationInterface
{
  name = 'AddSessionDurationToMentorProfile1733234500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add sessionDuration column to mentor_profiles table
    await queryRunner.query(`
      ALTER TABLE \`mentor_profiles\`
      ADD COLUMN \`sessionDuration\` int NOT NULL DEFAULT 60 AFTER \`menteeCapacity\`
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert: Remove the sessionDuration column
    await queryRunner.query(`
      ALTER TABLE \`mentor_profiles\`
      DROP COLUMN \`sessionDuration\`
    `);
  }
}
