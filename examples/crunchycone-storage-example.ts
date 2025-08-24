#!/usr/bin/env node

/**
 * CrunchyCone Storage Provider Example
 * 
 * This example demonstrates how to use the CrunchyCone Storage Provider
 * which integrates with the CrunchyCone Storage Service API.
 * 
 * The CrunchyCone provider uses a two-step upload process:
 * 1. Create file descriptor (metadata + presigned upload URL)
 * 2. Upload file content to presigned URL + mark complete
 */

import { CrunchyConeProvider } from '../src/services/storage/providers/crunchycone';

async function demonstrateCrunchyConeStorage() {
  console.log('🔧 CrunchyCone Storage Provider Example');
  console.log('=====================================\n');

  // Initialize the provider
  const provider = new CrunchyConeProvider({
    apiUrl: process.env.CRUNCHYCONE_API_URL || 'https://api.crunchycone.com',
    apiKey: process.env.CRUNCHYCONE_API_KEY || 'your-api-key',
    projectId: process.env.CRUNCHYCONE_PROJECT_ID || 'your-project-id',
    userId: process.env.CRUNCHYCONE_USER_ID || 'user-123',
    timeout: 30000,
  });

  console.log('✅ Provider initialized');
  console.log(`   API URL: ${process.env.CRUNCHYCONE_API_URL || 'https://api.crunchycone.com'}`);
  console.log(`   Project ID: ${process.env.CRUNCHYCONE_PROJECT_ID || 'your-project-id'}`);
  console.log(`   User ID: ${process.env.CRUNCHYCONE_USER_ID || 'user-123'}\n`);

  // Example 1: Document Upload with Rich Metadata
  console.log('📄 Example 1: Document Upload with Rich Metadata');
  console.log('---------------------------------------------------');
  
  const documentBuffer = Buffer.from(`
    INVOICE #INV-2025-001
    =====================
    
    Date: January 15, 2025
    Customer: Acme Corporation
    Amount: $1,250.00
    
    Services:
    - Web Development: $1,000.00
    - Hosting Setup: $250.00
    
    Total: $1,250.00
  `);

  try {
    const documentResult = await provider.uploadFile({
      external_id: 'invoice-2025-q1-001',
      buffer: documentBuffer,
      filename: 'invoice-january.pdf',
      contentType: 'application/pdf',
      metadata: {
        type: 'invoice',
        quarter: 'Q1',
        year: '2025',
        invoice_number: 'INV-001',
        amount: '1250.00',
        currency: 'USD',
        customer: 'acme-corp',
        status: 'sent'
      }
    });

    console.log('✅ Document uploaded successfully:');
    console.log(`   External ID: ${documentResult.external_id}`);
    console.log(`   Storage Key: ${documentResult.key}`);
    console.log(`   Download URL: ${documentResult.url}`);
    console.log(`   Size: ${documentResult.size} bytes`);
    console.log(`   Content Type: ${documentResult.contentType}`);
    console.log(`   Metadata: ${JSON.stringify(documentResult.metadata, null, 2)}\n`);
  } catch (error) {
    console.error('❌ Document upload failed:', error);
  }

  // Example 2: User Avatar Upload
  console.log('👤 Example 2: User Avatar Upload');
  console.log('----------------------------------');

  const avatarBuffer = Buffer.from('fake-image-data-for-avatar');

  try {
    // First, try to delete existing avatar
    try {
      await provider.deleteFileByExternalId('avatar-user-123');
      console.log('🗑️ Deleted existing avatar');
    } catch (error) {
      console.log('ℹ️ No existing avatar to delete');
    }

    const avatarResult = await provider.uploadFile({
      external_id: 'avatar-user-123',
      key: 'avatars/users/123/profile.jpg',
      buffer: avatarBuffer,
      filename: 'profile.jpg',
      contentType: 'image/jpeg',
      metadata: {
        type: 'avatar',
        user_id: '123',
        size: 'large',
        uploaded_by: 'user',
        source: 'profile_update'
      }
    });

    console.log('✅ Avatar uploaded successfully:');
    console.log(`   External ID: ${avatarResult.external_id}`);
    console.log(`   Storage Key: ${avatarResult.key}`);
    console.log(`   Download URL: ${avatarResult.url}\n`);
  } catch (error) {
    console.error('❌ Avatar upload failed:', error);
  }

  // Example 3: Find and Retrieve Files
  console.log('🔍 Example 3: Find and Retrieve Files');
  console.log('--------------------------------------');

  try {
    // Find the invoice
    const invoiceFile = await provider.findFileByExternalId('invoice-2025-q1-001');
    if (invoiceFile) {
      console.log('✅ Found invoice file:');
      console.log(`   External ID: ${invoiceFile.external_id}`);
      console.log(`   Size: ${invoiceFile.size} bytes`);
      console.log(`   Content Type: ${invoiceFile.contentType}`);
      console.log(`   Last Modified: ${invoiceFile.lastModified}`);
      console.log(`   Metadata: ${JSON.stringify(invoiceFile.metadata, null, 2)}`);
    } else {
      console.log('❌ Invoice file not found');
    }

    // Check if avatar exists
    const avatarExists = await provider.fileExistsByExternalId('avatar-user-123');
    console.log(`✅ Avatar exists: ${avatarExists}`);

    // Get download URL for avatar
    if (avatarExists) {
      const avatarDownloadUrl = await provider.getFileUrlByExternalId('avatar-user-123');
      console.log(`✅ Avatar download URL: ${avatarDownloadUrl}`);
    }
  } catch (error) {
    console.error('❌ File retrieval failed:', error);
  }

  // Example 4: User ID Management
  console.log('\n🔄 Example 4: User ID Management');
  console.log('----------------------------------');

  console.log('Original user ID: user-123');
  
  // Switch to different user
  provider.setUserId('user-456');
  console.log('✅ Changed user ID to: user-456');

  try {
    // Try to find the invoice as different user (should fail)
    const invoiceAsOtherUser = await provider.findFileByExternalId('invoice-2025-q1-001');
    if (invoiceAsOtherUser) {
      console.log('⚠️ Found invoice as different user (unexpected)');
    } else {
      console.log('✅ Invoice not found as different user (expected - user isolation)');
    }
  } catch (error) {
    console.log('✅ Access denied for different user (expected - user isolation)');
  }

  // Switch back to original user
  provider.setUserId('user-123');
  console.log('✅ Changed user ID back to: user-123');

  console.log('\n🎉 CrunchyCone Storage Provider Demo Complete!');
  console.log('\nKey Features Demonstrated:');
  console.log('• Two-step upload process (create descriptor → upload content)');
  console.log('• External ID management for easy file identification');
  console.log('• Rich metadata storage and retrieval');
  console.log('• User isolation and access control');
  console.log('• File existence checking and URL generation');
  console.log('• Custom storage keys and paths');
}

// Configuration check
function checkConfiguration() {
  const required = ['CRUNCHYCONE_API_URL', 'CRUNCHYCONE_API_KEY', 'CRUNCHYCONE_PROJECT_ID'];
  const missing = required.filter(env => !process.env[env]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(env => console.error(`   ${env}`));
    console.error('\nPlease set these environment variables:');
    console.error('export CRUNCHYCONE_API_URL="https://api.crunchycone.com"');
    console.error('export CRUNCHYCONE_API_KEY="your-api-key"');
    console.error('export CRUNCHYCONE_PROJECT_ID="your-project-id"');
    console.error('export CRUNCHYCONE_USER_ID="user-123"  # Optional');
    process.exit(1);
  }
}

// Run the example
if (require.main === module) {
  checkConfiguration();
  demonstrateCrunchyConeStorage().catch(console.error);
}

export { demonstrateCrunchyConeStorage };