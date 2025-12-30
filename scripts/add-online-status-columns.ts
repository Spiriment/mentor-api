import { AppDataSource } from '../src/config/data-source';

async function addColumns() {
  try {
    await AppDataSource.initialize();
    console.log('✅ Database connected');

    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();

    // Check if columns already exist
    const table = await queryRunner.getTable('conversation_participants');
    const hasIsOnline = table?.findColumnByName('isOnline');
    const hasLastSeen = table?.findColumnByName('lastSeen');

    if (hasIsOnline && hasLastSeen) {
      console.log('✅ Columns already exist');
      await queryRunner.release();
      await AppDataSource.destroy();
      return;
    }

    // Add columns
    if (!hasIsOnline) {
      await queryRunner.query(`
        ALTER TABLE \`conversation_participants\` 
        ADD COLUMN \`isOnline\` tinyint NOT NULL DEFAULT 0
      `);
      console.log('✅ Added isOnline column');
    }

    if (!hasLastSeen) {
      await queryRunner.query(`
        ALTER TABLE \`conversation_participants\` 
        ADD COLUMN \`lastSeen\` datetime NULL
      `);
      console.log('✅ Added lastSeen column');
    }

    await queryRunner.release();
    await AppDataSource.destroy();
    console.log('✅ Done!');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

addColumns();

