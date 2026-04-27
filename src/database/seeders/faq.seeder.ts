import { AppDataSource } from '../../config/data-source';
import { Faq } from '../entities/faq.entity';

const seededFaqs: Array<{
  question: string;
  answer: string;
  category: string;
}> = [
  {
    question: 'What is Spiriment and who is it for?',
    answer:
      'Spiriment is a Christian mentoring platform designed to connect mentees with trusted mentors for spiritual growth, accountability, and practical discipleship.',
    category: 'General',
  },
  {
    question: 'How do I get matched with a mentor?',
    answer:
      'After completing your profile and goals, the platform suggests mentors based on your preferences, availability, and growth areas. You can then send a mentorship request.',
    category: 'Mentees',
  },
  {
    question: 'Can I choose my mentor manually?',
    answer:
      'Yes. You can browse available mentors, review their profiles, and send a request to the mentor you feel is the best fit for your journey.',
    category: 'Mentees',
  },
  {
    question: 'How long is a typical mentoring session?',
    answer:
      'Most sessions are 45 to 60 minutes, depending on what the mentor offers and what you agree on during scheduling.',
    category: 'General',
  },
  {
    question: 'How do I become a mentor on Spiriment?',
    answer:
      'You can apply through the mentor onboarding flow, submit your background and testimony, and wait for approval by the admin team before taking mentees.',
    category: 'Mentors',
  },
  {
    question: 'How are mentors verified before approval?',
    answer:
      'Mentor applications are reviewed by admins, including profile quality, ministry experience, and overall readiness to serve mentees responsibly.',
    category: 'Mentors',
  },
  {
    question: 'Can mentors manage their own schedules?',
    answer:
      'Yes. Mentors can set availability windows, update time slots, and manage confirmed sessions from their dashboard.',
    category: 'Mentors',
  },
  {
    question: 'What happens if I miss a session?',
    answer:
      'Missed sessions are tracked in your account history. You can reschedule with your mentor where applicable, and repeated no-shows may affect future bookings.',
    category: 'General',
  },
  {
    question: 'What subscription plans are available?',
    answer:
      'Spiriment offers plan tiers for individual users and organizations, with features and seat limits that vary by plan type.',
    category: 'Subscriptions',
  },
  {
    question: 'Can I cancel or change my subscription anytime?',
    answer:
      'Yes. You can upgrade, downgrade, or cancel from your billing area. Changes take effect based on your current billing cycle and plan rules.',
    category: 'Subscriptions',
  },
  {
    question: 'How do church organizations use the Church Portal?',
    answer:
      'Church Portal accounts let church leaders manage members, track engagement activity, and oversee mentorship participation in one place.',
    category: 'General',
  },
  {
    question: 'How do Church Portal team invites work?',
    answer:
      'Admins invite team members by email. Invitees receive a secure link to set a password and activate their Church Portal account.',
    category: 'General',
  },
  {
    question: 'I forgot my password. How do I reset it?',
    answer:
      'Use the forgot password option on the login page. A reset link will be sent to your email if your account exists.',
    category: 'Technical',
  },
  {
    question: 'Why am I not receiving email notifications?',
    answer:
      'First, check spam or promotions folders and confirm your email address is correct. Also review your notification preferences in account settings.',
    category: 'Technical',
  },
  {
    question: 'Is my personal data secure on the platform?',
    answer:
      'Yes. Spiriment uses authentication controls, secure token handling, and access restrictions to protect user accounts and sensitive data.',
    category: 'Technical',
  },
];

async function seedFaqs() {
  console.log('🚀 Connecting to database...');
  await AppDataSource.initialize();
  
  const repo = AppDataSource.getRepository(Faq);
  
  console.log(`📦 Seeding ${seededFaqs.length} FAQs...`);

  for (let i = 0; i < seededFaqs.length; i++) {
    const item = seededFaqs[i];
    const existingFaq = await repo.findOne({
      where: { question: item.question },
    });

    if (existingFaq) {
      existingFaq.answer = item.answer;
      existingFaq.category = item.category;
      existingFaq.isPublished = true;
      existingFaq.sortOrder = i;
      await repo.save(existingFaq);
      continue;
    }

    const faq = repo.create({
      question: item.question,
      answer: item.answer,
      category: item.category,
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
