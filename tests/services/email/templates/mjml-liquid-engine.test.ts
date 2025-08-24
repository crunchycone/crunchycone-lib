import path from 'path';
import { MJMLLiquidEngine } from '../../../../src/services/email/templates/engines/mjml-liquid';
import { FilesystemTemplateProvider } from '../../../../src/services/email/templates/providers/filesystem';

describe('MJMLLiquidEngine', () => {
  let engine: MJMLLiquidEngine;
  let provider: FilesystemTemplateProvider;

  beforeEach(() => {
    const templatesPath = path.join(__dirname, '../../../templates/email');
    provider = new FilesystemTemplateProvider(templatesPath);
    engine = new MJMLLiquidEngine(provider);
  });

  describe('renderTemplate', () => {
    it('should render MJML template with Liquid variables', async () => {
      const result = await engine.renderTemplate({
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

      expect(result.subject).toBe('Welcome to CrunchyCone!');
      expect(result.html).toContain('John Doe');
      expect(result.html).toContain('CrunchyCone');
      expect(result.html).toContain('14-day free trial');
      expect(result.html).toContain('https://app.crunchycone.com');
      expect(result.html).toContain('Get Started');
      expect(result.text).toContain('John Doe');
      expect(result.text).toContain('CrunchyCone');
      expect(result.metadata.language).toBe('en');
      expect(result.metadata.fallbackUsed).toBe(false);
    });

    it('should handle conditional content', async () => {
      const resultWithTrial = await engine.renderTemplate({
        template: 'welcome',
        to: 'test@example.com',
        data: {
          name: 'John Doe',
          appName: 'CrunchyCone',
          supportEmail: 'support@crunchycone.com',
          isTrialUser: true,
          trialDays: 7,
        },
      });

      expect(resultWithTrial.html).toContain('7-day free trial');

      const resultWithoutTrial = await engine.renderTemplate({
        template: 'welcome',
        to: 'test@example.com',
        data: {
          name: 'John Doe',
          appName: 'CrunchyCone',
          supportEmail: 'support@crunchycone.com',
          isTrialUser: false,
        },
      });

      expect(resultWithoutTrial.html).not.toContain('free trial');
    });

    it('should use default filter', async () => {
      const result = await engine.renderTemplate({
        template: 'welcome',
        to: 'test@example.com',
        data: {
          name: 'John Doe',
          appName: 'CrunchyCone',
          supportEmail: 'support@crunchycone.com',
          ctaUrl: 'https://app.crunchycone.com',
          // ctaText not provided, should use default
        },
      });

      expect(result.html).toContain('Get Started'); // Default value
    });

    it('should generate text from HTML when no text template provided', async () => {
      const result = await engine.renderTemplate({
        template: 'welcome',
        to: 'test@example.com',
        data: {
          name: 'John Doe',
          appName: 'CrunchyCone',
          supportEmail: 'support@crunchycone.com',
        },
      });

      expect(result.text).toContain('John Doe');
      expect(result.text).toContain('CrunchyCone');
      expect(result.text).not.toContain('<'); // Should not contain HTML tags
    });

    it('should handle Spanish templates', async () => {
      const result = await engine.renderTemplate({
        template: 'welcome',
        to: 'test@example.com',
        language: 'es',
        data: {
          name: 'Juan Pérez',
          appName: 'CrunchyCone',
          supportEmail: 'support@crunchycone.com',
        },
      });

      expect(result.subject).toBe('¡Bienvenido a CrunchyCone!');
      expect(result.html).toContain('Juan Pérez');
      expect(result.html).toContain('Bienvenido a CrunchyCone');
      expect(result.metadata.language).toBe('es');
    });

    it('should throw error on invalid MJML', async () => {
      await expect(engine.renderTemplate({
        template: 'invalid-mjml',
        to: 'test@example.com',
        data: {},
      })).rejects.toThrow();
    });
  });

  describe('validateTemplate', () => {
    it('should validate template by attempting to render', async () => {
      const isValid = await engine.validateTemplate('welcome', 'en');
      expect(isValid).toBe(true);
    });

    it('should return false for invalid template', async () => {
      const isValid = await engine.validateTemplate('non-existing', 'en');
      expect(isValid).toBe(false);
    });
  });

  describe('previewTemplate', () => {
    it('should render template for preview', async () => {
      const preview = await engine.previewTemplate('welcome', {
        name: 'Preview User',
        appName: 'CrunchyCone',
        supportEmail: 'support@crunchycone.com',
      }, 'en');

      expect(preview.subject).toBe('Welcome to CrunchyCone!');
      expect(preview.html).toContain('Preview User');
      expect(preview.text).toContain('Preview User');
    });
  });

  describe('getAvailableTemplates', () => {
    it('should delegate to provider', async () => {
      const templates = await engine.getAvailableTemplates();
      expect(templates).toHaveLength(1);
      expect(templates[0].name).toBe('welcome');
    });
  });
});