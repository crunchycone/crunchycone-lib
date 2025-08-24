#!/usr/bin/env ts-node

import { sendTemplatedEmail, getEmailTemplateService } from '../services/email/templates';

async function main() {
  console.log('🚀 Email Templates Example');
  console.log('');

  // Example 1: Send a templated email
  try {
    console.log('📧 Sending welcome email...');
    
    await sendTemplatedEmail({
      template: 'welcome',
      to: 'user@example.com',
      language: 'en',
      data: {
        name: 'John Doe',
        appName: 'CrunchyCone',
        supportEmail: 'support@crunchycone.com',
        ctaUrl: 'https://app.crunchycone.com/dashboard',
        ctaText: 'Get Started',
        isTrialUser: true,
        trialDays: 14,
      },
    });
    
    console.log('✅ Email sent successfully!');
  } catch (error) {
    console.error('❌ Failed to send email:', error);
  }

  // Example 2: Preview a template
  try {
    console.log('');
    console.log('👀 Previewing Spanish template...');
    
    const service = getEmailTemplateService();
    const preview = await service.previewTemplate('welcome', {
      name: 'Juan Pérez',
      appName: 'CrunchyCone',
      supportEmail: 'support@crunchycone.com',
      ctaUrl: 'https://app.crunchycone.com/dashboard',
      ctaText: 'Comenzar',
      isTrialUser: true,
      trialDays: 7,
    }, 'es');

    console.log('Subject:', preview.subject);
    console.log('Language:', preview.metadata.language);
    console.log('Fallback used:', preview.metadata.fallbackUsed);
    console.log('');
    console.log('Text Preview:');
    console.log(preview.text);
  } catch (error) {
    console.error('❌ Failed to preview template:', error);
  }

  // Example 3: List available templates
  try {
    console.log('');
    console.log('📂 Available templates:');
    
    const service = getEmailTemplateService();
    const templates = await service.getAvailableTemplates();
    
    templates.forEach(template => {
      console.log(`• ${template.name}`);
      console.log(`  Languages: ${template.languages.join(', ')}`);
      if (template.description) {
        console.log(`  Description: ${template.description}`);
      }
      console.log('');
    });
  } catch (error) {
    console.error('❌ Failed to list templates:', error);
  }
}

if (require.main === module) {
  main().catch(console.error);
}