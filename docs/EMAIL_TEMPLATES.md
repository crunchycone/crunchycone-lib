# Email Templates System

The CrunchyCone library includes a powerful email templates system that uses MJML for responsive email design and Liquid for templating logic.

## Features

- **MJML + Liquid**: Combines MJML's responsive email capabilities with Liquid's templating syntax
- **Multi-language support**: Templates can be localized with automatic fallback to English
- **Provider abstraction**: Filesystem-based provider (database provider planned for future)
- **Template validation**: Built-in validation and preview capabilities
- **Integration**: Works seamlessly with existing email providers

## Environment Variables

- `EMAIL_TEMPLATE_PROVIDER`: Provider type (`filesystem` or `database`, defaults to `filesystem`)
- `EMAIL_TEMPLATES_PATH`: Path to template files (defaults to `templates/email`)

## Quick Start

### 1. Install Dependencies

```bash
npm install mjml liquidjs html-to-text
npm install --save-dev @types/mjml @types/html-to-text
```

### 2. Create Template Structure

```
templates/email/
├── en/
│   └── welcome/
│       ├── template-html.mjml
│       ├── subject.liquid
│       ├── template-text.liquid (optional)
│       └── data-preview.json (optional)
└── es/
    └── welcome/
        ├── template-html.mjml
        ├── subject.liquid
        ├── template-text.liquid (optional)
        └── data-preview.json (optional)
```

### 3. Send Templated Email

```typescript
import { sendTemplatedEmail } from 'crunchycone-lib';

await sendTemplatedEmail({
  template: 'welcome',
  to: 'user@example.com',
  language: 'en',
  data: {
    name: 'John Doe',
    appName: 'MyApp',
    supportEmail: 'support@myapp.com'
  }
});
```

## Template Files

### MJML Template (`template-html.mjml`)

```mjml
<!-- Description: Welcome email for new users -->
<mjml>
  <mj-head>
    <mj-title>Welcome to {{ appName }}!</mj-title>
  </mj-head>
  <mj-body>
    <mj-section>
      <mj-column>
        <mj-text>Hi {{ name }}, welcome to {{ appName }}!</mj-text>
        {% if ctaUrl %}
        <mj-button href="{{ ctaUrl }}">
          {{ ctaText | default: 'Get Started' }}
        </mj-button>
        {% endif %}
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>
```

### Subject Template (`subject.liquid`)

```liquid
Welcome to {{ appName }}!
```

### Text Template (`template-text.liquid` - optional)

```liquid
Hi {{ name }},

Welcome to {{ appName }}!

{% if ctaUrl %}{{ ctaText | default: 'Get Started' }}: {{ ctaUrl }}{% endif %}
```

### Test Data (`data-preview.json` - optional)

```json
{
  "name": "John Doe",
  "appName": "CrunchyCone",
  "supportEmail": "support@crunchycone.com",
  "ctaUrl": "https://app.crunchycone.com/dashboard",
  "ctaText": "Get Started",
  "isTrialUser": true,
  "trialDays": 14
}
```

This file provides default data for testing and previewing templates. When using the CLI tool or testing, this data will be used automatically if no custom data is provided.

## Template File Structure

Each email template consists of the following files:

| File | Required | Purpose |
|------|----------|---------|
| `template-html.mjml` | ✅ Yes | MJML template for HTML email content |
| `subject.liquid` | ✅ Yes | Liquid template for email subject line |
| `template-text.liquid` | ❌ Optional | Plain text fallback for email content |
| `data-preview.json` | ❌ Optional | Default test data for development and CLI testing |

### File Descriptions

**`template-html.mjml`**: The main email template using MJML syntax with Liquid variables. MJML is compiled to responsive HTML that works across all email clients.

**`subject.liquid`**: Template for the email subject line using Liquid syntax. Keep it short and descriptive.

**`template-text.liquid`**: Plain text version of the email for clients that don't support HTML. If not provided, HTML content will be automatically converted to text.

**`data-preview.json`**: Contains sample data for testing templates. This data is automatically loaded by:
- The CLI testing tool (`npm run email-test`)
- Template preview functions
- Development utilities

The CLI tool merges `data-preview.json` with any custom data provided via the `--data` parameter, with custom data taking precedence.

## Available Liquid Filters

- `default: value` - Provides default value if variable is empty
- `url_encode` - URL encodes a string
- `truncate: length` - Truncates string to specified length
- `money: currency` - Formats numbers as currency
- `date_format` - Formats dates

## API Reference

### EmailTemplateService

```typescript
import { getEmailTemplateService } from 'crunchycone-lib';

const service = getEmailTemplateService();

// Send templated email
await service.sendTemplatedEmail(options);

// Preview template
const preview = await service.previewTemplate('welcome', data, 'en');

// List available templates
const templates = await service.getAvailableTemplates();

// Validate template
const isValid = await service.validateTemplate('welcome', 'en');
```

### Direct Functions

```typescript
import { 
  sendTemplatedEmail,
  createEmailTemplateEngine,
  createTemplateProvider 
} from 'crunchycone-lib';

// Send email (convenience function)
await sendTemplatedEmail(options);

// Create custom setup
const provider = createTemplateProvider('filesystem');
const engine = createEmailTemplateEngine(provider);
```

## Adding New Templates and Languages

### Creating a New Template

To add a completely new email template (e.g., "password-reset"):

1. **Create the template directory structure**:
```bash
mkdir -p templates/email/en/password-reset
```

2. **Create required files**:

**`templates/email/en/password-reset/template-html.mjml`**:
```mjml
<!-- Description: Password reset email -->
<mjml>
  <mj-head>
    <mj-title>Reset Your Password</mj-title>
  </mj-head>
  <mj-body>
    <mj-section>
      <mj-column>
        <mj-text font-size="24px" font-weight="bold">
          Reset Your Password
        </mj-text>
        <mj-text>
          Hi {{ name }},
        </mj-text>
        <mj-text>
          We received a request to reset your password for {{ appName }}.
        </mj-text>
        <mj-button href="{{ resetUrl }}" background-color="#007bff">
          Reset Password
        </mj-button>
        <mj-text font-size="12px" color="#666">
          This link expires in {{ expirationHours }} hours.
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>
```

**`templates/email/en/password-reset/subject.liquid`**:
```liquid
Reset your {{ appName }} password
```

**`templates/email/en/password-reset/data-preview.json`** (optional):
```json
{
  "name": "John Doe",
  "appName": "CrunchyCone",
  "resetUrl": "https://app.crunchycone.com/reset?token=preview123",
  "expirationHours": 24
}
```

**`templates/email/en/password-reset/template-text.liquid`** (optional):
```liquid
Reset Your Password

Hi {{ name }},

We received a request to reset your password for {{ appName }}.

Reset your password: {{ resetUrl }}

This link expires in {{ expirationHours }} hours.

If you didn't request this, please ignore this email.
```

3. **Use the new template**:
```typescript
await sendTemplatedEmail({
  template: 'password-reset',
  to: 'user@example.com',
  data: {
    name: 'John Doe',
    appName: 'MyApp',
    resetUrl: 'https://myapp.com/reset?token=abc123',
    expirationHours: 24
  }
});
```

### Adding a New Language

To add support for a new language (e.g., French - "fr"):

1. **Create the language directory**:
```bash
mkdir -p templates/email/fr
```

2. **Copy existing templates and translate**:
```bash
# Copy English template as starting point
cp -r templates/email/en/welcome templates/email/fr/welcome
```

3. **Translate the French welcome template**:

**`templates/email/fr/welcome/template-html.mjml`**:
```mjml
<!-- Description: Email de bienvenue pour les nouveaux utilisateurs -->
<mjml>
  <mj-head>
    <mj-title>Bienvenue sur {{ appName }} !</mj-title>
  </mj-head>
  <mj-body>
    <mj-section>
      <mj-column>
        <mj-text>Bonjour {{ name }}, bienvenue sur {{ appName }} !</mj-text>
        {% if ctaUrl %}
        <mj-button href="{{ ctaUrl }}">
          {{ ctaText | default: 'Commencer' }}
        </mj-button>
        {% endif %}
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>
```

**`templates/email/fr/welcome/subject.liquid`**:
```liquid
Bienvenue sur {{ appName }} !
```

**`templates/email/fr/welcome/template-text.liquid`**:
```liquid
Bonjour {{ name }},

Bienvenue sur {{ appName }} !

{% if ctaUrl %}{{ ctaText | default: 'Commencer' }}: {{ ctaUrl }}{% endif %}
```

4. **Use the French template**:
```typescript
await sendTemplatedEmail({
  template: 'welcome',
  to: 'user@example.com',
  language: 'fr', // Request French version
  data: {
    name: 'Jean Dupont',
    appName: 'MonApp'
  }
});
```

### Template Discovery

The system automatically discovers new templates and languages. After adding files:

```typescript
const service = getEmailTemplateService();
const templates = await service.getAvailableTemplates();

// Will now include your new templates with their available languages
console.log(templates);
// [
//   {
//     name: 'welcome',
//     languages: ['en', 'es', 'fr'],
//     description: 'Welcome email for new users'
//   },
//   {
//     name: 'password-reset',
//     languages: ['en'],
//     description: 'Password reset email'
//   }
// ]
```

## Language Fallback Implementation

The fallback system ensures emails are always delivered, even with incomplete translations:

### How Fallback Works

1. **Primary Language Check**: System first looks for the requested language
2. **Fallback to English**: If not found, falls back to English ('en')
3. **Error if No English**: Only fails if English version doesn't exist

### Fallback Logic Flow

```typescript
// Example: Request French template that doesn't exist
await sendTemplatedEmail({
  template: 'password-reset',
  language: 'fr', // French version doesn't exist
  // ... other options
});

// Internal resolution process:
// 1. Look for: templates/email/fr/password-reset/ ❌ Not found
// 2. Fallback to: templates/email/en/password-reset/ ✅ Found
// 3. Send English version with metadata: { fallbackUsed: true }
```

### Fallback Metadata

The system provides metadata about fallback usage:

```typescript
const result = await service.renderTemplate({
  template: 'welcome',
  language: 'fr', // French exists
  data: { name: 'Jean' }
});

console.log(result.metadata);
// {
//   language: 'fr',
//   fallbackUsed: false,
//   mjmlWarnings: []
// }

const fallbackResult = await service.renderTemplate({
  template: 'password-reset',
  language: 'fr', // French doesn't exist
  data: { name: 'Jean' }
});

console.log(fallbackResult.metadata);
// {
//   language: 'en',      // Actually used language
//   fallbackUsed: true,  // Indicates fallback occurred
//   mjmlWarnings: []
// }
```

### Validation with Fallback

Template validation considers fallback behavior:

```typescript
const service = getEmailTemplateService();

// Validate specific language (returns false if fallback needed)
const frenchExists = await service.validateTemplate('welcome', 'fr');
console.log(frenchExists); // true (French version exists)

const frenchResetExists = await service.validateTemplate('password-reset', 'fr');
console.log(frenchResetExists); // false (would fallback to English)

// Validate without language (checks if template exists in any language)
const resetExists = await service.validateTemplate('password-reset');
console.log(resetExists); // true (English version exists)
```

### Best Practices for Multilingual Templates

1. **Always Create English First**: English ('en') serves as the fallback base
2. **Consistent Data Structure**: Use the same data variables across languages
3. **Test Fallbacks**: Verify behavior when requesting non-existent languages
4. **Gradual Translation**: Add languages incrementally, fallback ensures continuity
5. **Monitor Fallback Usage**: Track `fallbackUsed` metadata in production

### Language Code Standards

- Use **ISO 639-1** two-letter language codes: `en`, `es`, `fr`, `de`, `it`, `pt`, etc.
- Directory names must be exactly two lowercase letters
- The system automatically validates language directory format with regex: `/^[a-z]{2}$/`

### Example: Progressive Translation Workflow

```bash
# Step 1: Create English base
templates/email/en/newsletter/
├── template-html.mjml
├── subject.liquid
└── template-text.liquid

# Step 2: Add Spanish
templates/email/es/newsletter/
├── template-html.mjml
└── subject.liquid

# Step 3: Add French (later)
templates/email/fr/newsletter/
├── template-html.mjml
└── subject.liquid

# Usage during development:
# - English: Full template ✅
# - Spanish: Spanish template ✅  
# - French: Falls back to English ✅ (until French is added)
# - German: Falls back to English ✅ (planned for future)
```

This robust fallback system allows you to deploy multilingual email support incrementally while ensuring reliable email delivery at all times.

## Development Tools

### CLI Testing Tool

```bash
# Test templates with real email providers
npm run email-test -- --provider sendgrid --to "test@example.com" --template welcome

# Test with different language
npm run email-test -- --provider resend --to "test@example.com" --template welcome --language es

# Test with custom data
npm run email-test -- --provider smtp --to "test@example.com" --template welcome --data '{"name":"Alice","appName":"MyApp"}'

# Test with custom templates path
npm run email-test -- --provider crunchycone --to "test@example.com" --template welcome --templates-path "/path/to/templates"
```

### Preview Templates

```bash
npm run email-templates-example
```

### Template Validation

Templates are automatically validated when loaded. The validation checks:
- MJML syntax and structure
- Required files (template-html.mjml, subject.liquid)
- Liquid template syntax

## Integration with Email Providers

The email templates system integrates seamlessly with all supported email providers:

```typescript
import { sendTemplatedEmail } from 'crunchycone-lib';

// Uses the default email provider configured in your environment
await sendTemplatedEmail({
  template: 'welcome',
  to: 'user@example.com',
  from: 'noreply@myapp.com', // Optional
  data: { /* template data */ }
});
```

## Testing

The system includes comprehensive tests for all components:

```bash
npm test -- --testPathPattern=email-templates
```

Test coverage includes:
- Template provider functionality
- MJML + Liquid rendering
- Multi-language support and fallbacks
- Email service integration
- Error handling