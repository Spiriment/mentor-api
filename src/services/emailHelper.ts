import { EmailService } from '../core/email.service';
import { format } from 'date-fns';

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

export const formatSessionTime = (scheduledAt: Date): string => {
  return format(scheduledAt, "EEEE, MMMM d, yyyy 'at' h:mm a");
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
