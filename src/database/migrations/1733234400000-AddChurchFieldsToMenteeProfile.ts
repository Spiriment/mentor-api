import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddChurchFieldsToMenteeProfile1733234400000
  implements MigrationInterface
{
  name = 'AddChurchFieldsToMenteeProfile1733234400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add churchDenomination and churchName columns to mentee_profiles table
    await queryRunner.query(`
      ALTER TABLE \`mentee_profiles\`
      ADD COLUMN \`churchDenomination\` varchar(255) NULL AFTER \`christianExperience\`
    `);

    await queryRunner.query(`
      ALTER TABLE \`mentee_profiles\`
      ADD COLUMN \`churchName\` varchar(255) NULL AFTER \`churchDenomination\`
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert: Remove the church fields columns
    await queryRunner.query(`
      ALTER TABLE \`mentee_profiles\`
      DROP COLUMN \`churchName\`
    `);

    await queryRunner.query(`
      ALTER TABLE \`mentee_profiles\`
      DROP COLUMN \`churchDenomination\`
    `);
  }
}
