# Pre-launch database reset (app users only)

Use this before public launch when you want a **clean slate for sign-ups** without rebuilding the whole database.

## What gets removed

All rows in **`users`** and tables that belong to app accounts, including:

- Profiles (mentor/mentee), sessions, chat, Bible/study progress  
- Subscriptions, family plans, referrals, quiz attempts  
- In-app notifications, scheduled push rows, support tickets tied to users  
- Refresh tokens, webhooks/MRR snapshots tied to pre-launch usage  
- Church portal **join requests** (they reference app user IDs)

## What stays

| Kept | Examples |
|------|----------|
| Admin portal | `admin_users`, `admin_audit_logs` |
| Product config | `spiriment_settings`, `org_plans`, `system_config` |
| Content | `quiz_books`, `quiz_questions`, `blog_posts`, `faqs` |
| Marketing | `promo_codes` (definitions), `email_campaigns` (drafts; recipients cleared) |
| Church portals | `church_portals`, `church_portal_users` (pastor logins) |
| Shared AI cache | `bible_explanations`, `ai_chapter_summaries` |
| Contact form | `contact_messages` |

**Important:** Per-user notifications (`app_notifications`, `scheduled_notifications`, etc.) are cleared with users — they reference user IDs. **New users get a fresh inbox after sign-up.** Platform settings and content are not wiped.

## Do not use phpMyAdmin “empty all tables”

Your DB has many tables. Truncating everything would remove quizzes, admin users, and settings. Use the script below instead.

## Steps (production)

1. **Backup** (required):

   ```bash
   cd mentor-backend
   npm run db:backup:prod
   ```

2. **Dry run** (see counts, no changes):

   ```bash
   npm run db:clear-app-users:prod
   ```

3. **Execute** (only after backup + dry run look correct):

   ```bash
   npm run db:clear-app-users:prod -- --execute --confirm CLEAR_APP_USERS
   ```

4. Verify in phpMyAdmin: **`users`** = 0 rows; **`quiz_questions`** / **`admin_users`** still have data.

## Development

```bash
npm run db:clear-app-users
npm run db:clear-app-users -- --execute --confirm CLEAR_APP_USERS
```

## After reset

- Test OTP sign-up with a previously used email (should work).  
- Broadcast Excel lists are independent of `users`; `email_campaign_recipients` is cleared if you run this script.
