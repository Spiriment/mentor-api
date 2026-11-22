import { MigrationInterface, QueryRunner } from 'typeorm';

/** General invoices issued by the super admin from the admin panel (see AdminInvoice entity). */
export class CreateAdminInvoices1783470000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('admin_invoices')) return;
    await queryRunner.query(`
      CREATE TABLE \`admin_invoices\` (
        \`id\` varchar(36) NOT NULL,
        \`invoiceNumber\` varchar(32) NULL,
        \`status\` varchar(16) NOT NULL DEFAULT 'draft',
        \`billedToName\` varchar(255) NOT NULL,
        \`billedToAddress\` text NULL,
        \`billedToEmail\` varchar(255) NULL,
        \`issueDate\` date NOT NULL,
        \`dueDate\` date NOT NULL,
        \`currency\` varchar(3) NOT NULL DEFAULT 'EUR',
        \`lineItems\` json NOT NULL,
        \`vatRate\` decimal(5,2) NULL,
        \`subtotalCents\` int NOT NULL DEFAULT 0,
        \`vatCents\` int NOT NULL DEFAULT 0,
        \`totalCents\` int NOT NULL DEFAULT 0,
        \`notes\` text NULL,
        \`issuedAt\` datetime NULL,
        \`paidAt\` datetime NULL,
        \`voidedAt\` datetime NULL,
        \`createdByAdminId\` varchar(36) NOT NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`UQ_admin_invoices_number\` (\`invoiceNumber\`),
        INDEX \`IDX_admin_invoices_status_created\` (\`status\`, \`createdAt\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `admin_invoices`');
  }
}
