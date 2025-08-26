// Core types and factory (no optional dependencies)
export { EmailService, EmailParams, EmailResponse, EmailProvider, EmailAddress, EmailRecipient } from './types';
export { createEmailService, getEmailService, isEmailProviderAvailable, getAvailableEmailProviders } from './factory';

// Utilities (no optional dependencies)
export { 
  isEmailAddress, 
  validateEmail, 
  normalizeEmailRecipient, 
  formatEmailForSMTP, 
  formatEmailForProvider, 
} from './utils';

// Note: Individual email providers are available via specific imports to avoid loading optional dependencies:
// - import { SMTPEmailService } from 'crunchycone-lib/email/providers/smtp'
// - import { SendGridEmailService } from 'crunchycone-lib/email/providers/sendgrid'
// - import { ResendEmailService } from 'crunchycone-lib/email/providers/resend'
// - import { AmazonSESEmailService } from 'crunchycone-lib/email/providers/amazon-ses'
// - import { MailgunEmailService } from 'crunchycone-lib/email/providers/mailgun'
// - import { CrunchyConeEmailService } from 'crunchycone-lib/email/providers/crunchycone'