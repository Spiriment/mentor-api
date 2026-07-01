import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSupportTickets1781200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE support_tickets (
        id                 VARCHAR(36) NOT NULL PRIMARY KEY,
        subject            VARCHAR(255) NOT NULL,
        userId             VARCHAR(36) NULL,
        userName           VARCHAR(255) NOT NULL,
        userEmail          VARCHAR(255) NOT NULL,
        linkedMentorId     VARCHAR(36) NULL,
        linkedMentorName   VARCHAR(255) NULL,
        type               VARCHAR(64) NOT NULL DEFAULT 'other',
        priority           VARCHAR(32) NOT NULL DEFAULT 'medium',
        status             VARCHAR(32) NOT NULL DEFAULT 'open',
        createdAt          DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt          DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        INDEX idx_support_tickets_user (userId),
        INDEX idx_support_tickets_status (status),
        INDEX idx_support_tickets_priority (priority),
        CONSTRAINT fk_support_tickets_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL,
        CONSTRAINT fk_support_tickets_mentor FOREIGN KEY (linkedMentorId) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await queryRunner.query(`
      CREATE TABLE support_ticket_messages (
        id                 VARCHAR(36) NOT NULL PRIMARY KEY,
        ticketId           VARCHAR(36) NOT NULL,
        authorName         VARCHAR(255) NOT NULL,
        adminUserId        VARCHAR(36) NULL,
        text               TEXT NOT NULL,
        isInternal         TINYINT(1) NOT NULL DEFAULT 0,
        createdAt          DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt          DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        INDEX idx_support_ticket_messages_ticket (ticketId),
        CONSTRAINT fk_support_ticket_messages_ticket FOREIGN KEY (ticketId) REFERENCES support_tickets(id) ON DELETE CASCADE,
        CONSTRAINT fk_support_ticket_messages_admin FOREIGN KEY (adminUserId) REFERENCES admin_users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS support_ticket_messages`);
    await queryRunner.query(`DROP TABLE IF EXISTS support_tickets`);
  }
}
