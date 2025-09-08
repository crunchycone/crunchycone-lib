// Core email services (no optional dependencies)
export { EmailService, EmailParams, EmailResponse, EmailProvider, EmailAddress, EmailRecipient } from './services/email/types';
export { createEmailService, getEmailService } from './services/email/factory';

// Email utilities (no optional dependencies)
export { 
  isEmailAddress, 
  validateEmail, 
  normalizeEmailRecipient, 
  formatEmailForSMTP, 
  formatEmailForProvider, 
} from './services/email/utils';

// Email Template Services - Import directly to avoid loading engines at import time
export { 
  EmailTemplateOptions,
  TemplateData,
  RenderedTemplate,
  TemplateMetadata,
  TemplateProvider,
  EmailTemplateEngine,
  TemplateProviderType,
} from './services/email/templates/types';
export { FilesystemTemplateProvider } from './services/email/templates/providers/filesystem';
export { 
  createTemplateProvider, 
  createEmailTemplateEngine, 
  getEmailTemplateEngine, 
} from './services/email/templates/factory';
export { 
  EmailTemplateService, 
  getEmailTemplateService, 
  sendTemplatedEmail, 
} from './services/email/templates/service';

// Note: Template engines are available via specific imports:
// - import { MJMLLiquidEngine } from 'crunchycone-lib/email/templates/engines/mjml-liquid'

// Authentication utilities (no optional dependencies)
export * from './auth';

// CrunchyCone API and Authentication services
export { 
  CrunchyConeApiClient, 
  validateApiKey, 
  getCurrentUser, 
  getProjectInfo,
  type CrunchyConeApiConfig,
  type CrunchyConeUser,
  type CrunchyConeProject,
  type CrunchyConeApiResponse,
  type CrunchyConeAuthResponse,
} from './services/crunchycone-api';
export { 
  createCrunchyConeAuthService, 
  checkCrunchyConeAuth, 
  CrunchyConeAuthService,
  type CrunchyConeAuthResult,
  type CrunchyConeAuthServiceConfig,
} from './services/crunchycone-auth';

// CrunchyCone Environment and Secrets Management
export {
  CrunchyConeEnvironmentService,
  createCrunchyConeEnvironmentService,
  getCrunchyConeEnvironmentService,
  isPlatformEnvironment,
  getProviderType,
  LocalEnvironmentProvider,
  RemoteEnvironmentProvider,
  type EnvironmentProvider,
  type EnvironmentServiceConfig,
  type EnvironmentOperationResult,
  type EnvironmentVariablesUpdate,
  type SecretsUpdate,
  type ProviderType,
} from './services/environment';

// Note: Storage services and individual email/storage providers are available via modular imports:
// - import { StorageService } from 'crunchycone-lib/storage'
// - import { AmazonSESEmailService } from 'crunchycone-lib/email/providers/amazon-ses'
// - import { S3CompatibleProvider } from 'crunchycone-lib/storage/providers/s3'