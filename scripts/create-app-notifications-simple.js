#!/usr/bin/env node

const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.development' });

async function createTable() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USERNAME || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'mentor_app',
    });

    console.log('🔄 Connected to database');

    // Check if table exists
    const [tables] = await connection.execute(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = ? 
      AND table_name = 'app_notifications'
    `, [process.env.DB_NAME || 'mentor_app']);

    if (tables[0].count > 0) {
      console.log('✅ Table app_notifications already exists');
      await connection.end();
      return;
    }

    console.log('📋 Creating app_notifications table...');

    // Create the table
    await connection.execute(`
      CREATE TABLE app_notifications (
        id varchar(36) NOT NULL,
        userId varchar(36) NOT NULL,
        \`type\` enum('session_request','session_confirmed','session_rescheduled','session_declined','session_reminder','message','system') NOT NULL DEFAULT 'system',
        title varchar(255) NOT NULL,
        message text NOT NULL,
        isRead tinyint NOT NULL DEFAULT 0,
        readAt datetime NULL,
        data json NULL,
        createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        INDEX IDX_app_notifications_userId (userId),
        INDEX IDX_app_notifications_type (\`type\`),
        INDEX IDX_app_notifications_isRead (isRead),
        INDEX IDX_app_notifications_createdAt (createdAt),
        CONSTRAINT FK_app_notifications_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Mark migration as executed
    await connection.execute(`
      INSERT INTO migrations (timestamp, name)
      VALUES (?, ?)
      ON DUPLICATE KEY UPDATE name = name
    `, [1762788773000, 'CreateAppNotificationsTable1762788773000']);

    console.log('✅ app_notifications table created successfully!');
    console.log('✅ Migration marked as executed');

    await connection.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('already exists')) {
      console.log('ℹ️  Table already exists');
    }
    if (connection) {
      await connection.end();
    }
    process.exit(1);
  }
}

createTable();

