import { AppDataSource } from '../src/config/data-source';
import { User } from '../src/database/entities/user.entity';
import { USER_ROLE, MENTOR_APPROVAL_STATUS } from '../src/common/constants';

async function fixRoles() {
  console.log('🚀 Connecting to database...');
  await AppDataSource.initialize();
  
  const repo = AppDataSource.getRepository(User);
  const users = await repo.find();
  
  let updatedCount = 0;
  
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    if (!user.role) {
      const isMentor = i % 10 === 0;
      user.role = isMentor ? USER_ROLE.MENTOR : USER_ROLE.MENTEE;
      if (isMentor) {
        user.mentorApprovalStatus = MENTOR_APPROVAL_STATUS.APPROVED;
        user.mentorApprovedAt = new Date();
      }
      updatedCount++;
    }
  }
  
  if (updatedCount > 0) {
    await repo.save(users);
    console.log(`✅ Fixed roles for ${updatedCount} users.`);
  } else {
    console.log('ℹ️ All users already have roles.');
  }
  
  await AppDataSource.destroy();
}

fixRoles().catch(err => {
  console.error('❌ Error fixing roles:', err);
  process.exit(1);
});
