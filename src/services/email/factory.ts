import { EmailService, EmailProvider } from './types';

// Cache for provider availability to avoid repeated import attempts
const availabilityCache = new Map<EmailProvider, { available: boolean; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

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

/**
 * Check if a specific email provider is available (has required dependencies)
 */
export async function isEmailProviderAvailable(provider: EmailProvider): Promise<boolean> {
  // Check cache first
  const cached = availabilityCache.get(provider);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.available;
  }

  let available: boolean;

  switch (provider) {
    case 'console':
    case 'smtp':
    case 'crunchycone':
      // These providers have no optional dependencies
      available = true;
      break;

    case 'sendgrid':
      try {
        const sendgridPackage = '@sendgrid/mail'.split('').join('');
        await import(sendgridPackage);
        available = true;
      } catch {
        available = false;
      }
      break;

    case 'resend':
      try {
        const resendPackage = 'resend'.split('').join('');
        await import(resendPackage);
        available = true;
      } catch {
        available = false;
      }
      break;

    case 'ses':
      try {
        const awsSesPackage = '@aws-sdk/client-ses'.split('').join('');
        await import(awsSesPackage);
        available = true;
      } catch {
        available = false;
      }
      break;

    case 'mailgun':
      // Mailgun uses fetch (built-in) so it's always available
      available = true;
      break;

    default:
      available = false;
  }

  // Cache the result
  availabilityCache.set(provider, { available, timestamp: Date.now() });
  
  return available;
}

/**
 * Get list of all available email providers
 */
export async function getAvailableEmailProviders(): Promise<EmailProvider[]> {
  const allProviders: EmailProvider[] = ['console', 'smtp', 'crunchycone', 'sendgrid', 'resend', 'ses', 'mailgun'];
  const availableProviders: EmailProvider[] = [];

  for (const provider of allProviders) {
    if (await isEmailProviderAvailable(provider)) {
      availableProviders.push(provider);
    }
  }

  return availableProviders;
}