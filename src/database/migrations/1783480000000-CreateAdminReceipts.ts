import { MigrationInterface, QueryRunner } from 'typeorm';

/** Payment receipts issued by the super admin from the admin panel (see AdminReceipt entity). */
export class CreateAdminReceipts1783480000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('admin_receipts')) return;
    await queryRunner.query(`
      CREATE TABLE \`admin_receipts\` (
        \`id\` varchar(36) NOT NULL,
        \`receiptNumber\` varchar(32) NOT NULL,
        \`status\` varchar(16) NOT NULL DEFAULT 'issued',
        \`invoiceId\` varchar(36) NULL,
        \`invoiceNumber\` varchar(32) NULL,
        \`receivedFromName\` varchar(255) NOT NULL,
        \`receivedFromAddress\` text NULL,
        \`receivedFromEmail\` varchar(255) NULL,
        \`paymentDate\` date NOT NULL,
        \`paymentMethod\` varchar(32) NOT NULL,
        \`paymentReference\` varchar(255) NULL,
        \`receivedBy\` varchar(255) NOT NULL,
        \`currency\` varchar(3) NOT NULL DEFAULT 'EUR',
        \`lineItems\` json NOT NULL,
        \`vatRate\` decimal(5,2) NULL,
        \`subtotalCents\` int NOT NULL DEFAULT 0,
        \`vatCents\` int NOT NULL DEFAULT 0,
        \`totalCents\` int NOT NULL DEFAULT 0,
        \`notes\` text NULL,
        \`voidedAt\` datetime NULL,
        \`createdByAdminId\` varchar(36) NOT NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`UQ_admin_receipts_number\` (\`receiptNumber\`),
        INDEX \`IDX_admin_receipts_invoice\` (\`invoiceId\`),
        INDEX \`IDX_admin_receipts_status_created\` (\`status\`, \`createdAt\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `admin_receipts`');
  }
}
