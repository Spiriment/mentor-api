import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStripeAndPromoCodes1780300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Older MySQL versions don't support `ADD COLUMN IF NOT EXISTS`,
    // so we conditionally add the column via INFORMATION_SCHEMA.
    const [{ db }] = await queryRunner.query(`SELECT DATABASE() as db`);

    const columnExists = async (tableName: string, columnName: string) => {
      const rows = await queryRunner.query(
        `
          SELECT COUNT(*) as count
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = ?
            AND TABLE_NAME = ?
            AND COLUMN_NAME = ?
        `,
        [db, tableName, columnName],
      );

      return Number(rows[0]?.count) > 0;
    };

    if (!(await columnExists('users', 'stripeCustomerId'))) {
      await queryRunner.query(
        `ALTER TABLE \`users\` ADD COLUMN \`stripeCustomerId\` varchar(64) NULL`,
      );
    }

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`promo_codes\` (
        \`id\` varchar(36) NOT NULL,
        \`code\` varchar(64) NOT NULL,
        \`type\` enum('ambassador','internal_test') NOT NULL DEFAULT 'ambassador',
        \`discountPercent\` int NOT NULL DEFAULT 20,
        \`tier\` varchar(24) NOT NULL DEFAULT 'premium',
        \`usageLimit\` int NULL,
        \`usedCount\` int NOT NULL DEFAULT 0,
        \`expiresAt\` datetime NULL,
        \`isActive\` tinyint(1) NOT NULL DEFAULT 1,
        \`notes\` varchar(500) NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`UQ_promo_codes_code\` (\`code\`),
        INDEX \`IDX_promo_codes_type_isActive\` (\`type\`, \`isActive\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);

    // Track which user redeemed which promo code
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`promo_code_redemptions\` (
        \`id\` varchar(36) NOT NULL,
        \`promoCodeId\` varchar(36) NOT NULL,
        \`userId\` varchar(36) NOT NULL,
        \`redeemedAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`stripeCouponId\` varchar(128) NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`UQ_redemption_user\` (\`userId\`),
        INDEX \`IDX_redemption_promoCode\` (\`promoCodeId\`)
      ) ENGINE=InnoDB
    `);

    // Update currency default to EUR on user_subscriptions
    await queryRunner.query(`
      ALTER TABLE \`user_subscriptions\`
        MODIFY COLUMN \`currency\` varchar(8) NOT NULL DEFAULT 'EUR'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`promo_code_redemptions\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`promo_codes\``);

    // Mirror the `up` logic to avoid `DROP COLUMN IF EXISTS` incompatibilities.
    const [{ db }] = await queryRunner.query(`SELECT DATABASE() as db`);
    const rows = await queryRunner.query(
      `
        SELECT COUNT(*) as count
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = ?
          AND TABLE_NAME = ?
          AND COLUMN_NAME = ?
      `,
      [db, 'users', 'stripeCustomerId'],
    );

    if (Number(rows[0]?.count) > 0) {
      await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`stripeCustomerId\``);
    }
  }
}
