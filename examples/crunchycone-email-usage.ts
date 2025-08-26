#!/usr/bin/env node

/**
 * CrunchyCone Email Service Usage Examples
 * 
 * This file demonstrates how to use the CrunchyCone Email Service
 * to send emails via the CrunchyCone Email API.
 */

import { CrunchyConeEmailService } from '../src/services/email/providers/crunchycone';
import { getCrunchyConeAPIKeyWithFallback, hasCrunchyConeAPIKey } from '../src/auth';
import { isEmailProviderAvailable, getAvailableEmailProviders, createEmailService } from '../src/services/email/factory';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function basicEmailExample() {
  console.log('\n🚀 Basic Email Example');
  console.log('='.repeat(50));

  // CrunchyConeEmailService will automatically get API key from env or keychain
  const emailService = new CrunchyConeEmailService();

  try {
    const result = await emailService.sendEmail({
      to: 'test@example.com',
      subject: 'Hello from CrunchyCone!',
      textBody: 'This is a test email sent via the CrunchyCone Email API.',
      htmlBody: '<h1>Hello!</h1><p>This is a test email sent via the <strong>CrunchyCone Email API</strong>.</p>',
      from: {
        email: 'noreply@example.com',
        name: 'Test Sender'
      }
    });

    if (result.success) {
      console.log('✅ Email sent successfully!');
      console.log(`📬 Email ID: ${result.emailId}`);
      console.log(`📨 Message ID: ${result.messageId}`);
      console.log(`📊 Status: ${result.status}`);
      console.log(`🕐 Sent At: ${result.sentAt}`);
    } else {
      console.error('❌ Failed to send email:', result.error);
    }
  } catch (error) {
    console.error('💥 Error:', error);
  }
}

async function sensitiveEmailExample() {
  console.log('\n🔒 Sensitive Email Example (Special Flag)');
  console.log('='.repeat(50));

  const emailService = new CrunchyConeEmailService();

  try {
    const result = await emailService.sendEmail({
      to: 'user@example.com',
      subject: 'Your Password Reset Code',
      textBody: 'Your password reset code is: 123456',
      sensitive: true, // This will set the special flag
      from: {
        email: 'security@example.com',
        name: 'Security Team'
      }
    });

    if (result.success) {
      console.log('✅ Sensitive email sent successfully!');
      console.log(`📬 Email ID: ${result.emailId}`);
      console.log('🔒 Content will not be stored in database');
    } else {
      console.error('❌ Failed to send sensitive email:', result.error);
    }
  } catch (error) {
    console.error('💥 Error:', error);
  }
}

async function multipleRecipientsExample() {
  console.log('\n👥 Multiple Recipients Example');
  console.log('='.repeat(50));

  const emailService = new CrunchyConeEmailService();

  try {
    const result = await emailService.sendEmail({
      to: [
        { email: 'user1@example.com', name: 'User One' },
        { email: 'user2@example.com', name: 'User Two' },
        'user3@example.com' // Can also use string format
      ],
      subject: 'Team Announcement',
      textBody: 'This is an important announcement for the team.',
      htmlBody: '<h2>Team Announcement</h2><p>This is an important announcement for the team.</p>'
    });

    if (result.success) {
      console.log('✅ Email sent to multiple recipients!');
      console.log(`📬 Email ID: ${result.emailId}`);
    } else {
      console.error('❌ Failed to send email:', result.error);
    }
  } catch (error) {
    console.error('💥 Error:', error);
  }
}

async function getEmailStatusExample() {
  console.log('\n📊 Get Email Status Example');
  console.log('='.repeat(50));

  const emailService = new CrunchyConeEmailService();

  try {
    // First send an email
    const sendResult = await emailService.sendEmail({
      to: 'test@example.com',
      subject: 'Status Check Email',
      textBody: 'This email is for testing status checking.'
    });

    if (sendResult.success && sendResult.emailId) {
      console.log(`📤 Email sent with ID: ${sendResult.emailId}`);
      
      // Wait a moment, then check status
      setTimeout(async () => {
        try {
          const status = await emailService.getEmailStatus(sendResult.emailId!);
          console.log('📊 Email Status:');
          console.log(`  Status: ${status.status}`);
          console.log(`  Subject: ${status.subject}`);
          console.log(`  Created: ${status.createdAt}`);
          console.log(`  CLI Key: ${status.isCliApiKey}`);
          console.log(`  Sensitive: ${status.isSensitive}`);
          if (status.sentAt) console.log(`  Sent: ${status.sentAt}`);
          if (status.deliveredAt) console.log(`  Delivered: ${status.deliveredAt}`);
        } catch (error) {
          console.error('❌ Failed to get email status:', error);
        }
      }, 2000);
    }
  } catch (error) {
    console.error('💥 Error:', error);
  }
}

async function listEmailsExample() {
  console.log('\n📋 List Emails Example');
  console.log('='.repeat(50));

  const emailService = new CrunchyConeEmailService();

  try {
    const emails = await emailService.listEmails({
      limit: 5,
      offset: 0,
      status: 'sent'
    });

    console.log(`📋 Found ${emails.totalCount} emails (showing ${emails.emails.length})`);
    console.log(`🔄 Has more: ${emails.hasMore}`);
    
    emails.emails.forEach((email, index) => {
      console.log(`\n${index + 1}. ${email.subject}`);
      console.log(`   ID: ${email.emailId}`);
      console.log(`   Status: ${email.status}`);
      console.log(`   To: ${email.to.map(t => t.email).join(', ')}`);
      console.log(`   Created: ${email.createdAt}`);
    });
  } catch (error) {
    console.error('💥 Error:', error);
  }
}

async function providerAvailabilityExample() {
  console.log('\n🔍 Provider Availability Example');
  console.log('='.repeat(50));

  try {
    // Check individual providers
    const crunchyConeAvailable = await isEmailProviderAvailable('crunchycone');
    const sendGridAvailable = await isEmailProviderAvailable('sendgrid');
    const sesAvailable = await isEmailProviderAvailable('ses');
    
    console.log('📊 Individual Provider Availability:');
    console.log(`  CrunchyCone: ${crunchyConeAvailable ? '✅ Available' : '❌ Not available'}`);
    console.log(`  SendGrid: ${sendGridAvailable ? '✅ Available' : '❌ Not available'}`);
    console.log(`  Amazon SES: ${sesAvailable ? '✅ Available' : '❌ Not available'}`);
    
    // Get all available providers
    const availableProviders = await getAvailableEmailProviders();
    console.log('\n📋 All Available Providers:', availableProviders.join(', '));
    
    // Check service instance availability
    const emailService = createEmailService('crunchycone');
    const serviceAvailable = await emailService.isAvailable();
    console.log(`🔧 CrunchyCone service instance available: ${serviceAvailable ? '✅ Yes' : '❌ No'}`);
    
    // Demonstrate graceful fallback
    console.log('\n🔄 Graceful Provider Selection:');
    let selectedProvider = 'console'; // fallback
    
    if (await isEmailProviderAvailable('crunchycone')) {
      selectedProvider = 'crunchycone';
    } else if (await isEmailProviderAvailable('sendgrid')) {
      selectedProvider = 'sendgrid';
    }
    
    console.log(`🎯 Selected provider: ${selectedProvider}`);
    
  } catch (error) {
    console.error('💥 Error checking provider availability:', error);
  }
}

async function main() {
  console.log('🔧 CrunchyCone Email Service Examples');
  console.log('='.repeat(50));
  
  // Check if API key is available (env var or keychain)
  try {
    const hasKey = await hasCrunchyConeAPIKey();
    if (!hasKey && !process.env.CRUNCHYCONE_API_KEY) {
      console.error('❌ CrunchyCone API key not found');
      console.log('💡 Either:');
      console.log('   1. Set CRUNCHYCONE_API_KEY environment variable, or');
      console.log('   2. Run: crunchycone auth login');
      process.exit(1);
    }

    const apiKey = await getCrunchyConeAPIKeyWithFallback();
    console.log(`🔑 API Key: ${apiKey.substring(0, 10)}...`);
    console.log(`🌐 Base URL: ${process.env.CRUNCHYCONE_API_URL || 'https://api.crunchycone.com'}`);
    
    if (process.env.CRUNCHYCONE_API_KEY) {
      console.log('📝 Using API key from environment variable');
    } else {
      console.log('🔐 Using API key from keychain (crunchycone-cli)');
    }

    await providerAvailabilityExample();
    await basicEmailExample();
    await sensitiveEmailExample();
    await multipleRecipientsExample();
    await getEmailStatusExample();
    
    // Wait a bit before listing emails to let previous sends complete
    setTimeout(async () => {
      await listEmailsExample();
    }, 3000);
    
  } catch (error) {
    console.error('💥 Authentication error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// CLI Usage Instructions
if (require.main === module) {
  console.log(`
📧 CrunchyCone Email Service Usage Examples

To run these examples, set up authentication and configuration:

OPTION 1: Use crunchycone-cli (Recommended for local development)
1. Install and authenticate with crunchycone-cli:
   npm install -g crunchycone-cli
   crunchycone auth login

OPTION 2: Use environment variables
1. Create a .env file with:
   CRUNCHYCONE_API_KEY=your_api_key_here
   CRUNCHYCONE_API_URL=https://api.crunchycone.com  # Optional
   CRUNCHYCONE_PROJECT_ID=your_project_id           # Optional

OPTION 3: Use crunchycone.toml configuration file (Recommended)
1. Create a crunchycone.toml file in your project root:
   environment = "dev"  # or "prod"
   [project]
   id = "your-project-id"

2. Run the examples:
   npx ts-node examples/crunchycone-email-usage.ts

Or use the email test CLI:
   npm run email-test -- --provider crunchycone --to "test@example.com" --subject "Test" --body "Hello World!"

For sensitive emails (won't store content):
   npm run email-test -- --provider crunchycone --to "user@example.com" --subject "OTP Code" --body "Your code: 123456" --special

For templated emails:
   npm run email-test -- --provider crunchycone --to "user@example.com" --template welcome
  `);
  
  main();
}

export {
  basicEmailExample,
  sensitiveEmailExample,
  multipleRecipientsExample,
  getEmailStatusExample,
  listEmailsExample,
  providerAvailabilityExample
};