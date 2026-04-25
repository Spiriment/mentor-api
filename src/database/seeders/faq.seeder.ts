import { AppDataSource } from '../../config/data-source';
import { Faq } from '../entities/faq.entity';
import { faker } from '@faker-js/faker';

async function seedFaqs() {
  console.log('🚀 Connecting to database...');
  await AppDataSource.initialize();
  
  const repo = AppDataSource.getRepository(Faq);
  
  console.log('📦 Seeding 15 FAQs...');
  
  const categories = ['General', 'Subscriptions', 'Mentors', 'Mentees', 'Technical'];
  
  for (let i = 0; i < 15; i++) {
    const faq = repo.create({
      question: faker.lorem.sentence() + '?',
      answer: faker.lorem.paragraph(),
      category: faker.helpers.arrayElement(categories),
      isPublished: true,
      sortOrder: i,
    });
    await repo.save(faq);
  }
  
  console.log('✅ FAQs seeded successfully!');
  await AppDataSource.destroy();
}

seedFaqs().catch(err => {
  console.error('❌ Error seeding FAQs:', err);
  process.exit(1);
});
