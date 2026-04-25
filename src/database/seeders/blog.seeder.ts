import { AppDataSource } from '../../config/data-source';
import { BlogPost } from '../entities/blogPost.entity';
import { faker } from '@faker-js/faker';

async function seedBlogs() {
  console.log('🚀 Connecting to database...');
  await AppDataSource.initialize();
  
  const repo = AppDataSource.getRepository(BlogPost);
  
  console.log('📦 Seeding 10 blog posts...');
  
  for (let i = 0; i < 10; i++) {
    const title = faker.lorem.sentence(6);
    const post = repo.create({
      title,
      slug: title.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, ''),
      content: faker.lorem.paragraphs(5),
      excerpt: faker.lorem.paragraph(),
      coverImage: `https://picsum.photos/seed/${faker.string.uuid()}/800/400`,
      isPublished: true,
      publishedAt: new Date(),
    });
    await repo.save(post);
  }
  
  console.log('✅ Blogs seeded successfully!');
  await AppDataSource.destroy();
}

seedBlogs().catch(err => {
  console.error('❌ Error seeding blogs:', err);
  process.exit(1);
});
