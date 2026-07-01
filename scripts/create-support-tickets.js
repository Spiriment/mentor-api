#!/usr/bin/env node

const mysql = require('mysql2/promise');
const path = require('path');

const envFile =
  process.env.NODE_ENV === 'production'
    ? '.env.production'
    : process.env.NODE_ENV === 'staging'
      ? '.env.staging'
      : '.env.development';

require('dotenv').config({ path: path.resolve(process.cwd(), envFile) });

async function createSupportTables() {
  let connection;

  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      user: process.env.DB_USERNAME || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'mentor_app',
    });

    console.log(`Connected to ${process.env.DB_NAME}`);

    const [tables] = await connection.execute(
      `SELECT COUNT(*) AS count
       FROM information_schema.tables
       WHERE table_schema = ?
         AND table_name = 'support_tickets'`,
      [process.env.DB_NAME]
    );

    if (tables[0].count === 0) {
      console.log('Creating support_tickets...');
      await connection.execute(`
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
    } else {
      console.log('support_tickets already exists');
    }

    const [messageTables] = await connection.execute(
      `SELECT COUNT(*) AS count
       FROM information_schema.tables
       WHERE table_schema = ?
         AND table_name = 'support_ticket_messages'`,
      [process.env.DB_NAME]
    );

    if (messageTables[0].count === 0) {
      console.log('Creating support_ticket_messages...');
      await connection.execute(`
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
    } else {
      console.log('support_ticket_messages already exists');
    }

    await connection.execute(
      `INSERT INTO migrations (timestamp, name)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE name = name`,
      [1781200000000, 'CreateSupportTickets1781200000000']
    );

    console.log('Support ticket tables ready. Migration marked as executed.');
  } catch (error) {
    console.error('Failed:', error.message);
    process.exitCode = 1;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

createSupportTables();
