import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddChurchFieldsToMenteeProfile1733234400000
  implements MigrationInterface
{
  name = 'AddChurchFieldsToMenteeProfile1733234400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasChurchDenomination = await queryRunner.hasColumn(
      'mentee_profiles',
      'churchDenomination'
    );
    if (!hasChurchDenomination) {
      await queryRunner.query(`
        ALTER TABLE \`mentee_profiles\`
        ADD COLUMN \`churchDenomination\` varchar(255) NULL AFTER \`christianExperience\`
      `);
    }

    const hasChurchName = await queryRunner.hasColumn(
      'mentee_profiles',
      'churchName'
    );
    if (!hasChurchName) {
      await queryRunner.query(`
        ALTER TABLE \`mentee_profiles\`
        ADD COLUMN \`churchName\` varchar(255) NULL AFTER \`churchDenomination\`
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasChurchName = await queryRunner.hasColumn(
      'mentee_profiles',
      'churchName'
    );
    if (hasChurchName) {
      await queryRunner.query(`
        ALTER TABLE \`mentee_profiles\`
        DROP COLUMN \`churchName\`
      `);
    }

    const hasChurchDenomination = await queryRunner.hasColumn(
      'mentee_profiles',
      'churchDenomination'
    );
    if (hasChurchDenomination) {
      await queryRunner.query(`
        ALTER TABLE \`mentee_profiles\`
        DROP COLUMN \`churchDenomination\`
      `);
    }
  }
}
