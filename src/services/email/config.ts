import { ProviderConfig, SubAccountConfig } from './types';

export interface EmailConfig {
  // CrunchyCone Email Service Configuration
  crunchycone?: {
    apiKey?: string;
    baseUrl?: string;
    projectId?: string;
    timeout?: number;
  };

  // SendGrid Configuration
  sendgrid?: {
    apiKey?: string;
    defaultFromEmail?: string;
    defaultFromName?: string;
    webhookVerifyKey?: string;
    clickTracking?: boolean;
    openTracking?: boolean;
    subAccounts?: Record<string, SubAccountConfig>;
  };

  // Rate Limiting Configuration
  rateLimits?: {
    regular?: number; // Per hour for regular API keys
    cli?: number; // Per hour for CLI API keys
    sensitive?: number; // Per hour for sensitive emails
  };

  // Default settings
  defaults?: {
    fromEmail?: string;
    fromName?: string;
    timeout?: number;
  };
}

export class EmailConfigManager {
  private config: EmailConfig;

  constructor(config: EmailConfig = {}) {
    this.config = this.mergeWithEnvironment(config);
  }

  private mergeWithEnvironment(config: EmailConfig): EmailConfig {
    return {
      crunchycone: {
        apiKey: config.crunchycone?.apiKey || process.env.CRUNCHYCONE_API_KEY,
        baseUrl: config.crunchycone?.baseUrl || process.env.CRUNCHYCONE_API_URL || 'https://api.crunchycone.com',
        projectId: config.crunchycone?.projectId || process.env.CRUNCHYCONE_PROJECT_ID,
        timeout: config.crunchycone?.timeout || Number(process.env.CRUNCHYCONE_EMAIL_TIMEOUT) || 30000,
        ...config.crunchycone,
      },
      sendgrid: {
        apiKey: config.sendgrid?.apiKey || process.env.SENDGRID_API_KEY,
        defaultFromEmail: config.sendgrid?.defaultFromEmail || process.env.SENDGRID_DEFAULT_FROM_EMAIL || 'noreply@crunchycone.com',
        defaultFromName: config.sendgrid?.defaultFromName || process.env.SENDGRID_DEFAULT_FROM_NAME || 'CrunchyCone Platform',
        webhookVerifyKey: config.sendgrid?.webhookVerifyKey,
        clickTracking: config.sendgrid?.clickTracking ?? (process.env.SENDGRID_CLICK_TRACKING !== 'false'),
        openTracking: config.sendgrid?.openTracking ?? (process.env.SENDGRID_OPEN_TRACKING !== 'false'),
        subAccounts: config.sendgrid?.subAccounts || this.parseSubAccountsFromEnv(),
        ...config.sendgrid,
      },
      rateLimits: {
        regular: config.rateLimits?.regular || Number(process.env.CRUNCHYCONE_EMAIL_RATE_LIMIT_REGULAR) || 1000,
        cli: config.rateLimits?.cli || Number(process.env.CRUNCHYCONE_EMAIL_RATE_LIMIT_CLI) || 100,
        sensitive: config.rateLimits?.sensitive || Number(process.env.CRUNCHYCONE_EMAIL_RATE_LIMIT_SENSITIVE) || 100,
        ...config.rateLimits,
      },
      defaults: {
        fromEmail: config.defaults?.fromEmail || process.env.CRUNCHYCONE_EMAIL_DEFAULT_FROM_EMAIL || 'noreply@crunchycone.com',
        fromName: config.defaults?.fromName || process.env.CRUNCHYCONE_EMAIL_DEFAULT_FROM_NAME || 'CrunchyCone Platform',
        timeout: config.defaults?.timeout || 30000,
        ...config.defaults,
      },
    };
  }

  private parseSubAccountsFromEnv(): Record<string, SubAccountConfig> | undefined {
    const subAccountsJson = process.env.SENDGRID_SUB_ACCOUNTS;
    if (!subAccountsJson) {
      return undefined;
    }

    try {
      return JSON.parse(subAccountsJson);
    } catch (error) {
      console.warn('Failed to parse SENDGRID_SUB_ACCOUNTS environment variable:', error);
      return undefined;
    }
  }

  getCrunchyConeConfig() {
    if (!this.config.crunchycone?.apiKey) {
      throw new Error('CrunchyCone API key is required. Set CRUNCHYCONE_API_KEY environment variable or provide in config.');
    }
    return this.config.crunchycone;
  }

  getSendGridConfig(): ProviderConfig {
    if (!this.config.sendgrid?.apiKey) {
      throw new Error('SendGrid API key is required. Set SENDGRID_API_KEY environment variable or provide in config.');
    }

    return {
      apiKey: this.config.sendgrid.apiKey,
      defaultFromEmail: this.config.sendgrid.defaultFromEmail,
      defaultFromName: this.config.sendgrid.defaultFromName,
      webhookVerifyKey: this.config.sendgrid.webhookVerifyKey,
      subAccounts: this.config.sendgrid.subAccounts,
    };
  }

  getRateLimits() {
    return this.config.rateLimits!;
  }

  getDefaults() {
    return this.config.defaults!;
  }

  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate CrunchyCone config if provided
    if (this.config.crunchycone) {
      if (!this.config.crunchycone.apiKey) {
        errors.push('CrunchyCone API key is required');
      }
      if (!this.config.crunchycone.baseUrl) {
        errors.push('CrunchyCone base URL is required');
      }
    }

    // Validate SendGrid config if provided
    if (this.config.sendgrid) {
      if (!this.config.sendgrid.apiKey) {
        errors.push('SendGrid API key is required');
      }
      if (!this.config.sendgrid.defaultFromEmail) {
        errors.push('SendGrid default from email is required');
      }
    }

    // Validate rate limits
    if (this.config.rateLimits) {
      if (this.config.rateLimits.regular && this.config.rateLimits.regular <= 0) {
        errors.push('Regular rate limit must be positive');
      }
      if (this.config.rateLimits.cli && this.config.rateLimits.cli <= 0) {
        errors.push('CLI rate limit must be positive');
      }
      if (this.config.rateLimits.sensitive && this.config.rateLimits.sensitive <= 0) {
        errors.push('Sensitive rate limit must be positive');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // Static helper methods for common configurations
  static createForProduction(): EmailConfigManager {
    return new EmailConfigManager({
      rateLimits: {
        regular: 1000,
        cli: 100,
        sensitive: 100,
      },
    });
  }

  static createForDevelopment(): EmailConfigManager {
    return new EmailConfigManager({
      rateLimits: {
        regular: 100,
        cli: 50,
        sensitive: 25,
      },
      defaults: {
        timeout: 60000, // Longer timeout for development
      },
    });
  }

  static createForTesting(): EmailConfigManager {
    return new EmailConfigManager({
      rateLimits: {
        regular: 10,
        cli: 5,
        sensitive: 2,
      },
      defaults: {
        timeout: 10000, // Shorter timeout for tests
      },
    });
  }
}

// Environment-based configuration loader
export function loadEmailConfig(): EmailConfigManager {
  const environment = process.env.NODE_ENV || 'development';

  switch (environment) {
    case 'production':
      return EmailConfigManager.createForProduction();
    case 'test':
      return EmailConfigManager.createForTesting();
    default:
      return EmailConfigManager.createForDevelopment();
  }
}

// Export commonly used configurations
export const emailConfig = loadEmailConfig();