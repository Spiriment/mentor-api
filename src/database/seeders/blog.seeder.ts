import { AppDataSource } from '../../config/data-source';
import { BlogPost } from '../entities/blogPost.entity';

const seededBlogs: Array<{
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string;
}> = [
  {
    title: 'How to Prepare for Your First Mentorship Session',
    slug: 'how-to-prepare-for-your-first-mentorship-session',
    excerpt:
      'Practical steps to help mentees come into their first Spiriment mentorship session with clarity and confidence.',
    content:
      'Starting mentorship can feel exciting and uncertain at the same time. Before your first session, define one or two key growth goals, note down specific questions, and review your mentor profile match. Bring honest context about your current season so your mentor can guide you effectively. A strong first session usually focuses on alignment: expectations, communication rhythm, prayer focus, and next steps for the week. Keep your goals realistic and measurable, and follow through on agreed action points after the session.',
    coverImage:
      'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1600&q=80',
  },
  {
    title: 'What Great Christian Mentors Do Consistently',
    slug: 'what-great-christian-mentors-do-consistently',
    excerpt:
      'A quick framework for mentors who want to lead with wisdom, structure, and compassion.',
    content:
      'Effective Christian mentors combine spiritual maturity with practical consistency. They listen deeply, ask purposeful questions, and point mentees back to Scripture and obedience. They also keep clear boundaries, respect time commitments, and document progress across sessions. On Spiriment, great mentors review mentee context before meetings, set clear action points, and follow up with encouragement. Consistency builds trust, and trust creates space for transformation.',
    coverImage:
      'https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=1600&q=80',
  },
  {
    title: 'Building a Sustainable Mentoring Rhythm',
    slug: 'building-a-sustainable-mentoring-rhythm',
    excerpt:
      'How mentors and mentees can avoid burnout by setting a healthy session rhythm from day one.',
    content:
      'Mentorship works best when both sides choose a sustainable pace. Weekly sessions may be ideal during intense growth periods, while biweekly sessions often work for long-term discipleship. Define meeting cadence, communication channels, and response expectations early. Use session recaps to track commitments, and adjust frequency when life seasons shift. A sustainable rhythm prevents burnout while maintaining momentum and accountability.',
    coverImage:
      'https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=1600&q=80',
  },
  {
    title: 'Using Church Portal to Support Member Growth',
    slug: 'using-church-portal-to-support-member-growth',
    excerpt:
      'How church leaders can use Church Portal insights to guide healthier discipleship outcomes.',
    content:
      'Church Portal helps leaders move from guesswork to intentional support. By reviewing activity trends, assignment completion, and mentorship participation, pastors can identify members who need encouragement or closer follow-up. Create clear owner roles for outreach, maintain consistent check-ins, and use data as a pastoral tool rather than a performance scorecard. The goal is simple: shepherd people well and early.',
    coverImage:
      'https://images.unsplash.com/photo-1438232992991-995b7058bbb3?auto=format&fit=crop&w=1600&q=80',
  },
  {
    title: 'How to Improve Mentor-Mentee Matching Quality',
    slug: 'how-to-improve-mentor-mentee-matching-quality',
    excerpt:
      'Better profile clarity leads to better mentor-mentee fit and stronger outcomes.',
    content:
      'Matching quality improves when profiles are clear and specific. Mentees should state real growth needs, preferred mentoring style, and scheduling constraints. Mentors should define expertise areas, communication approach, and capacity. Encourage both sides to treat profile completion as ministry preparation, not admin work. Better upfront detail reduces mismatch, improves retention, and increases meaningful progress over time.',
    coverImage:
      'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1600&q=80',
  },
];

async function seedBlogs() {
  console.log('🚀 Connecting to database...');
  await AppDataSource.initialize();
  
  const repo = AppDataSource.getRepository(BlogPost);

  // Remove obvious Latin/faker-style placeholders created by old seed logic.
  await repo
    .createQueryBuilder()
    .delete()
    .from(BlogPost)
    .where('coverImage LIKE :picsum', { picsum: 'https://picsum.photos/%' })
    .orWhere(
      "LOWER(title) REGEXP :latin OR LOWER(excerpt) REGEXP :latin OR LOWER(content) REGEXP :latin",
      { latin: 'lorem|ipsum|dolor|amet|consectetur|adipiscing' }
    )
    .execute();

  console.log(`📦 Seeding ${seededBlogs.length} blog posts...`);

  for (const item of seededBlogs) {
    const existingPost = await repo.findOne({
      where: { slug: item.slug },
    });

    if (existingPost) {
      existingPost.title = item.title;
      existingPost.excerpt = item.excerpt;
      existingPost.content = item.content;
      existingPost.coverImage = item.coverImage;
      existingPost.isPublished = true;
      existingPost.publishedAt = existingPost.publishedAt ?? new Date();
      await repo.save(existingPost);
      continue;
    }

    const post = repo.create({
      title: item.title,
      slug: item.slug,
      content: item.content,
      excerpt: item.excerpt,
      coverImage: item.coverImage,
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
