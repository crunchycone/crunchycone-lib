export { 
  EmailTemplateOptions,
  TemplateData,
  RenderedTemplate,
  TemplateMetadata,
  TemplateProvider,
  EmailTemplateEngine,
  TemplateProviderType,
} from './types';

export { FilesystemTemplateProvider } from './providers/filesystem';
// Note: MJMLLiquidEngine is available via specific import to avoid loading MJML at import time:
// - import { MJMLLiquidEngine } from 'crunchycone-lib/email/templates/engines/mjml-liquid'
export { 
  createTemplateProvider, 
  createEmailTemplateEngine, 
  getEmailTemplateEngine, 
} from './factory';
export { 
  EmailTemplateService, 
  getEmailTemplateService, 
  sendTemplatedEmail, 
} from './service';