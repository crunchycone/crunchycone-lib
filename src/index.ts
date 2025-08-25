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

// Email Template Services (no optional dependencies)
export * from './services/email/templates';

// Authentication utilities (no optional dependencies)
export * from './auth';

// Note: Storage services and individual email/storage providers are available via modular imports:
// - import { StorageService } from 'crunchycone-lib/storage'
// - import { AmazonSESEmailService } from 'crunchycone-lib/email/providers/amazon-ses'
// - import { S3CompatibleProvider } from 'crunchycone-lib/storage/providers/s3'