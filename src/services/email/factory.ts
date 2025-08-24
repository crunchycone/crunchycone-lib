import { EmailService, EmailProvider } from './types';
import { SMTPEmailService } from './providers/smtp';
import { SendGridEmailService } from './providers/sendgrid';
import { ResendEmailService } from './providers/resend';
import { AmazonSESEmailService } from './providers/amazon-ses';
import { MailgunEmailService } from './providers/mailgun';
import { CrunchyConeEmailService } from './providers/crunchycone';
import { ConsoleEmailService } from './providers/console';

export function createEmailService(): EmailService {
  const provider = (process.env.CRUNCHYCONE_EMAIL_PROVIDER?.trim().toLowerCase() || 'console') as EmailProvider;

  switch (provider) {
    case 'smtp':
      return new SMTPEmailService();
    case 'sendgrid':
      return new SendGridEmailService();
    case 'resend':
      return new ResendEmailService();
    case 'ses':
      return new AmazonSESEmailService();
    case 'mailgun':
      return new MailgunEmailService();
    case 'crunchycone':
      return new CrunchyConeEmailService();
    case 'console':
      return new ConsoleEmailService();
    default:
      throw new Error(`Unsupported email provider: ${provider}. Supported providers: smtp, sendgrid, resend, ses, mailgun, crunchycone, console`);
  }
}

export function getEmailService(): EmailService {
  return createEmailService();
}