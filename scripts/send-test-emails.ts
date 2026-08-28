import 'dotenv/config';
import { EmailService } from '../src/core/email.service';
import { getEmailService } from '../src/services/emailHelper';
import { APP_EMAIL_OPEN_HOME } from '../src/common/constants/appEmailLinks';

const TEST_EMAIL = 'taiyeogunwumi93@gmail.com';

async function sendTestEmails() {
  console.log('📧 Starting to send test emails to:', TEST_EMAIL);
  console.log('');

  const emailService = getEmailService();

  if (!emailService) {
    console.error(
      '❌ Email service not available. Please check your SMTP configuration.'
    );
    process.exit(1);
  }

  try {
    // 1. Send Mentorship Request Email
    console.log('1️⃣ Sending Mentorship Request email...');
    await emailService.sendEmailWithTemplate({
      to: TEST_EMAIL,
      subject: 'New Mentorship Request from John Doe',
      partialName: 'mentorship-request',
      templateData: {
        mentorName: 'Dr. Sarah Johnson',
        menteeName: 'John Doe',
        message:
          "Hi Dr. Johnson, I would love to have you as my mentor. I'm excited to learn and grow in my faith journey with your guidance.",
        requestId: 'test-request-id-123',
      },
    });
    console.log('✅ Mentorship Request email sent!\n');
    await delay(2000); // Wait 2 seconds between emails

    // 2. Send Day 3 Reengagement Email
    console.log('2️⃣ Sending Day 3 Reengagement email...');
    await emailService.sendEmailWithTemplate({
      to: TEST_EMAIL,
      subject: 'We Miss You at Spiriment! 👋',
      partialName: 'reengagement-day3',
      templateData: {
        userName: 'Taiye',
        roleSpecific: 'mentees and fellow mentors', // or 'mentor and fellow mentees' for mentees
        appLink: APP_EMAIL_OPEN_HOME,
      },
    });
    console.log('✅ Day 3 Reengagement email sent!\n');
    await delay(2000);

    // 3. Send Day 7 Reengagement Email
    console.log('3️⃣ Sending Day 7 Reengagement email...');
    await emailService.sendEmailWithTemplate({
      to: TEST_EMAIL,
      subject: 'Your Spiritual Journey Awaits 💚',
      partialName: 'reengagement-day7',
      templateData: {
        userName: 'Taiye',
        roleSpecific: 'mentees and fellow mentors',
        appLink: APP_EMAIL_OPEN_HOME,
      },
    });
    console.log('✅ Day 7 Reengagement email sent!\n');
    await delay(2000);

    // 4. Send Day 30 Reengagement Email
    console.log('4️⃣ Sending Day 30 Reengagement email...');
    await emailService.sendEmailWithTemplate({
      to: TEST_EMAIL,
      subject: "We'd Love to See You Back at Spiriment 🙏",
      partialName: 'reengagement-day30',
      templateData: {
        userName: 'Taiye',
        roleSpecific: 'mentees and fellow mentors',
        appLink: APP_EMAIL_OPEN_HOME,
      },
    });
    console.log('✅ Day 30 Reengagement email sent!\n');

    console.log('🎉 All test emails sent successfully!');
    console.log(`📬 Check inbox: ${TEST_EMAIL}`);
  } catch (error) {
    console.error('❌ Error sending test emails:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Run the script
sendTestEmails()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
