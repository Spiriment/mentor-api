import { AppDataSource } from '../src/config/data-source';

async function addTimezoneColumn() {
  try {
    console.log('🔄 Initializing database connection...');
    await AppDataSource.initialize();

    const queryRunner = AppDataSource.createQueryRunner();

    // Check if timezone column exists
    const timezoneExists = await queryRunner.query(
      `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'users' 
       AND COLUMN_NAME = 'timezone'`
    );

    if (timezoneExists[0].count === 0) {
      console.log('➕ Adding timezone column...');
      await queryRunner.query(
        `ALTER TABLE \`users\` ADD \`timezone\` varchar(255) NOT NULL DEFAULT 'UTC'`
      );
      console.log('✅ timezone column added');
    } else {
      console.log('ℹ️  timezone column already exists');
    }

    // Check if streakFreezeCount column exists
    const freezeCountExists = await queryRunner.query(
      `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'users' 
       AND COLUMN_NAME = 'streakFreezeCount'`
    );

    if (freezeCountExists[0].count === 0) {
      console.log('➕ Adding streakFreezeCount column...');
      await queryRunner.query(
        `ALTER TABLE \`users\` ADD \`streakFreezeCount\` int NOT NULL DEFAULT 0`
      );
      console.log('✅ streakFreezeCount column added');
    } else {
      console.log('ℹ️  streakFreezeCount column already exists');
    }

    // Check if monthlyStreakData column exists
    const monthlyDataExists = await queryRunner.query(
      `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'users' 
       AND COLUMN_NAME = 'monthlyStreakData'`
    );

    if (monthlyDataExists[0].count === 0) {
      console.log('➕ Adding monthlyStreakData column...');
      await queryRunner.query(
        `ALTER TABLE \`users\` ADD \`monthlyStreakData\` json NULL`
      );
      console.log('✅ monthlyStreakData column added');
    } else {
      console.log('ℹ️  monthlyStreakData column already exists');
    }

    await queryRunner.release();
    await AppDataSource.destroy();
    console.log('✅ Done!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

addTimezoneColumn();

