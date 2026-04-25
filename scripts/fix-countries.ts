import { AppDataSource } from '../src/config/data-source';
import { User } from '../src/database/entities/user.entity';
import { faker } from '@faker-js/faker';

async function fixCountries() {
  console.log('🚀 Connecting to database...');
  await AppDataSource.initialize();
  
  const repo = AppDataSource.getRepository(User);
  const users = await repo.find();
  
  let updatedCount = 0;
  
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    if (!user.country) {
      user.country = faker.location.country();
      updatedCount++;
    }
  }
  
  if (updatedCount > 0) {
    await repo.save(users);
    console.log(`✅ Fixed countries for ${updatedCount} users.`);
  } else {
    console.log('ℹ️ All users already have countries.');
  }
  
  await AppDataSource.destroy();
}

fixCountries().catch(err => {
  console.error('❌ Error fixing countries:', err);
  process.exit(1);
});
