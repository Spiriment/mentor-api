import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSupportTickets1781200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasSupportTickets = await queryRunner.hasTable('support_tickets');
    if (!hasSupportTickets) {
      // No FK to users/admin_users: production users.id charset/collation can differ
      // from new tables and cause errno 150 on shared hosting. Indexes preserve query
      // performance; referential integrity is enforced in application code.
      await queryRunner.query(`
        CREATE TABLE \`support_tickets\` (
          \`id\` varchar(36) NOT NULL,
          \`subject\` varchar(255) NOT NULL,
          \`userId\` varchar(36) NULL,
          \`userName\` varchar(255) NOT NULL,
          \`userEmail\` varchar(255) NOT NULL,
          \`linkedMentorId\` varchar(36) NULL,
          \`linkedMentorName\` varchar(255) NULL,
          \`type\` varchar(64) NOT NULL DEFAULT 'other',
          \`priority\` varchar(32) NOT NULL DEFAULT 'medium',
          \`status\` varchar(32) NOT NULL DEFAULT 'open',
          \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
          INDEX \`idx_support_tickets_user\` (\`userId\`),
          INDEX \`idx_support_tickets_status\` (\`status\`),
          INDEX \`idx_support_tickets_priority\` (\`priority\`),
          PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB
      `);
    }

    const hasSupportTicketMessages = await queryRunner.hasTable('support_ticket_messages');
    if (!hasSupportTicketMessages) {
      await queryRunner.query(`
        CREATE TABLE \`support_ticket_messages\` (
          \`id\` varchar(36) NOT NULL,
          \`ticketId\` varchar(36) NOT NULL,
          \`authorName\` varchar(255) NOT NULL,
          \`adminUserId\` varchar(36) NULL,
          \`text\` text NOT NULL,
          \`isInternal\` tinyint(1) NOT NULL DEFAULT 0,
          \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
          INDEX \`idx_support_ticket_messages_ticket\` (\`ticketId\`),
          PRIMARY KEY (\`id\`),
          CONSTRAINT \`fk_support_ticket_messages_ticket\` FOREIGN KEY (\`ticketId\`) REFERENCES \`support_tickets\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
        ) ENGINE=InnoDB
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`support_ticket_messages\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`support_tickets\``);
  }
}
