import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMenteeAgreementFields1780700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE mentee_profiles
        ADD COLUMN agreementVersion VARCHAR(16) NULL,
        ADD COLUMN eSignature VARCHAR(255) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE mentee_profiles
        DROP COLUMN agreementVersion,
        DROP COLUMN eSignature
    `);
  }
}
