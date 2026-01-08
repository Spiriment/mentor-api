import { AppDataSource } from '../src/config/data-source';
import { Logger } from '../src/common';
import * as readline from 'readline';

const logger = new Logger({
  service: 'delete-user-script',
  level: process.env.LOG_LEVEL || 'info',
});

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false, // Disable terminal mode to work with piped input
});

// Promisify question
const question = (query: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (rl.terminal === false && process.stdin.isTTY === undefined) {
      // If input is piped, don't ask questions
      reject(new Error('Interactive input required. Please run the script with: npm run db:delete-user <email>'));
    }
    rl.question(query, resolve);
  });
};

async function deleteUser() {
  try {
    // Initialize database connection
    await AppDataSource.initialize();
    logger.info('Database connection established');

    // Get email from command line argument or prompt
    let email = process.argv[2];

    if (!email) {
      email = await question('Enter the email address of the user to delete: ');
    }

    if (!email || !email.includes('@')) {
      logger.error('Invalid email address provided');
      process.exit(1);
    }

    // Find user by email
    const user = await AppDataSource.query(
      'SELECT id, email, firstName, lastName, role, createdAt FROM users WHERE email = ?',
      [email]
    );

    if (!user || user.length === 0) {
      logger.error(`No user found with email: ${email}`);
      process.exit(1);
    }

    const userData = user[0];
    const userId = userData.id;

    console.log('\n===========================================');
    console.log('Found user:');
    console.log('===========================================');
    console.log(`ID: ${userData.id}`);
    console.log(`Email: ${userData.email}`);
    console.log(`Name: ${userData.firstName} ${userData.lastName}`);
    console.log(`Role: ${userData.role}`);
    console.log(`Created: ${userData.createdAt}`);
    console.log('===========================================\n');

    // Check related data
    const relatedData = await checkRelatedData(userId);

    if (relatedData.hasData) {
      console.log('⚠️  This user has the following related data:');
      console.log('-------------------------------------------');
      if (relatedData.menteeProfile > 0) console.log(`- Mentee Profile: ${relatedData.menteeProfile} record(s)`);
      if (relatedData.mentorProfile > 0) console.log(`- Mentor Profile: ${relatedData.mentorProfile} record(s)`);
      if (relatedData.sessions > 0) console.log(`- Sessions: ${relatedData.sessions} record(s)`);
      if (relatedData.messages > 0) console.log(`- Messages: ${relatedData.messages} record(s)`);
      if (relatedData.conversations > 0) console.log(`- Conversations: ${relatedData.conversations} record(s)`);
      if (relatedData.mentorshipRequests > 0) console.log(`- Mentorship Requests: ${relatedData.mentorshipRequests} record(s)`);
      if (relatedData.bibleData > 0) console.log(`- Bible Data: ${relatedData.bibleData} record(s)`);
      if (relatedData.studyData > 0) console.log(`- Study Data: ${relatedData.studyData} record(s)`);
      if (relatedData.notifications > 0) console.log(`- Notifications: ${relatedData.notifications} record(s)`);
      console.log('-------------------------------------------');
      console.log('All related data will be deleted due to CASCADE rules.\n');
    } else {
      console.log('✓ This user has no related data.\n');
    }

    // Confirmation
    const confirm = await question(
      '⚠️  Are you sure you want to DELETE this user and all related data? (yes/no): '
    );

    if (confirm.toLowerCase() !== 'yes') {
      logger.info('Deletion cancelled by user');
      process.exit(0);
    }

    // Double confirmation for safety
    const doubleConfirm = await question(
      '⚠️  This action CANNOT be undone. Type the email again to confirm: '
    );

    if (doubleConfirm !== email) {
      logger.error('Email confirmation did not match. Deletion cancelled.');
      process.exit(1);
    }

    console.log('\n🗑️  Deleting user...\n');

    // Delete user (CASCADE will handle related data)
    const result = await AppDataSource.query('DELETE FROM users WHERE id = ?', [
      userId,
    ]);

    // Also clean up any remaining data that might not have CASCADE
    await cleanupRemainingData(userId);

    logger.info('✅ User deleted successfully!');
    console.log('\n===========================================');
    console.log('✅ User deletion completed');
    console.log('===========================================');
    console.log(`Email: ${email}`);
    console.log(`Affected rows: ${result.affectedRows}`);
    console.log('===========================================\n');

    process.exit(0);
  } catch (error: any) {
    logger.error('Failed to delete user:', error);
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    rl.close();
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

async function checkRelatedData(userId: string) {
  const menteeProfile = await AppDataSource.query(
    'SELECT COUNT(*) as count FROM mentee_profiles WHERE userId = ?',
    [userId]
  );
  const mentorProfile = await AppDataSource.query(
    'SELECT COUNT(*) as count FROM mentor_profiles WHERE userId = ?',
    [userId]
  );
  const sessions = await AppDataSource.query(
    'SELECT COUNT(*) as count FROM sessions WHERE menteeId = ? OR mentorId = ?',
    [userId, userId]
  );
  const messages = await AppDataSource.query(
    'SELECT COUNT(*) as count FROM messages WHERE senderId = ?',
    [userId]
  );
  const conversations = await AppDataSource.query(
    'SELECT COUNT(*) as count FROM conversation_participants WHERE userId = ?',
    [userId]
  );
  const mentorshipRequests = await AppDataSource.query(
    'SELECT COUNT(*) as count FROM mentorship_requests WHERE menteeId = ? OR mentorId = ?',
    [userId, userId]
  );

  // Bible data
  const bibleBookmarks = await AppDataSource.query(
    'SELECT COUNT(*) as count FROM bible_bookmarks WHERE userId = ?',
    [userId]
  );
  const bibleHighlights = await AppDataSource.query(
    'SELECT COUNT(*) as count FROM bible_highlights WHERE userId = ?',
    [userId]
  );
  const bibleReflections = await AppDataSource.query(
    'SELECT COUNT(*) as count FROM bible_reflections WHERE userId = ?',
    [userId]
  );
  const bibleProgress = await AppDataSource.query(
    'SELECT COUNT(*) as count FROM bible_progress WHERE userId = ?',
    [userId]
  );

  // Study data
  const studyProgress = await AppDataSource.query(
    'SELECT COUNT(*) as count FROM study_progress WHERE userId = ?',
    [userId]
  );
  const studySessions = await AppDataSource.query(
    'SELECT COUNT(*) as count FROM study_sessions WHERE userId = ?',
    [userId]
  );
  const studyReflections = await AppDataSource.query(
    'SELECT COUNT(*) as count FROM study_reflections WHERE userId = ?',
    [userId]
  );

  // Notifications
  const notifications = await AppDataSource.query(
    'SELECT COUNT(*) as count FROM user_notifications WHERE userId = ?',
    [userId]
  );
  const scheduledNotifications = await AppDataSource.query(
    'SELECT COUNT(*) as count FROM scheduled_notifications WHERE userId = ?',
    [userId]
  );

  const bibleDataCount =
    bibleBookmarks[0].count +
    bibleHighlights[0].count +
    bibleReflections[0].count +
    bibleProgress[0].count;

  const studyDataCount =
    studyProgress[0].count +
    studySessions[0].count +
    studyReflections[0].count;

  const notificationsCount =
    notifications[0].count + scheduledNotifications[0].count;

  const totalCount =
    menteeProfile[0].count +
    mentorProfile[0].count +
    sessions[0].count +
    messages[0].count +
    conversations[0].count +
    mentorshipRequests[0].count +
    bibleDataCount +
    studyDataCount +
    notificationsCount;

  return {
    hasData: totalCount > 0,
    menteeProfile: menteeProfile[0].count,
    mentorProfile: mentorProfile[0].count,
    sessions: sessions[0].count,
    messages: messages[0].count,
    conversations: conversations[0].count,
    mentorshipRequests: mentorshipRequests[0].count,
    bibleData: bibleDataCount,
    studyData: studyDataCount,
    notifications: notificationsCount,
  };
}

async function cleanupRemainingData(userId: string) {
  // Clean up any data that might not have CASCADE delete
  try {
    await AppDataSource.query('DELETE FROM refresh_tokens WHERE userId = ?', [
      userId,
    ]);
    await AppDataSource.query(
      'DELETE FROM user_notifications WHERE userId = ?',
      [userId]
    );
    await AppDataSource.query(
      'DELETE FROM scheduled_notifications WHERE userId = ?',
      [userId]
    );
    await AppDataSource.query('DELETE FROM password_reset WHERE userId = ?', [
      userId,
    ]);
    await AppDataSource.query('DELETE FROM audit_logs WHERE userId = ?', [
      userId,
    ]);

    logger.info('Cleaned up remaining user data');
  } catch (error: any) {
    logger.warn('Some cleanup operations failed (this is usually okay):', error.message);
  }
}

// Run the script
deleteUser();
