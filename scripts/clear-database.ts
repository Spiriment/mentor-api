import { AppDataSource } from '../src/config/data-source';
import { Logger } from '../src/common';

const logger = new Logger({
  service: 'clear-database',
  level: process.env.LOG_LEVEL || 'info',
});

async function clearDatabase() {
  try {
    logger.info('Initializing database connection...');
    await AppDataSource.initialize();

    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();

    logger.info('Disabling foreign key checks...');
    await queryRunner.query('SET FOREIGN_KEY_CHECKS = 0');

    // Get all table names
    const tables = await queryRunner.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_TYPE = 'BASE TABLE'
      AND TABLE_NAME != 'migrations'
    `);

    logger.info(`Found ${tables.length} tables to clear`);

    // Truncate all tables (preserves structure, deletes data)
    for (const table of tables) {
      const tableName = table.TABLE_NAME;
      try {
        logger.info(`Truncating table: ${tableName}`);
        await queryRunner.query(`TRUNCATE TABLE \`${tableName}\``);
      } catch (error: any) {
        logger.warn(`Failed to truncate ${tableName}:`, error.message);
        // Try DELETE instead if TRUNCATE fails
        try {
          await queryRunner.query(`DELETE FROM \`${tableName}\``);
          logger.info(`Deleted from ${tableName} instead`);
        } catch (deleteError: any) {
          logger.error(`Failed to delete from ${tableName}:`, deleteError.message);
        }
      }
    }

    logger.info('Re-enabling foreign key checks...');
    await queryRunner.query('SET FOREIGN_KEY_CHECKS = 1');

    await queryRunner.release();

    logger.info('✅ Database cleared successfully!');
    logger.info('All user data has been removed. You can now reuse email addresses for testing.');

    await AppDataSource.destroy();
    process.exit(0);
  } catch (error: any) {
    logger.error('Error clearing database:', error);
    process.exit(1);
  }
}

clearDatabase();

