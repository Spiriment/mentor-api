import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNeedsMoreInfoMessage1782300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.hasColumn(
      'mentor_profiles',
      'needsMoreInfoMessage'
    );
    if (!hasColumn) {
      await queryRunner.query(`
        ALTER TABLE \`mentor_profiles\`
        ADD COLUMN \`needsMoreInfoMessage\` text NULL
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.hasColumn(
      'mentor_profiles',
      'needsMoreInfoMessage'
    );
    if (hasColumn) {
      await queryRunner.query(`
        ALTER TABLE \`mentor_profiles\` DROP COLUMN \`needsMoreInfoMessage\`
      `);
    }
  }
}
