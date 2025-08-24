import { TemplateProvider, EmailTemplateEngine, TemplateProviderType } from './types';
import { FilesystemTemplateProvider } from './providers/filesystem';
import { MJMLLiquidEngine } from './engines/mjml-liquid';

export function createTemplateProvider(type?: TemplateProviderType): TemplateProvider {
  const providerType = type || (process.env.CRUNCHYCONE_EMAIL_TEMPLATE_PROVIDER as TemplateProviderType) || 'filesystem';
  
  switch (providerType) {
    case 'filesystem':
      return new FilesystemTemplateProvider();
    case 'database':
      throw new Error('Database template provider not yet implemented');
    default:
      throw new Error(`Unknown template provider type: ${providerType}`);
  }
}

export function createEmailTemplateEngine(provider?: TemplateProvider): EmailTemplateEngine {
  const templateProvider = provider || createTemplateProvider();
  return new MJMLLiquidEngine(templateProvider);
}

// Global instance
let globalEmailTemplateEngine: EmailTemplateEngine | null = null;

export function getEmailTemplateEngine(): EmailTemplateEngine {
  if (!globalEmailTemplateEngine) {
    globalEmailTemplateEngine = createEmailTemplateEngine();
  }
  return globalEmailTemplateEngine;
}