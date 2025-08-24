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
export { MJMLLiquidEngine } from './engines/mjml-liquid';
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