# Session Reminder Cron Job

## Overview
A cron job that automatically sends email reminders to mentors and mentees 15 minutes before their scheduled sessions.

## Implementation

### Files Created/Modified

1. **`src/services/sessionReminder.service.ts`** (NEW)
   - Service that handles sending 15-minute reminders
   - Queries sessions starting in ~15 minutes
   - Sends emails to both mentor and mentee
   - Updates session reminders field to prevent duplicate sends

2. **`src/core/cron.service.ts`** (MODIFIED)
   - Added session reminder cron job
   - Runs every minute to check for upcoming sessions
   - Initializes SessionReminderService and EmailService

3. **`src/core/email.service.ts`** (MODIFIED)
   - Updated `sendNotificationEmail` to send directly when queueService is null
   - Allows cron job to send emails without queue system

## How It Works

### Cron Schedule
- **Frequency**: Every minute (`* * * * *`)
- **Timezone**: UTC
- **Task Name**: `session-15min-reminder`

### Process Flow

1. **Cron Job Triggers** (every minute)
   - Calls `SessionReminderService.send15MinuteReminders()`

2. **Query Sessions**
   - Finds sessions with status `scheduled` or `confirmed`
   - Scheduled between 14-16 minutes from now (accounts for timing variance)
   - Filters out sessions where `reminders.sent15min` is already `true`

3. **Send Reminders**
   - Sends email to mentor with session details
   - Sends email to mentee with session details
   - Includes:
     - Session time (formatted)
     - Other participant name
     - Duration
     - Description (if available)
     - Meeting link (if available)
     - Location (if available)

4. **Update Session**
   - Sets `reminders.sent15min = true` in session entity
   - Prevents duplicate reminders

### Email Content

**Subject**: `⏰ Session Reminder: Your session starts in 15 minutes`

**Body includes**:
- Personalized greeting
- Session time (formatted: "Monday, January 15, 2024 at 2:00 PM")
- Other participant name
- Duration
- Description
- Meeting link (if available) with "Join Session" button
- Location (if available)

## Database Schema

The `sessions` table has a `reminders` JSON field:
```json
{
  "sent24h": boolean,
  "sent1h": boolean,
  "sent15min": boolean
}
```

## Testing

### Manual Testing

1. **Force Run the Cron Job**:
   ```typescript
   // Via API endpoint or directly
   cronService.forceRunTask('session-15min-reminder');
   ```

2. **Create a Test Session**:
   - Create a session scheduled for 15 minutes from now
   - Wait for cron job to run (or force run it)
   - Check email inboxes for both mentor and mentee
   - Verify `reminders.sent15min` is set to `true` in database

### Test Scenarios

1. ✅ **Normal Flow**: Session in 15 minutes → Reminder sent
2. ✅ **Duplicate Prevention**: Reminder already sent → Skip
3. ✅ **Multiple Sessions**: Multiple sessions in 15 minutes → All get reminders
4. ✅ **No Email**: Missing email address → Logs warning, continues
5. ✅ **Cancelled Sessions**: Cancelled sessions → Not included
6. ✅ **Past Sessions**: Past sessions → Not included

## Configuration

### Cron Schedule
Currently set to run every minute. To change:
```typescript
// In cron.service.ts
cron.schedule(
  "*/5 * * * *", // Every 5 minutes instead
  // ...
);
```

### Reminder Window
Currently checks for sessions between 14-16 minutes from now. To adjust:
```typescript
// In sessionReminder.service.ts
.andWhere('session.scheduledAt >= :startTime', {
  startTime: addMinutes(now, 14), // Adjust start
})
.andWhere('session.scheduledAt <= :endTime', {
  endTime: addMinutes(now, 16), // Adjust end
})
```

## Monitoring

### Logs
The cron job logs:
- Number of sessions found
- Reminders sent
- Errors (if any)
- Warnings (missing emails, etc.)

### Check Cron Job Status
```typescript
const status = cronService.getCronJobsStatus();
console.log(status['session-15min-reminder']);
// { running: true, name: 'session-15min-reminder', schedule: '* * * * * (Every minute)' }
```

## Future Enhancements

1. **Additional Reminders**: Add 1-hour and 24-hour reminders
2. **SMS Notifications**: Send SMS in addition to email
3. **Push Notifications**: Send push notifications via WebSocket
4. **Timezone Support**: Handle user timezones for reminder timing
5. **Customizable Reminder Times**: Allow users to set their preferred reminder times

## Error Handling

- If email sending fails for one session, it logs the error and continues with other sessions
- Missing email addresses are logged as warnings
- Database errors are caught and logged
- Cron job errors don't crash the server

## Notes

- The cron job runs in UTC timezone
- Session times should be stored in UTC in the database
- Email templates use the existing notification email template
- The service handles both mentor and mentee roles automatically

