import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserDiscountsTable1770500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`user_discounts\` (
        \`id\` varchar(36) NOT NULL,
        \`userId\` varchar(36) NOT NULL,
        \`discountType\` varchar(16) NOT NULL,
        \`value\` decimal(10,2) NOT NULL,
        \`label\` varchar(255) NULL,
        \`validFrom\` datetime(6) NULL,
        \`validUntil\` datetime(6) NULL,
        \`createdByAdminId\` varchar(36) NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        INDEX \`IDX_user_discounts_userId\` (\`userId\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`user_discounts\``);
  }
}
