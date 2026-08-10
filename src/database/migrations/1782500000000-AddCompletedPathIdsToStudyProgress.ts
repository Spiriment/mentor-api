import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCompletedPathIdsToStudyProgress1782500000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.hasColumn(
      'study_progress',
      'completedPathIds'
    );
    if (!hasColumn) {
      await queryRunner.query(`
        ALTER TABLE \`study_progress\`
        ADD COLUMN \`completedPathIds\` json NULL
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.hasColumn(
      'study_progress',
      'completedPathIds'
    );
    if (hasColumn) {
      await queryRunner.query(`
        ALTER TABLE \`study_progress\` DROP COLUMN \`completedPathIds\`
      `);
    }
  }
}
