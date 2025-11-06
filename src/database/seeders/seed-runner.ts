import 'reflect-metadata';
import { runSeeder } from 'typeorm-extension';
import UserSeeder from './user.seeder';
import MentorSeeder from './mentor.seeder';
import { AppDataSource } from '@/config/data-source';

const runSeeders = async () => {
  try {
    await AppDataSource.initialize();
    console.log('✅ Data Source has been initialized!');

    // Check if we should drop database (only in development)

    console.log('⚠️  Development mode: Dropping database...');
    await AppDataSource.dropDatabase();
    console.log('✅ Database schema has been dropped.');

    await AppDataSource.synchronize();
    console.log('✅ Database schema has been synchronized.');

    // Run seeders in order
    console.log('\n📦 Running UserSeeder...');
    await runSeeder(AppDataSource, UserSeeder);
    console.log('✅ Users seeded successfully!');

    console.log('\n📦 Running MentorSeeder...');
    await runSeeder(AppDataSource, MentorSeeder);
    console.log('✅ Mentors seeded successfully!');

    console.log('\n🎉 All seeders have been run successfully!');
  } catch (err) {
    console.error(
      '❌ Error during Data Source initialization or seeding:',
      err
    );
    throw err;
  } finally {
    await AppDataSource.destroy();
    console.log('✅ Database connection closed.');
    process.exit();
  }
};

runSeeders();
