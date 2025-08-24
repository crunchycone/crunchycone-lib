#!/usr/bin/env node

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { createEmailService, EmailProvider } from '../services/email';
import { Liquid } from 'liquidjs';
import mjml from 'mjml';

// Try to load .env file from current working directory
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  console.log(`🔧 Loading environment variables from ${envPath}`);
  dotenv.config({ path: envPath });
} else {
  // Also try loading from the project root (in case running from subdirectory)
  const projectRootEnvPath = path.join(__dirname, '../../.env');
  if (fs.existsSync(projectRootEnvPath)) {
    console.log(`🔧 Loading environment variables from ${projectRootEnvPath}`);
    dotenv.config({ path: projectRootEnvPath });
  }
}

interface CliArgs {
  provider: EmailProvider;
  to: string[];
  subject?: string;
  body?: string;
  from?: string;
  fromDisplayName?: string;
  html?: boolean;
  help?: boolean;
  template?: string;
  templatesPath?: string;
  language?: string;
  data?: string;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const parsed: Partial<CliArgs> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--provider':
      case '-p':
        if (!nextArg) throw new Error('Provider is required');
        if (!isValidProvider(nextArg)) {
          throw new Error(`Invalid provider: ${nextArg}. Valid providers: smtp, sendgrid, resend, ses, mailgun, crunchycone, console`);
        }
        parsed.provider = nextArg as EmailProvider;
        i++;
        break;

      case '--to':
      case '-t':
        if (!nextArg) throw new Error('To address is required');
        parsed.to = nextArg.split(',').map(email => email.trim());
        i++;
        break;

      case '--subject':
      case '-s':
        if (!nextArg) throw new Error('Subject is required');
        parsed.subject = nextArg;
        i++;
        break;

      case '--body':
      case '-b':
        if (!nextArg) throw new Error('Body is required');
        parsed.body = nextArg;
        i++;
        break;

      case '--from':
      case '-f':
        if (!nextArg) throw new Error('From address is required when specified');
        parsed.from = nextArg;
        i++;
        break;

      case '--from-display-name':
      case '--display-name':
        if (!nextArg) throw new Error('From display name is required when specified');
        parsed.fromDisplayName = nextArg;
        i++;
        break;

      case '--html':
        parsed.html = true;
        break;

      case '--template':
      case '-T':
        if (!nextArg) throw new Error('Template name is required');
        parsed.template = nextArg;
        i++;
        break;

      case '--templates-path':
        if (!nextArg) throw new Error('Templates path is required');
        parsed.templatesPath = nextArg;
        i++;
        break;

      case '--language':
      case '-l':
        if (!nextArg) throw new Error('Language is required');
        parsed.language = nextArg;
        i++;
        break;

      case '--data':
      case '-d':
        if (!nextArg) throw new Error('Data is required');
        parsed.data = nextArg;
        i++;
        break;

      case '--help':
      case '-h':
        parsed.help = true;
        break;

      default:
        if (arg.startsWith('-')) {
          throw new Error(`Unknown option: ${arg}`);
        }
        break;
    }
  }

  // Set defaults
  if (!parsed.templatesPath) {
    parsed.templatesPath = path.join(__dirname, '../../tests/templates/email');
  }
  if (!parsed.language) {
    parsed.language = 'en';
  }

  // Validate required arguments
  if (!parsed.help) {
    if (!parsed.provider) throw new Error('Provider is required (use --provider)');
    if (!parsed.to || parsed.to.length === 0) throw new Error('To address is required (use --to)');
    
    // Either template mode OR subject+body mode
    if (parsed.template) {
      // Template mode - template name is required
    } else {
      // Regular mode - subject and body are required
      if (!parsed.subject) throw new Error('Subject is required (use --subject)');
      if (!parsed.body) throw new Error('Body is required (use --body)');
    }
  }

  return parsed as CliArgs;
}

function isValidProvider(provider: string): provider is EmailProvider {
  const validProviders: EmailProvider[] = ['smtp', 'sendgrid', 'resend', 'ses', 'mailgun', 'crunchycone', 'console'];
  return validProviders.includes(provider as EmailProvider);
}

function printHelp() {
  console.log(`
📧 CrunchyCone Email Test CLI

USAGE:
  npm run email-test -- [OPTIONS]

REQUIRED OPTIONS:
  -p, --provider <provider>    Email provider to use
                              (smtp, sendgrid, resend, ses, mailgun, crunchycone, console)
  -t, --to <emails>           Recipient email(s), comma-separated

EITHER (Template Mode):
  -T, --template <name>       Template name to use
  
OR (Direct Mode):
  -s, --subject <subject>     Email subject line
  -b, --body <body>           Email body text

OPTIONAL:
  -f, --from <email>          From email address (overrides provider default)
      --from-display-name <name>  Display name for sender (e.g. "Your Company")
      --display-name <name>   Alias for --from-display-name
      --html                  Treat body as HTML content (direct mode only)
      --templates-path <path> Path to templates directory (default: tests/templates/email)
  -l, --language <lang>       Language for template (default: en)
  -d, --data <json>           JSON data for template variables (overrides data-preview.json)
  -h, --help                  Show this help message

ENVIRONMENT VARIABLES:
  The CLI will automatically load a .env file from the current directory or project root.
  
  Set CRUNCHYCONE_EMAIL_PROVIDER to your desired default provider
  
  For SMTP:
    CRUNCHYCONE_SMTP_HOST, CRUNCHYCONE_SMTP_PORT, CRUNCHYCONE_SMTP_USER,
    CRUNCHYCONE_SMTP_PASS, CRUNCHYCONE_SMTP_FROM

  For SendGrid:
    CRUNCHYCONE_SENDGRID_API_KEY, CRUNCHYCONE_SENDGRID_FROM
    CRUNCHYCONE_SENDGRID_CLICK_TRACKING (default: true)
    CRUNCHYCONE_SENDGRID_OPEN_TRACKING (default: true)

  For Resend:
    CRUNCHYCONE_RESEND_API_KEY, CRUNCHYCONE_RESEND_FROM

  For Amazon SES:
    CRUNCHYCONE_AWS_ACCESS_KEY_ID, CRUNCHYCONE_AWS_SECRET_ACCESS_KEY,
    CRUNCHYCONE_AWS_REGION, CRUNCHYCONE_SES_FROM

  For Mailgun:
    CRUNCHYCONE_MAILGUN_API_KEY, CRUNCHYCONE_MAILGUN_DOMAIN, CRUNCHYCONE_MAILGUN_FROM

EXAMPLES:
  # Test with CrunchyCone (mock) provider (direct mode)
  npm run email-test -- --provider crunchycone --to "test@example.com" --subject "Test Email" --body "Hello World!"

  # Send templated email
  npm run email-test -- --provider crunchycone --to "test@example.com" --template welcome

  # Send templated email with custom language
  npm run email-test -- --provider smtp --to "user@example.com" --template welcome --language es

  # Send templated email with custom data
  npm run email-test -- --provider sendgrid --to "user@example.com" --template welcome --data '{"name":"Alice","appName":"MyApp"}'

  # Send to multiple recipients (direct mode)
  npm run email-test -- --provider smtp --to "user1@example.com,user2@example.com" --subject "Newsletter" --body "Latest updates..."

  # Send HTML email (direct mode)
  npm run email-test -- --provider sendgrid --to "user@example.com" --subject "HTML Test" --body "<h1>Hello!</h1>" --html

  # Override from address
  npm run email-test -- --provider resend --to "user@example.com" --subject "Test" --body "Hello" --from "custom@example.com"

  # Send with custom display name
  npm run email-test -- --provider smtp --to "user@example.com" --subject "Test" --body "Hello" --from-display-name "My Company"

  # Send with both custom from and display name
  npm run email-test -- --provider sendgrid --to "user@example.com" --subject "Test" --body "Hello" --from "noreply@mycompany.com" --display-name "My Company"

  # Create a .env file in your project root with your email configuration:
  echo "CRUNCHYCONE_EMAIL_PROVIDER=smtp" >> .env
  echo "CRUNCHYCONE_SMTP_HOST=smtp.gmail.com" >> .env
  echo "CRUNCHYCONE_SMTP_PORT=587" >> .env
  echo "CRUNCHYCONE_SMTP_USER=your-email@gmail.com" >> .env
  echo "CRUNCHYCONE_SMTP_PASS=your-app-password" >> .env
`);
}

async function loadTemplateData(templatesPath: string, template: string, language: string, customData?: string): Promise<any> {
  const templateDir = path.join(templatesPath, language, template);
  const dataPreviewPath = path.join(templateDir, 'data-preview.json');
  
  let data = {};
  
  // Load data-preview.json if it exists
  if (fs.existsSync(dataPreviewPath)) {
    const dataContent = fs.readFileSync(dataPreviewPath, 'utf-8');
    data = JSON.parse(dataContent);
  }
  
  // Override with custom data if provided
  if (customData) {
    const customDataObj = JSON.parse(customData);
    data = { ...data, ...customDataObj };
  }
  
  return data;
}

async function renderTemplate(templatesPath: string, template: string, language: string, filename: string, data: any): Promise<string> {
  const templatePath = path.join(templatesPath, language, template, filename);
  
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template file not found: ${templatePath}`);
  }
  
  const templateContent = fs.readFileSync(templatePath, 'utf-8');
  const liquid = new Liquid();
  const renderedContent = await liquid.parseAndRender(templateContent, data);
  
  // If this is an MJML file, compile it to HTML
  if (filename.endsWith('.mjml')) {
    const mjmlResult = mjml(renderedContent, {
      beautify: false,
      validationLevel: 'soft',
      fonts: {},
      keepComments: false,
    });
    if (mjmlResult.errors.length > 0) {
      console.warn(`⚠️  MJML compilation warnings for ${filename}:`, mjmlResult.errors);
    }
    // Additional cleanup to remove Gmail-triggering patterns
    const cleanHtml = mjmlResult.html
      .replace(/<!--\[if.*?\]>[\s\S]*?<!\[endif\]-->/g, '') // Remove Outlook conditionals
      .replace(/xmlns:v="urn:schemas-microsoft-com:vml"/g, '')
      .replace(/xmlns:o="urn:schemas-microsoft-com:office:office"/g, '')
      .replace(/\s+/g, ' ') // Collapse whitespace
      .replace(/>\s+</g, '><'); // Remove spaces between tags
    
    return cleanHtml;
  }
  
  return renderedContent;
}

async function sendTemplateEmail(args: CliArgs) {
  try {
    process.env.CRUNCHYCONE_EMAIL_PROVIDER = args.provider;
    if (args.fromDisplayName) {
      process.env.CRUNCHYCONE_EMAIL_FROM_DISPLAY = args.fromDisplayName;
    }

    console.log('🚀 Initializing templated email service...');
    console.log(`📧 Provider: ${args.provider}`);
    console.log(`📮 To: ${args.to.join(', ')}`);
    console.log(`📝 Template: ${args.template}`);
    console.log(`🌐 Language: ${args.language}`);
    console.log(`📁 Templates Path: ${args.templatesPath}`);
    if (args.from) console.log(`👤 From: ${args.from}`);
    if (args.fromDisplayName) console.log(`👤 Display Name: ${args.fromDisplayName}`);
    console.log('');

    const data = await loadTemplateData(args.templatesPath!, args.template!, args.language!, args.data);
    console.log('📊 Template Data:', JSON.stringify(data, null, 2));
    console.log('');

    const subject = await renderTemplate(args.templatesPath!, args.template!, args.language!, 'subject.liquid', data);
    const textBody = await renderTemplate(args.templatesPath!, args.template!, args.language!, 'template-text.liquid', data);
    
    let htmlBody: string | undefined;
    const htmlTemplatePath = path.join(args.templatesPath!, args.language!, args.template!, 'template-html.mjml');
    if (fs.existsSync(htmlTemplatePath)) {
      htmlBody = await renderTemplate(args.templatesPath!, args.template!, args.language!, 'template-html.mjml', data);
    }

    console.log(`📝 Rendered Subject: ${subject}`);
    console.log(`📄 Text Body Preview: ${textBody.substring(0, 100)}${textBody.length > 100 ? '...' : ''}`);
    console.log(`📏 Text Body Size: ${Buffer.byteLength(textBody, 'utf8')} bytes`);
    if (htmlBody) {
      console.log('🎨 HTML content: enabled');
      console.log(`📏 HTML Body Size: ${Buffer.byteLength(htmlBody, 'utf8')} bytes`);
      console.log(`📏 Total Email Size: ~${Buffer.byteLength(textBody + htmlBody, 'utf8')} bytes`);
    }
    console.log('');

    const emailService = createEmailService();
    const emailParams = {
      to: args.to.length === 1 ? args.to[0] : args.to,
      subject: subject.trim(),
      textBody,
      htmlBody,
      from: args.from,
    };

    console.log('📤 Sending templated email...');
    const result = await emailService.sendEmail(emailParams);

    if (result.success) {
      console.log('✅ Email sent successfully!');
      if (result.messageId) {
        console.log(`📬 Message ID: ${result.messageId}`);
      }
    } else {
      console.error('❌ Failed to send email:');
      console.error(`💥 Error: ${result.error}`);
      process.exit(1);
    }

  } catch (error) {
    console.error('💥 Unexpected error:');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

async function sendDirectEmail(args: CliArgs) {
  try {
    // Set the provider environment variable temporarily
    process.env.CRUNCHYCONE_EMAIL_PROVIDER = args.provider;
    if (args.fromDisplayName) {
      process.env.CRUNCHYCONE_EMAIL_FROM_DISPLAY = args.fromDisplayName;
    }

    console.log('🚀 Initializing direct email service...');
    console.log(`📧 Provider: ${args.provider}`);
    console.log(`📮 To: ${args.to.join(', ')}`);
    console.log(`📝 Subject: ${args.subject}`);
    console.log(`📄 Body: ${args.body!.substring(0, 50)}${args.body!.length > 50 ? '...' : ''}`);
    if (args.from) console.log(`👤 From: ${args.from}`);
    if (args.fromDisplayName) console.log(`👤 Display Name: ${args.fromDisplayName}`);
    if (args.html) console.log('🎨 HTML content: enabled');
    console.log('');

    const emailService = createEmailService();

    const emailParams = {
      to: args.to.length === 1 ? args.to[0] : args.to,
      subject: args.subject!,
      textBody: args.body!,
      htmlBody: args.html ? args.body! : undefined,
      from: args.from,
    };

    console.log('📤 Sending email...');
    const result = await emailService.sendEmail(emailParams);

    if (result.success) {
      console.log('✅ Email sent successfully!');
      if (result.messageId) {
        console.log(`📬 Message ID: ${result.messageId}`);
      }
    } else {
      console.error('❌ Failed to send email:');
      console.error(`💥 Error: ${result.error}`);
      process.exit(1);
    }

  } catch (error) {
    console.error('💥 Unexpected error:');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

async function main() {
  try {
    const args = parseArgs();

    if (args.help) {
      printHelp();
      return;
    }

    if (args.template) {
      await sendTemplateEmail(args);
    } else {
      await sendDirectEmail(args);
    }

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    console.error('');
    console.error('Use --help for usage information');
    process.exit(1);
  }
}

// Run the CLI
if (require.main === module) {
  main();
}