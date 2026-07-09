import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReferralSystem1782100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add referral fields to users
    await queryRunner.query(`
      ALTER TABLE users
        ADD COLUMN referralCode VARCHAR(12) NULL UNIQUE,
        ADD COLUMN referralPoints INT NOT NULL DEFAULT 0
    `);

    // Create referrals table
    await queryRunner.query(`
      CREATE TABLE referrals (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        referrerId VARCHAR(36) NOT NULL,
        referredUserId VARCHAR(36) NOT NULL UNIQUE,
        pointsAwarded INT NOT NULL DEFAULT 10,
        createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        INDEX idx_referrals_referrer (referrerId),
        INDEX idx_referrals_referred (referredUserId)
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE referrals`);
    await queryRunner.query(`
      ALTER TABLE users
        DROP COLUMN referralCode,
        DROP COLUMN referralPoints
    `);
  }
}
