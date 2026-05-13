import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMentorAgreementFields1780600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE mentor_profiles
        ADD COLUMN agreementAcceptedAt DATETIME NULL,
        ADD COLUMN agreementVersion VARCHAR(16) NULL,
        ADD COLUMN eSignature VARCHAR(255) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE mentor_profiles
        DROP COLUMN agreementAcceptedAt,
        DROP COLUMN agreementVersion,
        DROP COLUMN eSignature
    `);
  }
}
