export { EmailService, EmailParams, EmailResponse, EmailProvider, EmailAddress, EmailRecipient } from './types';
export { createEmailService, getEmailService } from './factory';
export { SMTPEmailService } from './providers/smtp';
export { SendGridEmailService } from './providers/sendgrid';
export { ResendEmailService } from './providers/resend';
export { AmazonSESEmailService } from './providers/amazon-ses';
export { MailgunEmailService } from './providers/mailgun';
export { CrunchyConeEmailService } from './providers/crunchycone';
export { 
  isEmailAddress, 
  validateEmail, 
  normalizeEmailRecipient, 
  formatEmailForSMTP, 
  formatEmailForProvider, 
} from './utils';