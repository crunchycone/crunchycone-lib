import { createEmailService, getEmailService } from '../../../src/services/email/factory';
import { SMTPEmailService } from '../../../src/services/email/providers/smtp';
import { SendGridEmailService } from '../../../src/services/email/providers/sendgrid';
import { ResendEmailService } from '../../../src/services/email/providers/resend';
import { AmazonSESEmailService } from '../../../src/services/email/providers/amazon-ses';
import { MailgunEmailService } from '../../../src/services/email/providers/mailgun';
import { CrunchyConeEmailService } from '../../../src/services/email/providers/crunchycone';
import { ConsoleEmailService } from '../../../src/services/email/providers/console';
import { setEnvVars } from './shared/test-helpers';

// Mock all external dependencies
jest.mock('nodemailer');
jest.mock('@sendgrid/mail');
jest.mock('resend');
jest.mock('@aws-sdk/client-ses');

describe('Email Service Factory', () => {
  describe('createEmailService', () => {
    test('should create SMTP service when provider is "smtp"', () => {
      setEnvVars('smtp');
      process.env.CRUNCHYCONE_EMAIL_PROVIDER = 'smtp';
      
      const service = createEmailService();
      
      expect(service).toBeInstanceOf(SMTPEmailService);
    });

    test('should create SendGrid service when provider is "sendgrid"', () => {
      setEnvVars('sendgrid');
      process.env.CRUNCHYCONE_EMAIL_PROVIDER = 'sendgrid';
      
      const service = createEmailService();
      
      expect(service).toBeInstanceOf(SendGridEmailService);
    });

    test('should create Resend service when provider is "resend"', () => {
      setEnvVars('resend');
      process.env.CRUNCHYCONE_EMAIL_PROVIDER = 'resend';
      
      const service = createEmailService();
      
      expect(service).toBeInstanceOf(ResendEmailService);
    });

    test('should create Amazon SES service when provider is "ses"', () => {
      setEnvVars('ses');
      process.env.CRUNCHYCONE_EMAIL_PROVIDER = 'ses';
      
      const service = createEmailService();
      
      expect(service).toBeInstanceOf(AmazonSESEmailService);
    });

    test('should create Mailgun service when provider is "mailgun"', () => {
      setEnvVars('mailgun');
      process.env.CRUNCHYCONE_EMAIL_PROVIDER = 'mailgun';
      
      const service = createEmailService();
      
      expect(service).toBeInstanceOf(MailgunEmailService);
    });

    test('should create CrunchyCone service when provider is "crunchycone"', () => {
      setEnvVars('crunchycone');
      process.env.CRUNCHYCONE_EMAIL_PROVIDER = 'crunchycone';
      
      const service = createEmailService();
      
      expect(service).toBeInstanceOf(CrunchyConeEmailService);
    });

    test('should create Console service when provider is "console"', () => {
      process.env.CRUNCHYCONE_EMAIL_PROVIDER = 'console';
      
      const service = createEmailService();
      
      expect(service).toBeInstanceOf(ConsoleEmailService);
    });

    test('should default to Console when no provider is set', () => {
      delete process.env.CRUNCHYCONE_EMAIL_PROVIDER;
      
      const service = createEmailService();
      
      expect(service).toBeInstanceOf(ConsoleEmailService);
    });

    test('should handle case-insensitive provider names', () => {
      setEnvVars('smtp');
      process.env.CRUNCHYCONE_EMAIL_PROVIDER = 'SMTP';
      
      const service = createEmailService();
      
      expect(service).toBeInstanceOf(SMTPEmailService);
    });

    test('should handle mixed-case provider names', () => {
      setEnvVars('smtp');
      process.env.CRUNCHYCONE_EMAIL_PROVIDER = 'SmTp';
      
      const service = createEmailService();
      
      expect(service).toBeInstanceOf(SMTPEmailService);
    });

    test('should throw error for unsupported provider', () => {
      process.env.CRUNCHYCONE_EMAIL_PROVIDER = 'invalid-provider';
      
      expect(() => createEmailService()).toThrow(
        'Unsupported email provider: invalid-provider. Supported providers: smtp, sendgrid, resend, ses, mailgun, crunchycone, console',
      );
    });

    test('should throw error with helpful message for typos', () => {
      process.env.CRUNCHYCONE_EMAIL_PROVIDER = 'sendgrind'; // typo
      
      expect(() => createEmailService()).toThrow(
        'Unsupported email provider: sendgrind. Supported providers: smtp, sendgrid, resend, ses, mailgun, crunchycone, console',
      );
    });

    test('should handle empty string provider', () => {
      process.env.CRUNCHYCONE_EMAIL_PROVIDER = '';
      
      const service = createEmailService();
      
      expect(service).toBeInstanceOf(ConsoleEmailService);
    });

    test('should handle whitespace in provider name', () => {
      setEnvVars('smtp');
      process.env.CRUNCHYCONE_EMAIL_PROVIDER = ' smtp ';
      
      const service = createEmailService();
      
      expect(service).toBeInstanceOf(SMTPEmailService);
    });
  });

  describe('getEmailService', () => {
    test('should be an alias for createEmailService', () => {
      setEnvVars('smtp');
      process.env.CRUNCHYCONE_EMAIL_PROVIDER = 'smtp';
      
      const service1 = createEmailService();
      const service2 = getEmailService();
      
      expect(service1.constructor).toBe(service2.constructor);
      expect(service1).toBeInstanceOf(SMTPEmailService);
      expect(service2).toBeInstanceOf(SMTPEmailService);
    });

    test('should create new instances on each call', () => {
      process.env.CRUNCHYCONE_EMAIL_PROVIDER = 'crunchycone';
      
      const service1 = getEmailService();
      const service2 = getEmailService();
      
      expect(service1).not.toBe(service2); // Different instances
      expect(service1.constructor).toBe(service2.constructor); // Same class
    });
  });

  describe('Provider-specific error handling', () => {
    test('should propagate SMTP configuration errors', () => {
      process.env.CRUNCHYCONE_EMAIL_PROVIDER = 'smtp';
      // Don't set SMTP environment variables
      
      expect(() => createEmailService()).toThrow('Failed to load SMTP provider:');
    });

    test('should create SendGrid service when dependencies are available', () => {
      setEnvVars('sendgrid');
      process.env.CRUNCHYCONE_EMAIL_PROVIDER = 'sendgrid';
      
      const service = createEmailService();
      
      expect(service).toBeInstanceOf(SendGridEmailService);
    });

    test('should create Resend service when dependencies are available', () => {
      setEnvVars('resend');
      process.env.CRUNCHYCONE_EMAIL_PROVIDER = 'resend';
      
      const service = createEmailService();
      
      expect(service).toBeInstanceOf(ResendEmailService);
    });

    test('should create Amazon SES service when dependencies are available', () => {
      setEnvVars('ses');
      process.env.CRUNCHYCONE_EMAIL_PROVIDER = 'ses';
      
      const service = createEmailService();
      
      expect(service).toBeInstanceOf(AmazonSESEmailService);
    });

    test('should create Mailgun service when dependencies are available', () => {
      setEnvVars('mailgun');
      process.env.CRUNCHYCONE_EMAIL_PROVIDER = 'mailgun';
      
      const service = createEmailService();
      
      expect(service).toBeInstanceOf(MailgunEmailService);
    });

    test('should not throw for CrunchyCone provider without env vars', () => {
      setEnvVars('crunchycone');
      process.env.CRUNCHYCONE_EMAIL_PROVIDER = 'crunchycone';
      // CrunchyCone provider with API key should not throw
      
      expect(() => createEmailService()).not.toThrow();
    });

    test('should not throw for Console provider without env vars', () => {
      process.env.CRUNCHYCONE_EMAIL_PROVIDER = 'console';
      // Console doesn't require any environment variables
      
      expect(() => createEmailService()).not.toThrow();
    });
  });

  describe('All supported providers', () => {
    const supportedProviders = [
      { name: 'smtp', class: SMTPEmailService, env: 'smtp' },
      { name: 'sendgrid', class: SendGridEmailService, env: 'sendgrid' },
      { name: 'resend', class: ResendEmailService, env: 'resend' },
      { name: 'ses', class: AmazonSESEmailService, env: 'ses' },
      { name: 'mailgun', class: MailgunEmailService, env: 'mailgun' },
      { name: 'crunchycone', class: CrunchyConeEmailService, env: 'crunchycone' },
      { name: 'console', class: ConsoleEmailService, env: null },
    ];

    test.each(supportedProviders)('should create $name service correctly', ({ name, class: ServiceClass, env }) => {
      if (env) {
        setEnvVars(env as any);
      }
      process.env.CRUNCHYCONE_EMAIL_PROVIDER = name;
      
      const service = createEmailService();
      
      expect(service).toBeInstanceOf(ServiceClass);
    });
  });
});