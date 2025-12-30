import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveMenteeAvailability1734763554000
  implements MigrationInterface
{
  name = 'RemoveMenteeAvailability1734763554000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the availability column from mentee_profiles table
    await queryRunner.query(`
      ALTER TABLE \`mentee_profiles\` 
      DROP COLUMN \`availability\`
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert: Add back the availability column
    await queryRunner.query(`
      ALTER TABLE \`mentee_profiles\` 
      ADD COLUMN \`availability\` json NULL
    `);
  }
}

