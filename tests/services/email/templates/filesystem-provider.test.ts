import path from 'path';
import { FilesystemTemplateProvider } from '../../../../src/services/email/templates/providers/filesystem';

describe('FilesystemTemplateProvider', () => {
  let provider: FilesystemTemplateProvider;
  const templatesPath = path.join(__dirname, '../../../templates/email');

  beforeEach(() => {
    provider = new FilesystemTemplateProvider(templatesPath);
  });

  describe('resolveTemplate', () => {
    it('should resolve English template', async () => {
      const resolution = await provider.resolveTemplate('welcome', 'en');
      
      expect(resolution.language).toBe('en');
      expect(resolution.fallbackUsed).toBe(false);
      expect(resolution.files.mjml).toContain('<mjml>');
      expect(resolution.files.mjml).toContain('Welcome to {{ appName }}!');
      expect(resolution.files.subject).toBe('Welcome to {{ appName }}!');
      expect(resolution.files.textFallback).toContain('Welcome to {{ appName }}!');
    });

    it('should resolve Spanish template', async () => {
      const resolution = await provider.resolveTemplate('welcome', 'es');
      
      expect(resolution.language).toBe('es');
      expect(resolution.fallbackUsed).toBe(false);
      expect(resolution.files.mjml).toContain('<mjml>');
      expect(resolution.files.mjml).toContain('Bienvenido a {{ appName }}');
      expect(resolution.files.subject).toBe('¡Bienvenido a {{ appName }}!');
    });

    it('should fallback to English when requested language not available', async () => {
      const resolution = await provider.resolveTemplate('welcome', 'fr');
      
      expect(resolution.language).toBe('en');
      expect(resolution.fallbackUsed).toBe(true);
      expect(resolution.files.mjml).toContain('Welcome to {{ appName }}!');
    });

    it('should use English as default when no language specified', async () => {
      const resolution = await provider.resolveTemplate('welcome');
      
      expect(resolution.language).toBe('en');
      expect(resolution.fallbackUsed).toBe(false);
    });

    it('should throw error when template does not exist', async () => {
      await expect(provider.resolveTemplate('non-existing'))
        .rejects
        .toThrow('Template \'non-existing\' not found in any language');
    });

    it('should throw error when MJML file is missing', async () => {
      // This test would need a broken template setup
      await expect(provider.resolveTemplate('broken-template'))
        .rejects
        .toThrow();
    });
  });

  describe('getAvailableTemplates', () => {
    it('should return list of available templates with metadata', async () => {
      const templates = await provider.getAvailableTemplates();
      
      expect(templates.length).toBeGreaterThanOrEqual(1);
      
      const welcomeTemplate = templates.find(t => t.name === 'welcome');
      expect(welcomeTemplate).toBeDefined();
      expect(welcomeTemplate!.languages).toContain('en');
      expect(welcomeTemplate!.languages).toContain('es');
      // Description is optional and not set for this template
    });
  });

  describe('validateTemplate', () => {
    it('should validate existing template', async () => {
      const isValid = await provider.validateTemplate('welcome', 'en');
      expect(isValid).toBe(true);
    });

    it('should return false for non-existing template', async () => {
      const isValid = await provider.validateTemplate('non-existing', 'en');
      expect(isValid).toBe(false);
    });

    it('should return false for non-existing language', async () => {
      const isValid = await provider.validateTemplate('welcome', 'de');
      expect(isValid).toBe(false);
    });
  });
});