import { EmailService, EmailProvider } from './types';

export function createEmailService(provider?: EmailProvider): EmailService {
  const selectedProvider = (provider || process.env.CRUNCHYCONE_EMAIL_PROVIDER?.trim().toLowerCase() || 'console') as EmailProvider;
  
  // Use require() for dynamic loading to avoid static imports of optional dependencies
  switch (selectedProvider) {
    case 'smtp': {
      const { SMTPEmailService } = require('./providers/smtp');
      return new SMTPEmailService();
    }
    case 'sendgrid': {
      const { SendGridEmailService } = require('./providers/sendgrid');
      return new SendGridEmailService();
    }
    case 'resend': {
      const { ResendEmailService } = require('./providers/resend');
      return new ResendEmailService();
    }
    case 'ses':
      throw new Error(`Provider 'ses' requires optional dependencies. Import directly: import { AmazonSESEmailService } from 'crunchycone-lib/email/providers/amazon-ses'`);
    case 'mailgun': {
      const { MailgunEmailService } = require('./providers/mailgun');
      return new MailgunEmailService();
    }
    case 'crunchycone': {
      const { CrunchyConeEmailService } = require('./providers/crunchycone');
      return new CrunchyConeEmailService();
    }
    case 'console': {
      const { ConsoleEmailService } = require('./providers/console');
      return new ConsoleEmailService();
    }
    default:
      throw new Error(`Unsupported email provider: ${selectedProvider}. Supported providers: smtp, sendgrid, resend, ses (via direct import), mailgun, crunchycone, console`);
  }
}

export function getEmailService(): EmailService {
  return createEmailService();
}