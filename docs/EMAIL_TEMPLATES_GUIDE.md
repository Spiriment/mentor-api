# Email Templates Guide - Spiriment

## Overview
This document describes the email notification system for Spiriment, including templates customized with the app's theme colors.

## Theme Colors Used

Based on [mentor-app/src/constants/colors.ts](../../mentor-app/src/constants/colors.ts):

- **Primary Green:** `#3A5A40` - Used for buttons, headings, links, accents
- **Primary Dark:** `#162419` - Used for text, button hover states
- **Background Light:** `#EBEEEC` - Used for info boxes, borders
- **Border Medium:** `#C0CBC3` - Used for dividers
- **Text Secondary:** `#999999` - Used for copyright text
- **Background:** `#F8F9FA` - Email background color

## Email Templates

### Base Layout
**File:** `src/mails/partials/baseLayout.hbs`

**Features:**
- Poppins font family for professional appearance
- Responsive design (mobile-friendly)
- Spiriment branding with logo
- Theme-colored buttons (`.button` class)
- Info boxes with green accent border (`.info-box` class)
- Consistent footer with support links

**CSS Classes Available:**
- `.button` - Primary action button (green background)
- `.info-box` - Highlighted information box (light gray background, green left border)
- `.support-link` - Styled support email link
- `.tagline` - Spiriment tagline styling

### Session Request Email
**File:** `src/mails/partials/session-request.hbs`

**Purpose:** Notify mentors when a mentee requests a new session

**Variables:**
- `mentorName` - Mentor's full name
- `menteeName` - Mentee's full name
- `scheduledTime` - Formatted date/time string
- `duration` - Session duration in minutes
- `sessionType` - Optional session type (one-on-one, group, etc.)
- `description` - Optional session description/details from mentee
- `appUrl` - Deep link to app (default: `spiriment://sessions`)

**Usage Example:**
```typescript
await emailService.sendSessionRequestEmail(
  mentor.email,
  'John Smith',
  'Sarah Johnson',
  'Monday, November 27, 2025 at 3:00 PM',
  60,
  'I would like to discuss Romans chapter 5',
  'One-on-One',
  'spiriment://sessions/pending'
);
```

### Session Accepted Email
**File:** `src/mails/partials/session-accepted.hbs`

**Purpose:** Notify mentees when a mentor accepts their session request

**Variables:**
- `menteeName` - Mentee's full name
- `mentorName` - Mentor's full name
- `scheduledTime` - Formatted date/time string
- `duration` - Session duration in minutes
- `sessionType` - Optional session type
- `appUrl` - Deep link to app (default: `spiriment://sessions`)

**Usage Example:**
```typescript
await emailService.sendSessionAcceptedEmail(
  mentee.email,
  'Sarah Johnson',
  'John Smith',
  'Monday, November 27, 2025 at 3:00 PM',
  60,
  'One-on-One',
  'spiriment://sessions/upcoming'
);
```

### Session Declined Email
**File:** `src/mails/partials/session-declined.hbs`

**Purpose:** Notify mentees when a mentor declines their session request

**Variables:**
- `menteeName` - Mentee's full name
- `mentorName` - Mentor's full name
- `scheduledTime` - Formatted date/time string
- `reason` - Optional decline reason
- `appUrl` - Deep link to app (default: `spiriment://mentors`)

**Usage Example:**
```typescript
await emailService.sendSessionDeclinedEmail(
  mentee.email,
  'Sarah Johnson',
  'John Smith',
  'Monday, November 27, 2025 at 3:00 PM',
  'Unfortunately I have a scheduling conflict at this time',
  'spiriment://mentors'
);
```

## EmailService Methods

The [EmailService](../src/core/email.service.ts) now includes three new methods for session notifications:

### sendSessionRequestEmail()
```typescript
public async sendSessionRequestEmail(
  to: string,
  mentorName: string,
  menteeName: string,
  scheduledTime: string,
  duration: number,
  description?: string,
  sessionType?: string,
  appUrl?: string
): Promise<void>
```

### sendSessionAcceptedEmail()
```typescript
public async sendSessionAcceptedEmail(
  to: string,
  menteeName: string,
  mentorName: string,
  scheduledTime: string,
  duration: number,
  sessionType?: string,
  appUrl?: string
): Promise<void>
```

### sendSessionDeclinedEmail()
```typescript
public async sendSessionDeclinedEmail(
  to: string,
  menteeName: string,
  mentorName: string,
  scheduledTime: string,
  reason?: string,
  appUrl?: string
): Promise<void>
```

## Integration Guide

### 1. Update Session Controller

To send emails when sessions are created, accepted, or declined, update [src/controllers/session.controller.ts](../src/controllers/session.controller.ts):

```typescript
// Import EmailService
import { emailService } from '@/config/int-services';
import { format } from 'date-fns';

// In createSession method (after line 66):
const session = await this.sessionService.createSession(sessionData);

// Send notification email to mentor
const mentor = await this.userRepository.findOne({ where: { id: sessionData.mentorId } });
const mentee = await this.userRepository.findOne({ where: { id: sessionData.menteeId } });

if (mentor && mentee) {
  const scheduledTime = format(sessionData.scheduledAt, 'EEEE, MMMM d, yyyy \'at\' h:mm a');
  await emailService.sendSessionRequestEmail(
    mentor.email,
    `${mentor.firstName} ${mentor.lastName}`,
    `${mentee.firstName} ${mentee.lastName}`,
    scheduledTime,
    sessionData.duration || 60,
    sessionData.description,
    sessionData.type
  );
}
```

### 2. Update Session Service

Add email notifications when mentors accept or decline sessions in [src/services/session.service.ts](../src/services/session.service.ts):

```typescript
// Import at top of file
import { emailService } from '@/config/int-services';
import { format } from 'date-fns';

// In acceptSession method (after updating status to confirmed):
const scheduledTime = format(session.scheduledAt, 'EEEE, MMMM d, yyyy \'at\' h:mm a');
await emailService.sendSessionAcceptedEmail(
  session.mentee.email,
  `${session.mentee.firstName} ${session.mentee.lastName}`,
  `${session.mentor.firstName} ${session.mentor.lastName}`,
  scheduledTime,
  session.duration
);

// In declineSession method (after updating status to cancelled):
const scheduledTime = format(session.scheduledAt, 'EEEE, MMMM d, yyyy \'at\' h:mm a');
await emailService.sendSessionDeclinedEmail(
  session.mentee.email,
  `${session.mentee.firstName} ${session.mentee.lastName}`,
  `${session.mentor.firstName} ${session.mentor.lastName}`,
  scheduledTime,
  reason
);
```

## Testing

### Manual Testing
1. Create a test mentee and mentor account
2. Request a session from mentee side
3. Check mentor's email for "New Session Request" email
4. Accept the session from mentor side
5. Check mentee's email for "Session Accepted" email

### Email Preview
To preview emails during development, you can use a service like:
- **Mailtrap** (recommended for staging)
- **MailHog** (for local development)
- **Ethereal Email** (temporary testing accounts)

Configure these in your `.env` file:
```bash
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=your_mailtrap_username
SMTP_PASSWORD=your_mailtrap_password
SMTP_FROM=noreply@spiriment.com
```

## Deep Links

The templates include deep links to the Spiriment app:
- `spiriment://sessions` - Opens sessions screen
- `spiriment://sessions/pending` - Opens pending sessions
- `spiriment://sessions/upcoming` - Opens upcoming sessions
- `spiriment://mentors` - Opens mentor browsing screen

These should be configured in your React Native app's deep linking setup.

## Branding Consistency

All email templates follow these branding guidelines:
- **Primary Color:** #3A5A40 (Spiriment green)
- **Font:** Poppins (professional, modern, readable)
- **Tone:** Supportive, encouraging, faith-focused
- **Sign-off:** "Blessings, The Spiriment Team"
- **Tagline:** "Connect, Grow, Mentor"

## Future Enhancements

Potential improvements to consider:
- Session reminder emails (24 hours before, 1 hour before)
- Session completion follow-up emails
- Monthly mentorship summary emails
- Unread message notifications
- Study streak milestone emails
- Bible reading completion emails

---

**Last Updated:** November 26, 2025  
**Version:** 1.0  
**Maintained by:** Spiriment Development Team
