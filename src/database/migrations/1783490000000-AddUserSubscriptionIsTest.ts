import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Marks subscriptions bought in a test environment (App Store sandbox / TestFlight via
 * RevenueCat, Stripe test mode) so they're left out of revenue and paying-subscriber figures.
 */
export class AddUserSubscriptionIsTest1783490000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('user_subscriptions', 'isTest')) return;
    await queryRunner.query(
      'ALTER TABLE `user_subscriptions` ADD `isTest` tinyint NOT NULL DEFAULT 0'
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('user_subscriptions', 'isTest')) {
      await queryRunner.query('ALTER TABLE `user_subscriptions` DROP COLUMN `isTest`');
    }
  }
}
