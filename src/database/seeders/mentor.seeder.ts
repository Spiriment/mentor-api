import { AppDataSource } from '../../config/data-source';
import { User } from '../entities/user.entity';
import { MentorProfile } from '../entities/mentorProfile.entity';
import { GENDER, ACCOUNT_STATUS } from '@/common/constants/options';
import bcrypt from 'bcryptjs';

const mentors = [
  {
    user: {
      firstName: 'Pastor',
      lastName: 'Johnson',
      email: 'pastor.johnson@example.com',
      password: 'password123',
      gender: GENDER.MALE,
      accountStatus: ACCOUNT_STATUS.ACTIVE,
      isEmailVerified: true,
    },
    profile: {
      christianExperience: 'Senior Pastor with 15+ years of experience leading congregations and mentoring young leaders',
      christianJourney: 'I gave my life to Christ at age 18 during a college revival. After serving in various ministry roles, I was called to pastoral ministry. I\'ve been blessed to lead two churches and have mentored over 50 young ministers and leaders. My passion is helping believers discover their calling and develop spiritual maturity.',
      scriptureTeaching: 'I specialize in expository preaching and systematic Bible study. I believe in teaching the Word verse by verse to help believers understand the full counsel of God.',
      currentMentoring: 'Currently mentoring 8 young ministers and 5 church leaders. I also lead a monthly pastor\'s fellowship in our city.',
      churchAffiliation: 'First Baptist Church of Springfield',
      leadershipRoles: 'Senior Pastor, Board Member of City Ministerial Alliance, Director of Leadership Development Program',
      maturityDefinition: 'Spiritual maturity is evidenced by consistent fruit of the Spirit, faithful service to others, and a growing love for God\'s Word and His people. It\'s marked by humility, teachability, and a heart for discipleship.',
      menteeCapacity: '5-8 mentees',
      mentorshipFormat: ['One-on-one meetings', 'Group discipleship', 'Ministry shadowing', 'Monthly check-ins'],
      menteeCalling: ['Pastoral ministry', 'Church leadership', 'Youth ministry', 'Missions'],
      videoIntroduction: 'https://example.com/videos/pastor-johnson-intro.mp4',
      profileImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face',
      isOnboardingComplete: true,
      onboardingStep: 'completed',
      isApproved: true,
      approvalNotes: 'Excellent credentials and extensive mentoring experience. Highly recommended.',
      approvedAt: new Date(),
    },
  },
  {
    user: {
      firstName: 'Dr. Sarah',
      lastName: 'Williams',
      email: 'dr.sarah.williams@example.com',
      password: 'password123',
      gender: GENDER.FEMALE,
      accountStatus: ACCOUNT_STATUS.ACTIVE,
      isEmailVerified: true,
    },
    profile: {
      christianExperience: 'Theology Professor and Women\'s Ministry Director with 12+ years of experience',
      christianJourney: 'I came to faith during my undergraduate studies and felt called to theological education. After earning my PhD in Biblical Studies, I began teaching and mentoring women in ministry. I\'ve written several books on women\'s discipleship and biblical interpretation.',
      scriptureTeaching: 'I focus on biblical hermeneutics, Old Testament studies, and women\'s roles in ministry. I help students understand the cultural and historical context of Scripture.',
      currentMentoring: 'Mentoring 6 seminary students and 10 women in ministry leadership roles. I also lead a weekly Bible study for professional women.',
      churchAffiliation: 'Grace Community Church',
      leadershipRoles: 'Professor of Biblical Studies, Director of Women\'s Ministry, Board Member of Christian Education Association',
      maturityDefinition: 'Maturity comes through consistent study of God\'s Word, active participation in Christian community, and a willingness to be corrected and grow. It\'s shown in how we handle trials and serve others.',
      menteeCapacity: '6-10 mentees',
      mentorshipFormat: ['Academic mentoring', 'Small group studies', 'Writing projects', 'Ministry placement'],
      menteeCalling: ['Biblical studies', 'Women\'s ministry', 'Christian education', 'Academic ministry'],
      videoIntroduction: 'https://example.com/videos/dr-sarah-intro.mp4',
      profileImage: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=400&h=400&fit=crop&crop=face',
      isOnboardingComplete: true,
      onboardingStep: 'completed',
      isApproved: true,
      approvalNotes: 'Outstanding academic credentials and proven track record in women\'s discipleship.',
      approvedAt: new Date(),
    },
  },
  {
    user: {
      firstName: 'Elder',
      lastName: 'Rodriguez',
      email: 'elder.rodriguez@example.com',
      password: 'password123',
      gender: GENDER.MALE,
      accountStatus: ACCOUNT_STATUS.ACTIVE,
      isEmailVerified: true,
    },
    profile: {
      christianExperience: 'Church Elder and Business Leader with 20+ years of marketplace ministry experience',
      christianJourney: 'I became a Christian as a young adult while building my business. God called me to use my business skills for His kingdom. I\'ve been an elder for 15 years and have helped plant 3 churches while running my successful construction company.',
      scriptureTeaching: 'I specialize in practical application of biblical principles in business and daily life. I love teaching about stewardship, integrity, and excellence from a Christian perspective.',
      currentMentoring: 'Mentoring 4 young entrepreneurs and 6 church planters. I also lead a monthly men\'s business fellowship.',
      churchAffiliation: 'New Life Community Church',
      leadershipRoles: 'Church Elder, Founder of Christian Business Network, Board Member of Church Planting Initiative',
      maturityDefinition: 'Maturity is demonstrated through faithfulness in small things, integrity in business dealings, and a heart for kingdom expansion. It\'s about being the same person at church, work, and home.',
      menteeCapacity: '4-6 mentees',
      mentorshipFormat: ['Business mentoring', 'Church planting guidance', 'Financial stewardship', 'Leadership development'],
      menteeCalling: ['Business ministry', 'Church planting', 'Leadership development', 'Stewardship'],
      videoIntroduction: 'https://example.com/videos/elder-rodriguez-intro.mp4',
      profileImage: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&crop=face',
      isOnboardingComplete: true,
      onboardingStep: 'completed',
      isApproved: true,
      approvalNotes: 'Strong business background combined with deep spiritual maturity and church planting experience.',
      approvedAt: new Date(),
    },
  },
  {
    user: {
      firstName: 'Sister',
      lastName: 'Thompson',
      email: 'sister.thompson@example.com',
      password: 'password123',
      gender: GENDER.FEMALE,
      accountStatus: ACCOUNT_STATUS.ACTIVE,
      isEmailVerified: true,
    },
    profile: {
      christianExperience: 'Youth Pastor and Worship Leader with 10+ years of experience in youth and worship ministry',
      christianJourney: 'I accepted Christ at age 16 during a youth camp. After college, I felt called to youth ministry and worship leading. I\'ve been serving in youth ministry for 10 years and have seen many young people come to Christ and grow in their faith.',
      scriptureTeaching: 'I focus on making Scripture relevant to young people through creative teaching methods, worship, and practical application. I specialize in youth discipleship and worship theology.',
      currentMentoring: 'Mentoring 8 youth leaders and 12 young worship team members. I also lead a weekly young adult Bible study.',
      churchAffiliation: 'Hope Fellowship Church',
      leadershipRoles: 'Youth Pastor, Worship Director, Coordinator of Young Adult Ministry',
      maturityDefinition: 'Spiritual maturity in young people is shown through consistent quiet times, active service in the church, and a growing heart for evangelism. It\'s about moving from consumer to contributor in the body of Christ.',
      menteeCapacity: '8-12 mentees',
      mentorshipFormat: ['Youth discipleship', 'Worship team training', 'Leadership development', 'Creative ministry'],
      menteeCalling: ['Youth ministry', 'Worship ministry', 'Young adult ministry', 'Creative arts'],
      videoIntroduction: 'https://example.com/videos/sister-thompson-intro.mp4',
      profileImage: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop&crop=face',
      isOnboardingComplete: true,
      onboardingStep: 'completed',
      isApproved: true,
      approvalNotes: 'Excellent track record with youth ministry and strong worship leadership skills.',
      approvedAt: new Date(),
    },
  },
  {
    user: {
      firstName: 'Brother',
      lastName: 'Kim',
      email: 'brother.kim@example.com',
      password: 'password123',
      gender: GENDER.MALE,
      accountStatus: ACCOUNT_STATUS.ACTIVE,
      isEmailVerified: true,
    },
    profile: {
      christianExperience: 'Missionary and Church Planter with 18+ years of cross-cultural ministry experience',
      christianJourney: 'I became a Christian during my college years and felt God\'s call to missions. After seminary, I served as a missionary in Asia for 12 years before returning to plant churches in urban areas. I speak 4 languages and have a heart for reaching the unreached.',
      scriptureTeaching: 'I specialize in missions theology, cross-cultural evangelism, and church planting principles. I teach about God\'s heart for the nations and practical strategies for reaching diverse communities.',
      currentMentoring: 'Mentoring 5 missionary candidates and 7 church planters. I also lead a monthly missions fellowship.',
      churchAffiliation: 'Global Missions Church',
      leadershipRoles: 'Missionary, Church Planter, Director of Missions Training, Board Member of International Missions Board',
      maturityDefinition: 'Missions maturity is demonstrated through a heart for the lost, willingness to sacrifice comfort for the gospel, and ability to adapt to different cultures while maintaining biblical truth.',
      menteeCapacity: '5-7 mentees',
      mentorshipFormat: ['Missions training', 'Cross-cultural ministry', 'Church planting', 'Language learning'],
      menteeCalling: ['Missions', 'Church planting', 'Cross-cultural ministry', 'Urban ministry'],
      videoIntroduction: 'https://example.com/videos/brother-kim-intro.mp4',
      profileImage: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop&crop=face',
      isOnboardingComplete: true,
      onboardingStep: 'completed',
      isApproved: true,
      approvalNotes: 'Extensive missions experience and proven track record in church planting and cross-cultural ministry.',
      approvedAt: new Date(),
    },
  },
];

export async function seedMentors(): Promise<void> {
  try {
    console.log('🌱 Starting mentor seeding...');

    const userRepository = AppDataSource.getRepository(User);
    const mentorProfileRepository = AppDataSource.getRepository(MentorProfile);

    // Check if mentors already exist
    const existingMentors = await mentorProfileRepository.count();
    if (existingMentors > 0) {
      console.log(`✅ ${existingMentors} mentors already exist. Skipping seeding.`);
      return;
    }

    console.log(`📝 Creating ${mentors.length} mentor profiles...`);

    for (const mentorData of mentors) {
      try {
        // Check if user already exists
        const existingUser = await userRepository.findOne({
          where: { email: mentorData.user.email },
        });

        let user: User;
        if (existingUser) {
          console.log(`⚠️  User ${mentorData.user.email} already exists. Skipping.`);
          continue;
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(mentorData.user.password, 12);

        // Create user
        user = userRepository.create({
          ...mentorData.user,
          password: hashedPassword,
          emailVerifiedAt: new Date(),
        });

        await userRepository.save(user);
        console.log(`👤 Created user: ${user.firstName} ${user.lastName}`);

        // Create mentor profile
        const mentorProfile = mentorProfileRepository.create({
          ...mentorData.profile,
          userId: user.id,
        });

        await mentorProfileRepository.save(mentorProfile);
        console.log(`👨‍💼 Created mentor profile for: ${user.firstName} ${user.lastName}`);

      } catch (error) {
        console.error(`❌ Error creating mentor ${mentorData.user.email}:`, error);
      }
    }

    const finalCount = await mentorProfileRepository.count();
    console.log(`✅ Successfully seeded ${finalCount} mentor profiles!`);

    // Show summary
    const approvedMentors = await mentorProfileRepository.find({
      where: { isApproved: true, isOnboardingComplete: true },
      relations: ['user'],
    });

    console.log('\n📋 Seeded Mentors Summary:');
    approvedMentors.forEach((mentor, index) => {
      console.log(`${index + 1}. ${mentor.user.firstName} ${mentor.user.lastName}`);
      console.log(`   - Email: ${mentor.user.email}`);
      console.log(`   - Experience: ${mentor.christianExperience}`);
      console.log(`   - Capacity: ${mentor.menteeCapacity}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error seeding mentors:', error);
    throw error;
  }
}

// Run seeder if called directly
if (require.main === module) {
  AppDataSource.initialize()
    .then(async () => {
      await seedMentors();
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error initializing database:', error);
      process.exit(1);
    });
}
