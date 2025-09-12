#!/usr/bin/env npx ts-node

/**
 * CrunchyCone Storage Visibility Management Examples
 * 
 * This example demonstrates how to use the new visibility update functionality
 * in the CrunchyCone storage provider to make files public or private.
 */

import { CrunchyConeProvider } from '../src/services/storage/providers/crunchycone';

async function main() {
  // Initialize the CrunchyCone storage provider
  const provider = new CrunchyConeProvider({
    apiUrl: process.env.CRUNCHYCONE_API_URL || 'https://api.crunchycone.dev',
    apiKey: process.env.CRUNCHYCONE_API_KEY!,
    projectId: process.env.CRUNCHYCONE_PROJECT_ID!,
  });

  console.log('🔧 CrunchyCone Storage Visibility Management Examples\n');

  try {
    // Example 1: Upload a file first
    console.log('1. Uploading a test file...');
    const uploadResult = await provider.uploadFile({
      external_id: 'visibility-demo-file',
      buffer: Buffer.from('This is a test file for visibility management'),
      filename: 'demo-file.txt',
      contentType: 'text/plain',
    });
    
    console.log(`   ✓ File uploaded: ${uploadResult.key}`);
    console.log(`   ✓ Current visibility: ${uploadResult.visibility}`);
    console.log();

    // Example 2: Make file public using storage key
    console.log('2. Making file public using storage key...');
    const publicResult = await provider.setFileVisibility(uploadResult.key, 'public');
    
    if (publicResult.success) {
      console.log('   ✓ File visibility updated to public');
      console.log(`   ✓ Public URL: ${publicResult.publicUrl}`);
      console.log(`   ✓ Message: ${publicResult.message}`);
    } else {
      console.log(`   ✗ Failed: ${publicResult.message}`);
    }
    console.log();

    // Example 3: Make file private using external ID
    console.log('3. Making file private using external ID...');
    const privateResult = await provider.setFileVisibilityByExternalId('visibility-demo-file', 'private');
    
    if (privateResult.success) {
      console.log('   ✓ File visibility updated to private');
      console.log(`   ✓ Message: ${privateResult.message}`);
    } else {
      console.log(`   ✗ Failed: ${privateResult.message}`);
    }
    console.log();

    // Example 4: Direct file ID method (most efficient when you have the file ID)
    console.log('4. Using direct file ID method...');
    
    // First, find the file to get its file_id
    const fileInfo = await provider.findFileByExternalId('visibility-demo-file');
    if (fileInfo) {
      // Extract file ID from the key or URL (this depends on your CrunchyCone setup)
      // In practice, you'd get this from your database or when uploading
      console.log(`   File found with key: ${fileInfo.key}`);
      
      // For demonstration, we'll use a mock file ID
      // In real usage, you'd have the actual file ID from your system
      console.log('   Note: In real usage, use the actual file ID from your upload response');
      
      // Mock example of using file ID directly:
      // const directResult = await provider.updateFileVisibilityById('actual-file-id-here', 'public');
      console.log('   Example: provider.updateFileVisibilityById(file_id, "public")');
    }
    console.log();

    // Example 5: Error handling
    console.log('5. Demonstrating error handling...');
    const errorResult = await provider.setFileVisibilityByExternalId('nonexistent-file', 'public');
    
    if (!errorResult.success) {
      console.log(`   ✓ Properly handled error: ${errorResult.message}`);
      console.log(`   ✓ Actual visibility: ${errorResult.actualVisibility}`);
    }
    console.log();

    // Example 6: Batch operations (if needed)
    console.log('6. Batch operations pattern...');
    const filesToUpdate = [
      { externalId: 'file1', visibility: 'public' as const },
      { externalId: 'file2', visibility: 'private' as const },
      { externalId: 'file3', visibility: 'public' as const },
    ];

    console.log('   Processing batch visibility updates...');
    const batchResults = await Promise.allSettled(
      filesToUpdate.map(({ externalId, visibility }) =>
        provider.setFileVisibilityByExternalId(externalId, visibility)
      )
    );

    batchResults.forEach((result, index) => {
      const { externalId, visibility } = filesToUpdate[index];
      if (result.status === 'fulfilled') {
        const updateResult = result.value;
        if (updateResult.success) {
          console.log(`   ✓ ${externalId}: updated to ${visibility}`);
        } else {
          console.log(`   ✗ ${externalId}: ${updateResult.message}`);
        }
      } else {
        console.log(`   ✗ ${externalId}: ${result.reason.message}`);
      }
    });
    console.log();

    // Example 7: API Response Details
    console.log('7. Understanding API responses...');
    console.log(`
   The visibility API returns:
   - success: boolean (whether the operation succeeded)
   - requestedVisibility: 'public' | 'private' (what you requested)
   - actualVisibility: 'public' | 'private' (what was actually set)
   - publicUrl?: string (direct public URL when visibility is 'public')
   - message?: string (success or error message)
   - providerSpecific?: object (additional CrunchyCone-specific data)
    `);

    // Clean up: delete the test file
    console.log('8. Cleaning up test file...');
    await provider.deleteFileByExternalId('visibility-demo-file');
    console.log('   ✓ Test file deleted');

    console.log('\n✅ All examples completed successfully!');

  } catch (error) {
    console.error('\n❌ Error running examples:', error);
    process.exit(1);
  }
}

// API Endpoint Reference
console.log(`
📚 CrunchyCone Visibility API Reference:

1. Update by File ID:
   PATCH /api/v1/storage/files/{file_id}/visibility
   Body: {"visibility": "public"}

2. Update by External ID:
   PATCH /api/v1/storage/files/by-external-id/{external_id}/visibility
   Body: {"visibility": "private"}

Headers:
- Content-Type: application/json
- X-API-Key: your-api-key-here

Response:
{
  "data": {
    "success": true,
    "message": "File visibility updated to public",
    "public_url": "https://bucket.region.digitaloceanspaces.com/path/to/file.png"
  }
}

📋 Key Features:
- Updates actual S3/DigitalOcean ACLs, not just metadata
- Returns direct public URLs when set to public
- Supports both file ID and external ID lookups
- Comprehensive error handling
- Works with completed uploads only
`);

if (require.main === module) {
  main().catch(console.error);
}

export { main };