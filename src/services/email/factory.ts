import { EmailService, EmailProvider } from './types';

export function createEmailService(provider?: EmailProvider): EmailService {
  const selectedProvider = (provider || process.env.CRUNCHYCONE_EMAIL_PROVIDER?.trim().toLowerCase() || 'console') as EmailProvider;
  
  // Use dynamic require with try/catch to handle missing dependencies gracefully
  switch (selectedProvider) {
    case 'smtp': {
      try {
        const { SMTPEmailService } = require('./providers/smtp');
        return new SMTPEmailService();
      } catch (error: any) {
        throw new Error(`Failed to load SMTP provider: ${error.message}`);
      }
    }
    case 'sendgrid': {
      try {
        const { SendGridEmailService } = require('./providers/sendgrid');
        return new SendGridEmailService();
      } catch (error: any) {
        throw new Error(`Failed to load SendGrid provider. Ensure @sendgrid/mail is installed: ${error.message}`);
      }
    }
    case 'resend': {
      try {
        const { ResendEmailService } = require('./providers/resend');
        return new ResendEmailService();
      } catch (error: any) {
        throw new Error(`Failed to load Resend provider. Ensure resend is installed: ${error.message}`);
      }
    }
    case 'ses': {
      try {
        const { AmazonSESEmailService } = require('./providers/amazon-ses');
        return new AmazonSESEmailService();
      } catch (error: any) {
        throw new Error(`Failed to load Amazon SES provider. Ensure @aws-sdk/client-ses is installed: ${error.message}`);
      }
    }
    case 'mailgun': {
      try {
        const { MailgunEmailService } = require('./providers/mailgun');
        return new MailgunEmailService();
      } catch (error: any) {
        throw new Error(`Failed to load Mailgun provider: ${error.message}`);
      }
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
      throw new Error(`Unsupported email provider: ${selectedProvider}. Supported providers: smtp, sendgrid, resend, ses, mailgun, crunchycone, console`);
  }
}

export function getEmailService(): EmailService {
  return createEmailService();
}