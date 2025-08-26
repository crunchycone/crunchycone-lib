# Email Providers System

The CrunchyCone library provides a unified email service abstraction that supports multiple email providers through a clean, consistent interface. This allows you to easily switch between providers or add new ones without changing your application code.

## Supported Providers

| Provider | Package Required | Environment Variables |
|----------|------------------|----------------------|
| **Console** ⭐ | Built-in (no external deps) | None (logs to console - perfect for development) |
| **SMTP** | `nodemailer` (included) | `CRUNCHYCONE_SMTP_HOST`, `CRUNCHYCONE_SMTP_PORT`, `CRUNCHYCONE_SMTP_USER`, `CRUNCHYCONE_SMTP_PASS` |
| **SendGrid** | `@sendgrid/mail` (included) | `CRUNCHYCONE_SENDGRID_API_KEY`, `CRUNCHYCONE_SENDGRID_FROM` |
| **Resend** | `resend` (included) | `CRUNCHYCONE_RESEND_API_KEY`, `CRUNCHYCONE_RESEND_FROM` |
| **Amazon SES** | `aws-sdk` (peer dependency) | `CRUNCHYCONE_AWS_REGION`, `CRUNCHYCONE_AWS_ACCESS_KEY_ID`, `CRUNCHYCONE_AWS_SECRET_ACCESS_KEY`, `CRUNCHYCONE_SES_FROM` |
| **Mailgun** | `mailgun-js` (peer dependency) | `CRUNCHYCONE_MAILGUN_API_KEY`, `CRUNCHYCONE_MAILGUN_DOMAIN`, `CRUNCHYCONE_MAILGUN_FROM` |
| **CrunchyCone** | Built-in (no external deps) | `CRUNCHYCONE_API_KEY` (required), `CRUNCHYCONE_EMAIL_BASE_URL` (optional) |

## Quick Start

### Basic Usage

```typescript
import { createEmailService } from 'crunchycone-lib';

// Create email service (uses environment variables for configuration)
const emailService = createEmailService('sendgrid');

// Send email
await emailService.sendEmail({
  to: 'user@example.com',
  subject: 'Hello World',
  textBody: 'This is a test email',
  htmlBody: '<p>This is a <strong>test</strong> email</p>',
  from: 'noreply@myapp.com'
});
```

### Provider Availability Checking

Check if email providers are available before using them:

```typescript
import { isEmailProviderAvailable, getAvailableEmailProviders, createEmailService } from 'crunchycone-lib';

// Check if specific providers are available (dependencies installed)
const sendGridAvailable = await isEmailProviderAvailable('sendgrid');
const sesAvailable = await isEmailProviderAvailable('ses');

console.log('SendGrid available:', sendGridAvailable);
console.log('Amazon SES available:', sesAvailable);

// Get all available email providers
const availableProviders = await getAvailableEmailProviders();
console.log('Available providers:', availableProviders);
// Example output: ['console', 'smtp', 'crunchycone', 'mailgun']
// (SendGrid, SES, Resend only included if their dependencies are installed)

// Check availability on service instances
const emailService = createEmailService('console');
const available = await emailService.isAvailable();
console.log('Console service available:', available); // Always true

// Gracefully handle unavailable providers
if (await isEmailProviderAvailable('sendgrid')) {
  const service = createEmailService('sendgrid');
  await service.sendEmail(emailParams);
} else {
  console.log('SendGrid not available, falling back to console');
  const service = createEmailService('console');
  await service.sendEmail(emailParams);
}
```

**Provider Availability by Type:**

- **Always Available** (no optional dependencies): `console`, `smtp`, `crunchycone`, `mailgun`
- **Conditionally Available** (require optional dependencies): `sendgrid`, `resend`, `ses`
- **Results are cached** for 5 minutes to improve performance

### Using Environment Variables

Set the `EMAIL_PROVIDER` environment variable to automatically select the provider:

```bash
# Use Console (default - perfect for development)
CRUNCHYCONE_EMAIL_PROVIDER=console
# No other configuration needed!

# Use SendGrid
CRUNCHYCONE_EMAIL_PROVIDER=sendgrid
CRUNCHYCONE_SENDGRID_API_KEY=your_api_key
CRUNCHYCONE_SENDGRID_FROM=noreply@myapp.com

# Use SMTP
CRUNCHYCONE_EMAIL_PROVIDER=smtp
CRUNCHYCONE_SMTP_HOST=smtp.example.com
CRUNCHYCONE_SMTP_PORT=587
CRUNCHYCONE_SMTP_USER=your_email@example.com
CRUNCHYCONE_SMTP_PASS=your_password
CRUNCHYCONE_SMTP_FROM=your_email@example.com
```

```typescript
import { getEmailService } from 'crunchycone-lib';

// Uses EMAIL_PROVIDER environment variable
const emailService = getEmailService();
await emailService.sendEmail(params);
```

## Provider Configuration

### Console Provider (Default)

**Dependencies**: None  
**Environment Variables**: None required

The Console provider is perfect for development and testing. It prints beautifully formatted email information to the console instead of actually sending emails.

```bash
# Set explicitly (though it's already the default)
CRUNCHYCONE_EMAIL_PROVIDER=console
```

**Example Output**:
```
================================================================================
📧 CONSOLE EMAIL PROVIDER - EMAIL SENT
================================================================================
⏰ Timestamp: 2024-01-15T10:30:45.123Z
🆔 Message ID: console-1705312245123-abc123def

📤 FROM: noreply@myapp.com
📥 TO: user@example.com
📋 SUBJECT: Welcome to Our App

📄 TEXT BODY:
----------------------------------------
Welcome to our application! We're excited to have you on board.
----------------------------------------
🌐 HTML BODY: Present (not displayed in console)
📏 HTML Length: 245 characters
================================================================================
✅ Email logged to console successfully
================================================================================
```

**Manual Configuration**:
```typescript
import { ConsoleEmailService } from 'crunchycone-lib';

const emailService = new ConsoleEmailService();
```

**Features**:
- ✅ **Zero Configuration** - Works out of the box
- ✅ **Beautiful Formatting** - Clean, readable console output
- ✅ **Complete Information** - Shows all email details
- ✅ **Unique Message IDs** - Generates trackable message IDs
- ✅ **Perfect for Development** - No external services needed
- ✅ **Error Handling** - Graceful error logging

### SMTP Provider

**Dependencies**: `nodemailer` (included)

**Environment Variables**:
```bash
CRUNCHYCONE_EMAIL_PROVIDER=smtp
CRUNCHYCONE_SMTP_HOST=smtp.example.com
CRUNCHYCONE_SMTP_PORT=587
CRUNCHYCONE_SMTP_SECURE=false  # true for port 465, false for other ports
CRUNCHYCONE_SMTP_USER=your_email@example.com
CRUNCHYCONE_SMTP_PASS=your_password
CRUNCHYCONE_SMTP_FROM=your_email@example.com
```

#### Gmail SMTP Setup

To send emails through your personal Gmail account:

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate an App Password**:
   - Go to [Google Account Settings](https://myaccount.google.com/)
   - Security → 2-Step Verification → App passwords
   - Select "Mail" and generate a password
   - Use this 16-character password (not your regular Gmail password)

3. **Configure Environment Variables**:
```bash
CRUNCHYCONE_EMAIL_PROVIDER=smtp
CRUNCHYCONE_SMTP_HOST=smtp.gmail.com
CRUNCHYCONE_SMTP_PORT=587
CRUNCHYCONE_SMTP_SECURE=false
CRUNCHYCONE_SMTP_USER=your_email@gmail.com
CRUNCHYCONE_SMTP_PASS=your_16_character_app_password  # NOT your regular password
CRUNCHYCONE_SMTP_FROM=your_email@gmail.com
```

4. **Test Configuration**:
```bash
npm run email-test -- --provider smtp --to "test@example.com" --subject "Test" --body "Hello World"
```

**Important Notes**:
- Never use your regular Gmail password - only use App Passwords
- Gmail SMTP has sending limits (500 emails/day for personal accounts)
- For production use, consider dedicated email services like SendGrid or SES

**Manual Configuration**:
```typescript
import { SMTPEmailService } from 'crunchycone-lib';

const emailService = new SMTPEmailService({
  host: 'smtp.example.com',
  port: 587,
  secure: false,
  auth: {
    user: 'your_email@example.com',
    pass: 'your_password'
  }
});
```

### SendGrid Provider

**Dependencies**: `@sendgrid/mail` (included)

**Environment Variables**:
```bash
CRUNCHYCONE_EMAIL_PROVIDER=sendgrid
CRUNCHYCONE_SENDGRID_API_KEY=your_sendgrid_api_key
CRUNCHYCONE_SENDGRID_FROM=noreply@myapp.com
CRUNCHYCONE_SENDGRID_CLICK_TRACKING=false  # Optional: disable click tracking
CRUNCHYCONE_SENDGRID_OPEN_TRACKING=false   # Optional: disable open tracking
```

**Manual Configuration**:
```typescript
import { SendGridEmailService } from 'crunchycone-lib';

const emailService = new SendGridEmailService('your_sendgrid_api_key');
```

### Resend Provider

**Dependencies**: `resend` (included)

**Environment Variables**:
```bash
CRUNCHYCONE_EMAIL_PROVIDER=resend
CRUNCHYCONE_RESEND_API_KEY=your_resend_api_key
CRUNCHYCONE_RESEND_FROM=noreply@myapp.com
```

**Manual Configuration**:
```typescript
import { ResendEmailService } from 'crunchycone-lib';

const emailService = new ResendEmailService('your_resend_api_key');
```

### Amazon SES Provider

**Dependencies**: `aws-sdk` (peer dependency - install separately)

**Installation**:
```bash
npm install aws-sdk
```

**Environment Variables**:
```bash
CRUNCHYCONE_EMAIL_PROVIDER=ses
CRUNCHYCONE_AWS_REGION=us-east-1
CRUNCHYCONE_AWS_ACCESS_KEY_ID=your_access_key
CRUNCHYCONE_AWS_SECRET_ACCESS_KEY=your_secret_key
CRUNCHYCONE_SES_FROM=noreply@myapp.com
```

**Manual Configuration**:
```typescript
import { AmazonSESEmailService } from 'crunchycone-lib';

const emailService = new AmazonSESEmailService({
  region: 'us-east-1',
  accessKeyId: 'your_access_key',
  secretAccessKey: 'your_secret_key'
});
```

### Mailgun Provider

**Dependencies**: `mailgun-js` (peer dependency - install separately)

**Installation**:
```bash
npm install mailgun-js
```

**Environment Variables**:
```bash
CRUNCHYCONE_EMAIL_PROVIDER=mailgun
CRUNCHYCONE_MAILGUN_API_KEY=your_mailgun_api_key
CRUNCHYCONE_MAILGUN_DOMAIN=your_domain.com
CRUNCHYCONE_MAILGUN_FROM=noreply@myapp.com
```

**Manual Configuration**:
```typescript
import { MailgunEmailService } from 'crunchycone-lib';

const emailService = new MailgunEmailService({
  apiKey: 'your_mailgun_api_key',
  domain: 'your_domain.com'
});
```

### CrunchyCone Provider

**Dependencies**: None  
**Environment Variables**:
```bash
CRUNCHYCONE_EMAIL_PROVIDER=crunchycone
CRUNCHYCONE_API_KEY=your_crunchycone_api_key          # Optional if stored in keychain
CRUNCHYCONE_EMAIL_BASE_URL=https://api.crunchycone.com # Optional (defaults to https://api.crunchycone.com)
CRUNCHYCONE_EMAIL_FROM_EMAIL=noreply@crunchycone.com   # Optional (sets default from address)
CRUNCHYCONE_EMAIL_FROM_NAME=CrunchyCone Platform       # Optional (sets default from name)
```

**Keychain Authentication** (automatic keytar integration):
```bash
# Store API key in keychain using CrunchyCone CLI
crunchycone auth login

# The email service will automatically use the keychain if CRUNCHYCONE_API_KEY is not set
# Provides secure, cross-platform keychain access without exposing keys in environment
```

The CrunchyCone provider integrates with the CrunchyCone email service API, offering enterprise-grade email delivery with built-in features like special email handling and comprehensive status tracking.

**Manual Configuration**:
```typescript
import { CrunchyConeEmailService } from 'crunchycone-lib';

const emailService = new CrunchyConeEmailService({
  apiKey: 'your_crunchycone_api_key',
  baseUrl: 'https://api.crunchycone.com',  // Optional
  timeout: 30000                           // Optional (30 seconds default)
});
```

**Special Features**:
- ✅ **Zero External Dependencies** - Built-in HTTP client
- ✅ **Special Email Flag** - Mark emails as special/sensitive via `providerSettings.special`
- ✅ **Status Tracking** - Get detailed email delivery status
- ✅ **Email Listing** - Query sent emails with filtering
- ✅ **Timeout Configuration** - Configurable request timeouts
- ✅ **Automatic Retries** - Built-in error handling and recovery

**Usage with Special Emails**:
```typescript
await emailService.sendEmail({
  to: 'user@example.com',
  subject: 'Sensitive Information',
  textBody: 'This contains sensitive data',
  providerSettings: { 
    special: true // Marks email as special for enhanced processing
  }
});
```

**Additional Methods**:
```typescript
// Get email status
const status = await emailService.getEmailStatus('email-id-123');
console.log('Email status:', status.status); // 'queued', 'sent', 'delivered', etc.

// List emails with filtering
const emails = await emailService.listEmails({
  status: 'delivered',
  limit: 50,
  offset: 0
});
console.log('Found emails:', emails.total_count);
```

## Installing Optional Providers

Some providers require additional packages that are not included by default to keep the library lightweight.

### Installing AWS SES Support

```bash
npm install aws-sdk
```

### Installing Mailgun Support

```bash
npm install mailgun-js
```

## Email Interface

All providers implement the same `EmailService` interface:

```typescript
interface EmailService {
  sendEmail(params: EmailParams): Promise<EmailResponse>;
}

interface EmailParams {
  to: EmailRecipient | EmailRecipient[];
  subject: string;
  textBody: string;
  htmlBody?: string;
  from?: EmailRecipient;
}

interface EmailResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

type EmailRecipient = string | EmailAddress;

interface EmailAddress {
  email: string;
  name?: string;
}
```

## Adding Custom Providers

You can create custom email providers by implementing the `EmailService` interface:

### 1. Create Provider Class

```typescript
import { EmailService, EmailParams, EmailResponse } from 'crunchycone-lib';

export class CustomEmailService implements EmailService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async sendEmail(params: EmailParams): Promise<EmailResponse> {
    try {
      // Your custom email sending logic here
      const result = await this.callCustomAPI(params);
      
      return {
        success: true,
        messageId: result.id
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  private async callCustomAPI(params: EmailParams) {
    // Implement your custom API call
    // Transform params to your API format
    // Make HTTP request to your email service
    // Return response
  }
}
```

### 2. Register Provider in Factory

```typescript
// Extend the factory to include your custom provider
import { createEmailService as originalCreateEmailService } from 'crunchycone-lib';
import { CustomEmailService } from './custom-email-service';

export function createEmailService(provider: string = 'crunchycone') {
  if (provider === 'custom') {
    const apiKey = process.env.CUSTOM_EMAIL_API_KEY;
    if (!apiKey) {
      throw new Error('CUSTOM_EMAIL_API_KEY environment variable is required');
    }
    return new CustomEmailService(apiKey);
  }
  
  return originalCreateEmailService(provider);
}
```

### 3. Add TypeScript Types

```typescript
// Extend the EmailProvider type
declare module 'crunchycone-lib' {
  type EmailProvider = 'console' | 'smtp' | 'sendgrid' | 'resend' | 'ses' | 'mailgun' | 'crunchycone' | 'custom';
}
```

## Error Handling

All providers handle errors consistently:

```typescript
const result = await emailService.sendEmail(params);

if (result.success) {
  console.log('Email sent successfully:', result.messageId);
} else {
  console.error('Failed to send email:', result.error);
}
```

## Testing Email Providers

The library includes comprehensive tests for all providers. You can run provider-specific tests:

```bash
# Test all email providers
npm test -- --testPathPattern=email/providers

# Test specific provider
npm test -- tests/services/email/providers/sendgrid.test.ts
```

### Testing Your Custom Provider

```typescript
import { CustomEmailService } from './custom-email-service';

describe('CustomEmailService', () => {
  let service: CustomEmailService;

  beforeEach(() => {
    service = new CustomEmailService('test-api-key');
  });

  it('should send email successfully', async () => {
    const result = await service.sendEmail({
      to: 'test@example.com',
      subject: 'Test',
      textBody: 'Test email'
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBeDefined();
  });

  it('should handle errors gracefully', async () => {
    // Mock error scenario
    const result = await service.sendEmail({
      to: 'invalid-email',
      subject: 'Test',
      textBody: 'Test email'
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
```

## Best Practices

### 1. Environment-Based Configuration

Use environment variables for different stages:

```bash
# Development - Use Console provider (default)
CRUNCHYCONE_EMAIL_PROVIDER=console
# No additional configuration needed!

# Staging
CRUNCHYCONE_EMAIL_PROVIDER=sendgrid
CRUNCHYCONE_SENDGRID_API_KEY=staging_key
CRUNCHYCONE_SENDGRID_FROM=staging@myapp.com

# Production
CRUNCHYCONE_EMAIL_PROVIDER=ses
CRUNCHYCONE_AWS_REGION=us-east-1
CRUNCHYCONE_SES_FROM=noreply@myapp.com
```

### 2. Fallback Providers

Implement fallback logic for critical emails:

```typescript
async function sendCriticalEmail(params: EmailParams) {
  const providers = ['sendgrid', 'ses', 'smtp', 'console']; // Console as final fallback
  
  for (const providerName of providers) {
    try {
      const service = createEmailService(providerName);
      const result = await service.sendEmail(params);
      
      if (result.success) {
        if (providerName === 'console') {
          console.warn('⚠️  Email sent to console only - check production configuration!');
        }
        return result;
      }
    } catch (error) {
      console.warn(`Provider ${providerName} failed:`, error);
    }
  }
  
  throw new Error('All email providers failed');
}
```

### 3. Rate Limiting and Retry Logic

```typescript
class RateLimitedEmailService implements EmailService {
  private wrapped: EmailService;
  private queue: Array<() => Promise<void>> = [];
  private processing = false;

  constructor(wrapped: EmailService) {
    this.wrapped = wrapped;
  }

  async sendEmail(params: EmailParams): Promise<EmailResponse> {
    return new Promise((resolve) => {
      this.queue.push(async () => {
        try {
          const result = await this.wrapped.sendEmail(params);
          resolve(result);
        } catch (error) {
          resolve({ success: false, error: error.message });
        }
      });

      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    
    while (this.queue.length > 0) {
      const job = this.queue.shift()!;
      await job();
      await new Promise(resolve => setTimeout(resolve, 100)); // Rate limit
    }
    
    this.processing = false;
  }
}
```

## Monitoring and Logging

### Email Delivery Tracking

```typescript
class TrackedEmailService implements EmailService {
  private wrapped: EmailService;
  private logger: (event: EmailEvent) => void;

  constructor(wrapped: EmailService, logger: (event: EmailEvent) => void) {
    this.wrapped = wrapped;
    this.logger = logger;
  }

  async sendEmail(params: EmailParams): Promise<EmailResponse> {
    const startTime = Date.now();
    
    this.logger({
      type: 'email_send_started',
      timestamp: new Date(),
      recipient: Array.isArray(params.to) ? params.to[0] : params.to,
      subject: params.subject
    });

    try {
      const result = await this.wrapped.sendEmail(params);
      
      this.logger({
        type: result.success ? 'email_send_success' : 'email_send_failure',
        timestamp: new Date(),
        duration: Date.now() - startTime,
        messageId: result.messageId,
        error: result.error
      });

      return result;
    } catch (error) {
      this.logger({
        type: 'email_send_error',
        timestamp: new Date(),
        duration: Date.now() - startTime,
        error: error.message
      });

      return { success: false, error: error.message };
    }
  }
}
```

## Migration Between Providers

Switching providers is seamless - just change the configuration:

```typescript
// Before: Using SendGrid
const oldService = createEmailService('sendgrid');

// After: Switch to Amazon SES
const newService = createEmailService('ses');

// Same interface, no code changes needed
await newService.sendEmail(params);
```

## Troubleshooting

### Common Issues

1. **Missing Dependencies**:
   ```
   Error: Cannot find module 'aws-sdk'
   ```
   Install the peer dependency: `npm install aws-sdk`

2. **Invalid API Keys**:
   ```
   Error: Unauthorized
   ```
   Check your environment variables and API key validity

3. **Network Issues**:
   ```
   Error: ECONNREFUSED
   ```
   Verify SMTP host/port or internet connectivity

4. **Rate Limiting**:
   ```
   Error: Too Many Requests
   ```
   Implement retry logic with exponential backoff

### Debug Mode

Enable debug logging for troubleshooting:

```typescript
// Set debug environment variable
process.env.DEBUG = 'crunchycone:email';

// Or use the debug flag in service creation
const service = createEmailService('smtp', { debug: true });
```

This comprehensive guide covers all aspects of the email providers system, from basic usage to advanced customization and troubleshooting.