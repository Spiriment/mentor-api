/**
 * Pre-launch reset: remove all Spiriment *app* users and their data.
 * Keeps admin accounts, content (quiz/blog/faq), settings, promo codes, church portals, etc.
 *
 * Usage:
 *   npm run db:clear-app-users              # dry-run (default)
 *   npm run db:clear-app-users -- --execute --confirm CLEAR_APP_USERS
 *
 * Production:
 *   NODE_ENV=production npm run db:clear-app-users:prod -- --execute --confirm CLEAR_APP_USERS
 *
 * ALWAYS take a DB backup first (npm run db:backup:prod).
 */

import { AppDataSource } from '../src/config/data-source';
import { Logger } from '../src/common';

const logger = new Logger({
  service: 'clear-app-users-for-launch',
  level: process.env.LOG_LEVEL || 'info',
});

/** Tables wiped (app user activity & identities). Order is best-effort; FK checks disabled. */
const USER_DATA_TABLES = [
  'email_campaign_recipients',
  'support_ticket_messages',
  'support_tickets',
  'app_notifications',
  'user_notifications',
  'scheduled_notifications',
  'messages',
  'conversation_participants',
  'conversations',
  'group_session_participants',
  'group_sessions',
  'session_reviews',
  'sessions',
  'mentorship_requests',
  'mentor_availability',
  'mentee_reports',
  'reviews',
  'family_members',
  'family_plans',
  'user_subscriptions',
  'user_discounts',
  'referrals',
  'promo_code_redemptions',
  'quiz_attempts',
  'quiz_streaks',
  'monthly_summaries',
  'bible_bookmarks',
  'bible_highlights',
  'bible_reflections',
  'bible_progress',
  'study_reflections',
  'study_sessions',
  'study_progress',
  'mentee_profiles',
  'mentor_profiles',
  'refresh_tokens',
  'password_reset',
  'audit_logs',
  'processed_webhook_events',
  'mrr_snapshots',
  'church_portal_join_requests',
  'users',
];

/** Not touched — platform config & content. */
const PRESERVED_TABLES = [
  'migrations',
  'admin_users',
  'admin_audit_logs',
  'spiriment_settings',
  'org_plans',
  'system_config',
  'promo_codes',
  'quiz_books',
  'quiz_questions',
  'blog_posts',
  'faqs',
  'contact_messages',
  'email_campaigns',
  'church_portals',
  'church_portal_users',
  'church_portal_refresh_tokens',
  'bible_explanations',
  'ai_chapter_summaries',
];

async function tableExists(
  queryRunner: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
  tableName: string
): Promise<boolean> {
  const rows = (await queryRunner.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? LIMIT 1`,
    [tableName]
  )) as unknown[];
  return rows.length > 0;
}

async function rowCount(
  queryRunner: { query: (sql: string) => Promise<unknown> },
  tableName: string
): Promise<number> {
  const rows = (await queryRunner.query(
    `SELECT COUNT(*) AS c FROM \`${tableName}\``
  )) as { c: number }[];
  return Number(rows[0]?.c ?? 0);
}

async function main() {
  const execute = process.argv.includes('--execute');
  const confirmOk = process.argv.includes('--confirm') &&
    process.argv[process.argv.indexOf('--confirm') + 1] === 'CLEAR_APP_USERS';

  if (execute && !confirmOk) {
    console.error(
      'Refusing to run without: --execute --confirm CLEAR_APP_USERS'
    );
    process.exit(1);
  }

  await AppDataSource.initialize();
  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();

  console.log('\n=== Spiriment pre-launch user reset ===\n');
  console.log(`Mode: ${execute ? 'EXECUTE (destructive)' : 'DRY RUN'}\n`);

  console.log('Will CLEAR (app users + related data):');
  for (const t of USER_DATA_TABLES) {
    if (await tableExists(queryRunner, t)) {
      const n = await rowCount(queryRunner, t);
      console.log(`  - ${t}: ${n} row(s)`);
    } else {
      console.log(`  - ${t}: (missing, skip)`);
    }
  }

  console.log('\nWill KEEP (unchanged):');
  for (const t of PRESERVED_TABLES) {
    if (await tableExists(queryRunner, t)) {
      const n = await rowCount(queryRunner, t);
      console.log(`  - ${t}: ${n} row(s)`);
    }
  }

  console.log(
    '\nNote: Per-user notifications (app_notifications, scheduled_notifications, etc.) are cleared with users. Admin, quiz content, blog, settings, and promo code definitions stay.\n'
  );

  if (!execute) {
    console.log('Dry run only. Re-run with: --execute --confirm CLEAR_APP_USERS\n');
    await queryRunner.release();
    await AppDataSource.destroy();
    process.exit(0);
  }

  logger.warn('Executing user data wipe...');
  await queryRunner.query('SET FOREIGN_KEY_CHECKS = 0');

  for (const tableName of USER_DATA_TABLES) {
    if (!(await tableExists(queryRunner, tableName))) continue;
    try {
      await queryRunner.query(`TRUNCATE TABLE \`${tableName}\``);
      logger.info(`Truncated ${tableName}`);
    } catch {
      await queryRunner.query(`DELETE FROM \`${tableName}\``);
      logger.info(`Deleted all rows from ${tableName}`);
    }
  }

  await queryRunner.query('SET FOREIGN_KEY_CHECKS = 1');
  await queryRunner.release();
  await AppDataSource.destroy();

  console.log('\n✅ App users cleared. Everyone must sign up again.\n');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
