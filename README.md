# CrunchyCone Library

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Apache License](https://img.shields.io/badge/License-Apache%202.0-green.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/Tests-404%20passing-brightgreen.svg)]()
[![npm version](https://img.shields.io/badge/npm-0.1.13-blue.svg)](package.json)

A comprehensive TypeScript library providing unified abstractions for email services, storage providers, and template engines. Designed for CrunchyCone Starter Projects but flexible enough for any TypeScript/JavaScript application.

## 🚀 Features

### ✉️ Email Services
- **Unified API** across 7+ email providers (SendGrid, Resend, Amazon SES, SMTP, Mailgun, CrunchyCone, Console)
- **Provider abstraction** - switch providers without code changes
- **Provider availability checking** - programmatically check if dependencies are available
- **Built-in templates** with MJML v4 + LiquidJS templating
- **Template includes** - reusable components with `{% include 'filename' %}`
- **Multi-language support** with automatic fallbacks
- **Development-friendly** console provider for testing

### 📁 Storage Services
- **Multi-provider support** (AWS S3, Google Cloud, Azure Blob, CrunchyCone, LocalStorage, and more)
- **Provider availability checking** - detect available storage providers
- **File streaming** with range request support
- **Metadata management** and search capabilities
- **Public/private file visibility** controls
- **External ID mapping** for easy integration

### 🛡️ Authentication & API Client
- **API-first authentication** with CLI fallback for CrunchyCone services
- **CrunchyCone API Client** for direct API access (user info, project details)
- **Unified auth service** supporting multiple authentication methods
- **Environment variable** and **keychain** support (keytar)
- **CLI fallback** via `crunchycone-cli auth check`
- **Production-ready** authentication for containerized environments

## 📦 Installation

```bash
npm install crunchycone-lib
```

### Optional Dependencies (Install as needed)

```bash
# For AWS services (S3 storage, SES email)
npm install @aws-sdk/client-s3 @aws-sdk/client-ses @aws-sdk/s3-request-presigner

# For Google Cloud Storage
npm install @google-cloud/storage

# For Azure Storage
npm install @azure/storage-blob

# For MJML v4 email templating (responsive email templates)
npm install mjml
npm install --save-dev @types/mjml

# Note: liquidjs and html-to-text are included as dependencies
```

## 🔧 Quick Start

### Email Service

```typescript
import { createEmailService } from 'crunchycone-lib';

// Create email service (uses environment variables for configuration)
const emailService = createEmailService('sendgrid');

// Send email
const result = await emailService.sendEmail({
  to: 'user@example.com',
  subject: 'Hello World',
  textBody: 'Hello from CrunchyCone!',
  htmlBody: '<h1>Hello from CrunchyCone!</h1>'
});

console.log(`Email sent with ID: ${result.messageId}`);
```

### Provider Availability Checking

```typescript
import { isEmailProviderAvailable, getAvailableEmailProviders, isStorageProviderAvailable, getAvailableStorageProviders } from 'crunchycone-lib';

// Check if specific providers are available (has dependencies installed)
const sendGridAvailable = await isEmailProviderAvailable('sendgrid');
const s3Available = await isStorageProviderAvailable('s3');

console.log('SendGrid available:', sendGridAvailable);
console.log('S3 available:', s3Available);

// Get all available providers
const availableEmailProviders = await getAvailableEmailProviders();
const availableStorageProviders = await getAvailableStorageProviders();

console.log('Available email providers:', availableEmailProviders);
// Output: ['console', 'smtp', 'crunchycone', 'mailgun'] (+ others if dependencies installed)

console.log('Available storage providers:', availableStorageProviders);  
// Output: ['localstorage', 'crunchycone'] (+ others if dependencies installed)

// Check provider availability on service instances
const emailService = createEmailService('console');
const available = await emailService.isAvailable();
console.log('Service available:', available); // true
```

### Specific Provider Import (No Optional Dependencies)

```typescript
// Import specific providers to avoid loading optional dependencies
import { AmazonSESEmailService } from 'crunchycone-lib/email/providers/amazon-ses';
import { S3CompatibleProvider } from 'crunchycone-lib/storage/providers/s3';

// Only loads when the provider is actually used
const emailService = new AmazonSESEmailService();
const storageProvider = new S3CompatibleProvider(config);
```

### Storage Service

```typescript
import { StorageService } from 'crunchycone-lib/storage';

const storage = new StorageService({
  provider: 'crunchycone',
  config: {
    projectId: 'your-project-id'
  }
});

// Upload file
const result = await storage.uploadFile('my-file.txt', fileBuffer, {
  externalId: 'user-avatar-123',
  visibility: 'public'
});

// Get public URL
const url = await storage.getFileUrl(result.key);
console.log(`File available at: ${url}`);
```

### Email Templates (MJML v4 + LiquidJS)

```typescript
import { createEmailTemplateService } from 'crunchycone-lib/email/templates';

const templates = createEmailTemplateService({
  provider: 'filesystem',
  templatesPath: './templates/email'
});

// Render template with data and includes
const rendered = await templates.renderTemplate('welcome', 'en', {
  userName: 'John Doe',
  appName: 'MyApp',
  activationUrl: 'https://app.example.com/activate/123'
});

// Send templated email
await emailService.sendEmail({
  to: 'user@example.com',
  subject: rendered.subject,
  html: rendered.html,
  text: rendered.text
});
```

**Template Structure with Includes:**
```
templates/email/
├── en/
│   ├── includes/
│   │   ├── header.liquid
│   │   └── footer.liquid
│   └── welcome/
│       ├── template-html.mjml (uses {% include 'header' %})
│       └── subject.liquid
```

## 📚 Documentation

- **[CrunchyCone API & Auth](docs/CRUNCHYCONE_API_AUTH.md)** - API client and unified authentication service
- **[Email Providers](docs/EMAIL_PROVIDERS.md)** - Complete guide to all supported email providers
- **[Email Templates](docs/EMAIL_TEMPLATES.md)** - MJML v4 + LiquidJS templating with includes
- **[Storage Providers](docs/STORAGE.md)** - File storage across multiple cloud providers
- **[CrunchyCone Storage](docs/CRUNCHYCONE_STORAGE.md)** - CrunchyCone-specific storage features
- **[Storage CLI](docs/STORAGE_CLI.md)** - Command-line tools for storage testing
- **[Streaming Interface](docs/STREAMING_INTERFACE.md)** - File streaming with range requests

## 🔐 Environment Variables

The library uses environment variables for configuration. Here are the key ones:

### Email Services
```bash
# SendGrid
CRUNCHYCONE_SENDGRID_API_KEY=your_sendgrid_api_key
CRUNCHYCONE_SENDGRID_FROM=noreply@yourapp.com

# Resend
CRUNCHYCONE_RESEND_API_KEY=your_resend_api_key
CRUNCHYCONE_RESEND_FROM=noreply@yourapp.com

# CrunchyCone
CRUNCHYCONE_API_KEY=your_crunchycone_api_key
```

### Storage Services
```bash
# CrunchyCone Storage
CRUNCHYCONE_API_KEY=your_crunchycone_api_key
CRUNCHYCONE_PROJECT_ID=your_project_id

# AWS S3
CRUNCHYCONE_AWS_ACCESS_KEY_ID=your_access_key
CRUNCHYCONE_AWS_SECRET_ACCESS_KEY=your_secret_key
CRUNCHYCONE_AWS_REGION=us-west-2
```

See the documentation for complete environment variable lists.

## 📁 Module Structure

The library is organized into focused modules with **zero optional dependencies** at the main entry point:

```typescript
// Core exports (no optional dependencies)
import { createEmailService, EmailService, isEmailProviderAvailable, getAvailableEmailProviders } from 'crunchycone-lib';

// Email services (no optional dependencies) 
import { createEmailService, isEmailProviderAvailable, getAvailableEmailProviders } from 'crunchycone-lib/email';

// Email templates (core functionality, no optional dependencies)
import { createEmailTemplateService } from 'crunchycone-lib/email/templates';

// Storage services (loads core without providers)
import { StorageService, isStorageProviderAvailable, getAvailableStorageProviders } from 'crunchycone-lib/storage';

// Authentication utilities (no optional dependencies)
import { getCrunchyConeAPIKey } from 'crunchycone-lib/auth';

// Specific providers (only loads when imported)
import { AmazonSESEmailService } from 'crunchycone-lib/email/providers/amazon-ses';
import { SendGridEmailService } from 'crunchycone-lib/email/providers/sendgrid';
import { S3CompatibleProvider } from 'crunchycone-lib/storage/providers/s3';
import { GCPStorageProvider } from 'crunchycone-lib/storage/providers/gcp';
import { AzureStorageProvider } from 'crunchycone-lib/storage/providers/azure';

// Template engines (only loads when imported)
import { MJMLLiquidEngine } from 'crunchycone-lib/email/templates/engines/mjml-liquid';

// Next.js API helpers
import { createApiHandler } from 'crunchycone-lib/api-external';
```

### 🎯 **Zero Optional Dependencies at Import**

The main entry point (`crunchycone-lib`) and core modules can be imported **without installing any optional dependencies** (cloud provider SDKs, MJML, etc.). Optional dependencies are only required when you import and use specific providers or template engines.

**Example: Email-only usage** (no storage, cloud, or MJML dependencies needed):
```typescript
import { createEmailService } from 'crunchycone-lib';

// Only requires core dependencies - works without AWS, Azure, GCP SDKs, or MJML!
const emailService = createEmailService('console');
```

**Example: MJML templates** (requires MJML to be installed):
```typescript
import { MJMLLiquidEngine } from 'crunchycone-lib/email/templates/engines/mjml-liquid';

// Requires: npm install mjml
const mjmlEngine = new MJMLLiquidEngine(templateProvider);
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Lint code
npm run lint

# Fix lint issues
npm run lint:fix
```

## 🔧 Development

```bash
# Build the library
npm run build

# Clean build artifacts
npm run clean

# Test email functionality
npm run email-test

# Test storage functionality
npm run storage-test

# Interactive storage CLI
npm run storage-cli
```

## 📊 Provider Support Matrix

### Email Providers

| Provider | Status | Dependencies | Features |
|----------|---------|-------------|----------|
| Console | ✅ Built-in | None | Development/testing |
| SMTP | ✅ Ready | nodemailer | Self-hosted |
| SendGrid | ✅ Ready | @sendgrid/mail | Transactional |
| Resend | ✅ Ready | resend | Modern API |
| Amazon SES | ✅ Ready | @aws-sdk/client-ses | AWS ecosystem |
| Mailgun | ✅ Ready | mailgun-js | Reliable delivery |
| CrunchyCone | ✅ Ready | None | Integrated platform |

### Storage Providers

| Provider | Status | Dependencies | Features |
|----------|---------|-------------|----------|
| LocalStorage | ✅ Built-in | None | Development/testing |
| CrunchyCone | ✅ Ready | None | Integrated platform |
| AWS S3 | ✅ Ready | @aws-sdk/client-s3 | Industry standard |
| Google Cloud | ✅ Ready | @google-cloud/storage | GCP ecosystem |
| Azure Blob | ✅ Ready | @azure/storage-blob | Azure ecosystem |
| R2 (Cloudflare) | ✅ Ready | S3-compatible | Edge storage |
| DigitalOcean Spaces | ✅ Ready | S3-compatible | Simple cloud |
| Backblaze B2 | ✅ Ready | S3-compatible | Cost-effective |
| Wasabi | ✅ Ready | S3-compatible | Hot storage |

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and add tests
4. Ensure tests pass: `npm test`
5. Commit your changes: `git commit -m 'Add amazing feature'`
6. Push to the branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

## 📄 License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## 🔗 Related Projects

- [CrunchyCone Platform](https://crunchycone.com) - The main CrunchyCone platform
- [CrunchyCone Starter Projects](https://github.com/crunchycone) - Ready-to-use project templates

## 💬 Support

- 📧 Email: support@crunchycone.com
- 📖 Documentation: [docs/](docs/)
- 🐛 Issues: [GitHub Issues](https://github.com/crunchycone/crunchycone-lib/issues)

---

Built with ❤️ and lots of 🍨 by the CrunchyCone team
