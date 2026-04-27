import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveMenteeAvailability1734763554000
  implements MigrationInterface
{
  name = 'RemoveMenteeAvailability1734763554000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasAvailability = await queryRunner.hasColumn(
      'mentee_profiles',
      'availability'
    );
    if (hasAvailability) {
      await queryRunner.query(`
        ALTER TABLE \`mentee_profiles\` 
        DROP COLUMN \`availability\`
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasAvailability = await queryRunner.hasColumn(
      'mentee_profiles',
      'availability'
    );
    if (!hasAvailability) {
      await queryRunner.query(`
        ALTER TABLE \`mentee_profiles\` 
        ADD COLUMN \`availability\` json NULL
      `);
    }
  }
}

