import 'reflect-metadata';
import { AppDataSource } from '../src/config/data-source';
import { BlogPost, Faq, ContactMessage } from '../src/database/entities';
import { ContactStatus, ContactType } from '../src/database/entities/contactMessage.entity';

async function seed() {
  try {
    console.log('🌱 Starting temporary seed...');
    await AppDataSource.initialize();
    
    const blogRepo = AppDataSource.getRepository(BlogPost);
    const faqRepo = AppDataSource.getRepository(Faq);
    const contactRepo = AppDataSource.getRepository(ContactMessage);
    
    // 1. Seed FAQs
    console.log('  - Seeding FAQs...');
    await faqRepo.save([
      {
        question: 'How do I apply to be a mentor?',
        answer: 'You can apply by clicking the "Become a Mentor" button on our homepage and filling out the spiritual experience form.',
        category: 'Mentorship',
        sortOrder: 1,
        isPublished: true,
      },
      {
        question: 'Is there a cost for mentees?',
        answer: 'Spiriment offers various tiers, including a free tier for basic mentorship and pro tiers for more frequent sessions.',
        category: 'Membership',
        sortOrder: 2,
        isPublished: true,
      },
      {
        question: 'How long are the mentorship sessions?',
        answer: 'Standard sessions are 60 minutes long, but this can be adjusted based on the mentor\'s availability and preference.',
        category: 'Sessions',
        sortOrder: 3,
        isPublished: true,
      }
    ]);

    // 2. Seed Blog Posts
    console.log('  - Seeding Blog Posts...');
    const adminId = '20bb343a-bcde-4166-8fe7-b5d7d736ecc0'; // Existing admin
    await blogRepo.save([
      {
        title: 'Growing in Your Spiritual Journey',
        slug: 'growing-spiritual-journey',
        content: 'Mentorship is a key component of spiritual growth. In this post, we explore how walking with others can accelerate your understanding of faith...',
        excerpt: 'Discover the power of spiritual mentorship in everyday life.',
        isPublished: true,
        publishedAt: new Date(),
        authorId: adminId,
      },
      {
        title: 'The Art of Listening as a Mentor',
        slug: 'the-art-of-listening',
        content: 'Being a great mentor isn\'t just about talking; it\'s about listening. Here are 5 tips for active listening in your next session...',
        excerpt: 'How to be a better listener for your mentees.',
        isPublished: false,
        authorId: adminId,
      }
    ]);

    // 3. Seed some dummy Contact Messages for the Inbox
    console.log('  - Seeding Contact Messages...');
    await contactRepo.save([
      {
        name: 'John Doe',
        email: 'john@example.com',
        message: 'I would like to partner with your organization for our upcoming youth conference.',
        type: ContactType.PARTNERSHIP,
        partnershipType: 'EVENT',
        status: ContactStatus.UNREAD,
      },
      {
        name: 'Jane Smith',
        email: 'jane@volunteer.org',
        message: 'I have 5 years of experience in graphic design and would love to help with your social media.',
        type: ContactType.VOLUNTEER,
        skill: 'Design',
        status: ContactStatus.UNREAD,
      }
    ]);

    console.log('✅ Seeding complete!');
    await AppDataSource.destroy();
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seed();
