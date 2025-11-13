#!/usr/bin/env node

const { AppDataSource } = require('../dist/config/data-source');

async function createAppNotificationsTable() {
  try {
    console.log('🔄 Initializing database connection...');
    await AppDataSource.initialize();

    console.log('📋 Creating app_notifications table...');
    
    const driver = AppDataSource.driver;
    const connection = driver.createConnection();
    
    // Check if table already exists using raw connection
    const [rows] = await connection.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() 
      AND table_name = 'app_notifications'
    `);
    
    if (rows[0].count > 0) {
      console.log('✅ Table app_notifications already exists');
      await connection.end();
      await AppDataSource.destroy();
      return;
    }

    // Create the table using raw connection (using regular string to avoid template literal issues)
    const createTableSQL = "CREATE TABLE `app_notifications` (" +
      "`id` varchar(36) NOT NULL, " +
      "`userId` varchar(36) NOT NULL, " +
      "`type` enum('session_request','session_confirmed','session_rescheduled','session_declined','session_reminder','message','system') NOT NULL DEFAULT 'system', " +
      "`title` varchar(255) NOT NULL, " +
      "`message` text NOT NULL, " +
      "`isRead` tinyint NOT NULL DEFAULT 0, " +
      "`readAt` datetime NULL, " +
      "`data` json NULL, " +
      "`createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), " +
      "`updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), " +
      "PRIMARY KEY (`id`), " +
      "INDEX `IDX_app_notifications_userId` (`userId`), " +
      "INDEX `IDX_app_notifications_type` (`type`), " +
      "INDEX `IDX_app_notifications_isRead` (`isRead`), " +
      "INDEX `IDX_app_notifications_createdAt` (`createdAt`), " +
      "CONSTRAINT `FK_app_notifications_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE" +
      ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
    
    await connection.query(createTableSQL);

    // Mark the migration as executed
    await connection.query(`
      INSERT INTO migrations (timestamp, name)
      VALUES (1762788773000, 'CreateAppNotificationsTable1762788773000')
      ON DUPLICATE KEY UPDATE name = name
    `);
    
    await connection.end();
    
    console.log('✅ app_notifications table created successfully!');
    console.log('✅ Migration marked as executed');

    await AppDataSource.destroy();
    console.log('🔌 Database connection closed');
  } catch (error) {
    console.error('❌ Error creating table:', error.message);
    console.error('Full error:', error);
    if (error.message.includes('already exists')) {
      console.log('ℹ️  Table already exists, marking migration as executed...');
      try {
        const manager = AppDataSource.manager;
        await manager.query(`
          INSERT INTO migrations (timestamp, name)
          VALUES (1762788773000, 'CreateAppNotificationsTable1762788773000')
          ON DUPLICATE KEY UPDATE name = name
        `);
        console.log('✅ Migration marked as executed');
        await AppDataSource.destroy();
      } catch (markError) {
        console.error('❌ Error marking migration:', markError.message);
        process.exit(1);
      }
    } else {
      process.exit(1);
    }
  }
}

createAppNotificationsTable();

