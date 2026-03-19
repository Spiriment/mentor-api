import { EmailService } from '../core/email.service';
import { toZonedTime, format as formatTz } from 'date-fns-tz';

let emailServiceInstance: EmailService | null = null;

export const initializeEmailHelper = (emailService: EmailService) => {
  emailServiceInstance = emailService;
};

export const getEmailService = (): EmailService => {
  if (!emailServiceInstance) {
    // Create a new instance if not initialized
    emailServiceInstance = new EmailService(null);
  }
  return emailServiceInstance;
};

export const formatSessionTime = (scheduledAt: Date, timezone?: string): string => {
  const tz = timezone || 'UTC';
  const zonedTime = toZonedTime(scheduledAt, tz);
  return formatTz(zonedTime, "EEEE, MMMM d, yyyy 'at' h:mm a", { timeZone: tz });
};

export const formatSessionType = (type: string): string => {
  const types: Record<string, string> = {
    one_on_one: 'One-on-One',
    group: 'Group Session',
    video_call: 'Video Call',
    phone_call: 'Phone Call',
    in_person: 'In-Person',
  };
  return types[type] || type;
};

export const formatUserName = (user: { firstName?: string; lastName?: string; email: string }, role?: string): string => {
  const firstName = (user.firstName || '').trim();
  const lastName = (user.lastName || '').trim();
  
  if (!firstName) return user.email;
  
  if (lastName) {
    const LowerLastName = lastName.toLowerCase();
    if (LowerLastName !== 'mentor' && LowerLastName !== 'mentee' && LowerLastName !== 'user') {
      return `${firstName} ${lastName}`;
    }
  }
  
  return firstName;
};
