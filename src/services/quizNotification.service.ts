import { AppDataSource } from '@/config/data-source';
import { User } from '@/database/entities/user.entity';
import { pushNotificationService } from './pushNotification.service';
import { logger } from '@/config/int-services';
import { Not, IsNull } from 'typeorm';

const QUIZ_MESSAGES = [
  { title: '📖 Weekly Bible Quiz', body: 'Ready to test your Bible knowledge? Your weekly quiz is waiting!' },
  { title: '🧠 Quiz Time!', body: 'How well do you know the Word? Take this week\'s Bible Quiz now.' },
  { title: '📚 Your Weekly Challenge', body: 'A new Bible Quiz set is ready for you. Give it a try!' },
  { title: '✨ Quiz Reminder', body: 'Strengthen your Scripture knowledge — take the weekly Bible Quiz today.' },
];

export class QuizNotificationService {
  async sendWeeklyQuizReminder(): Promise<void> {
    const userRepo = AppDataSource.getRepository(User);

    const users = await userRepo.find({
      where: { pushToken: Not(IsNull()), isActive: true },
      select: ['id', 'pushToken', 'pushNotificationsEnabled'],
    });

    const eligible = users.filter(u => u.pushToken && u.pushNotificationsEnabled !== false);
    logger.info(`Sending weekly quiz notification to ${eligible.length} users`);

    // Pick a random message variant so it doesn't feel repetitive
    const msg = QUIZ_MESSAGES[new Date().getDate() % QUIZ_MESSAGES.length];

    let sent = 0;
    let failed = 0;

    for (const user of eligible) {
      try {
        await pushNotificationService.sendToUser({
          userId: user.id,
          pushToken: user.pushToken!,
          title: msg.title,
          body: msg.body,
          data: { screen: 'QuizBookSelect', type: 'weekly_quiz_reminder' },
          channelId: 'quiz-reminders',
        });
        sent++;
      } catch (err) {
        failed++;
        logger.warn(`Failed to send quiz notification to user ${user.id}: ${String(err)}`);
      }
    }

    logger.info(`Weekly quiz notification complete — sent: ${sent}, failed: ${failed}`);
  }
}

export const quizNotificationService = new QuizNotificationService();
