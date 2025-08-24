import path from 'path';
import { EmailTemplateService } from '../../../../src/services/email/templates/service';
import { FilesystemTemplateProvider } from '../../../../src/services/email/templates/providers/filesystem';
import { MJMLLiquidEngine } from '../../../../src/services/email/templates/engines/mjml-liquid';
import { EmailService, EmailParams, EmailResponse } from '../../../../src/services/email/types';

// Mock email service for testing
class MockEmailService implements EmailService {
  public sentEmails: EmailParams[] = [];

  async sendEmail(params: EmailParams): Promise<EmailResponse> {
    this.sentEmails.push(params);
    return { success: true, messageId: 'test-id-123' };
  }

  reset() {
    this.sentEmails = [];
  }
}

describe('EmailTemplateService', () => {
  let emailTemplateService: EmailTemplateService;
  let mockEmailService: MockEmailService;
  let templateProvider: FilesystemTemplateProvider;

  beforeEach(() => {
    mockEmailService = new MockEmailService();
    const templatesPath = path.join(__dirname, '../../../templates/email');
    templateProvider = new FilesystemTemplateProvider(templatesPath);
    const engine = new MJMLLiquidEngine(templateProvider);
    emailTemplateService = new EmailTemplateService(mockEmailService);
    // Override the template engine for testing
    (emailTemplateService as any).templateEngine = engine;
  });

  afterEach(() => {
    mockEmailService.reset();
  });

  describe('sendTemplatedEmail', () => {
    it('should send email using welcome template in English', async () => {
      await emailTemplateService.sendTemplatedEmail({
        template: 'welcome',
        to: 'test@example.com',
        language: 'en',
        data: {
          name: 'John Doe',
          appName: 'CrunchyCone',
          supportEmail: 'support@crunchycone.com',
          ctaUrl: 'https://app.crunchycone.com',
          ctaText: 'Get Started',
          isTrialUser: true,
          trialDays: 14,
        },
      });

      expect(mockEmailService.sentEmails).toHaveLength(1);
      const sentEmail = mockEmailService.sentEmails[0];
      
      expect(sentEmail.to).toEqual(['test@example.com']);
      expect(sentEmail.subject).toBe('Welcome to CrunchyCone!');
      expect(sentEmail.htmlBody).toContain('Welcome to CrunchyCone!');
      expect(sentEmail.htmlBody).toContain('John Doe');
      expect(sentEmail.htmlBody).toContain('14-day free trial');
      expect(sentEmail.textBody).toContain('Welcome to CrunchyCone!');
      expect(sentEmail.textBody).toContain('John Doe');
    });

    it('should send email using welcome template in Spanish', async () => {
      await emailTemplateService.sendTemplatedEmail({
        template: 'welcome',
        to: 'test@example.com',
        language: 'es',
        data: {
          name: 'Juan Pérez',
          appName: 'CrunchyCone',
          supportEmail: 'support@crunchycone.com',
          ctaUrl: 'https://app.crunchycone.com',
          ctaText: 'Comenzar',
          isTrialUser: true,
          trialDays: 14,
        },
      });

      expect(mockEmailService.sentEmails).toHaveLength(1);
      const sentEmail = mockEmailService.sentEmails[0];
      
      expect(sentEmail.subject).toBe('¡Bienvenido a CrunchyCone!');
      expect(sentEmail.htmlBody).toContain('Bienvenido a CrunchyCone');
      expect(sentEmail.htmlBody).toContain('Juan Pérez');
      expect(sentEmail.htmlBody).toContain('prueba gratuita de 14 dias');
    });

    it('should handle multiple recipients', async () => {
      await emailTemplateService.sendTemplatedEmail({
        template: 'welcome',
        to: ['test1@example.com', 'test2@example.com'],
        data: {
          name: 'John Doe',
          appName: 'CrunchyCone',
          supportEmail: 'support@crunchycone.com',
        },
      });

      expect(mockEmailService.sentEmails).toHaveLength(1);
      const sentEmail = mockEmailService.sentEmails[0];
      expect(sentEmail.to).toEqual(['test1@example.com', 'test2@example.com']);
    });

    it('should fallback to English when template not found in requested language', async () => {
      await emailTemplateService.sendTemplatedEmail({
        template: 'welcome',
        to: 'test@example.com',
        language: 'fr', // French template doesn't exist, should fallback to English
        data: {
          name: 'John Doe',
          appName: 'CrunchyCone',
          supportEmail: 'support@crunchycone.com',
        },
      });

      expect(mockEmailService.sentEmails).toHaveLength(1);
      const sentEmail = mockEmailService.sentEmails[0];
      expect(sentEmail.subject).toBe('Welcome to CrunchyCone!'); // English fallback
    });
  });

  describe('renderTemplate', () => {
    it('should render template without sending email', async () => {
      const rendered = await emailTemplateService.renderTemplate({
        template: 'welcome',
        to: 'test@example.com',
        language: 'en',
        data: {
          name: 'John Doe',
          appName: 'CrunchyCone',
          supportEmail: 'support@crunchycone.com',
        },
      });

      expect(rendered.subject).toBe('Welcome to CrunchyCone!');
      expect(rendered.html).toContain('Welcome to CrunchyCone!');
      expect(rendered.text).toContain('Welcome to CrunchyCone!');
      expect(rendered.metadata.language).toBe('en');
      expect(rendered.metadata.fallbackUsed).toBe(false);
      expect(mockEmailService.sentEmails).toHaveLength(0); // No email sent
    });
  });

  describe('getAvailableTemplates', () => {
    it('should return list of available templates', async () => {
      const templates = await emailTemplateService.getAvailableTemplates();
      
      expect(templates).toHaveLength(1);
      expect(templates[0].name).toBe('welcome');
      expect(templates[0].languages).toContain('en');
      expect(templates[0].languages).toContain('es');
    });
  });

  describe('validateTemplate', () => {
    it('should validate existing template', async () => {
      const isValid = await emailTemplateService.validateTemplate('welcome', 'en');
      expect(isValid).toBe(true);
    });

    it('should return false for non-existing template', async () => {
      const isValid = await emailTemplateService.validateTemplate('non-existing', 'en');
      expect(isValid).toBe(false);
    });
  });

  describe('previewTemplate', () => {
    it('should preview template with sample data', async () => {
      const preview = await emailTemplateService.previewTemplate('welcome', {
        name: 'Preview User',
        appName: 'CrunchyCone',
        supportEmail: 'support@crunchycone.com',
      }, 'en');

      expect(preview.subject).toBe('Welcome to CrunchyCone!');
      expect(preview.html).toContain('Preview User');
      expect(preview.text).toContain('Preview User');
    });
  });
});