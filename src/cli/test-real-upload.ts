#!/usr/bin/env npx ts-node

/**
 * Real upload test script for CrunchyCone storage provider
 * This script tests actual file uploads to demonstrate enhanced error logging
 */

import { CrunchyConeProvider } from '../services/storage/providers/crunchycone';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

async function createTestFile(): Promise<string> {
  // Create a temporary test file
  const tempDir = os.tmpdir();
  const testFileName = `crunchycone-test-${Date.now()}.txt`;
  const testFilePath = path.join(tempDir, testFileName);
  
  const testContent = `CrunchyCone Storage Test File
Created: ${new Date().toISOString()}
Test ID: ${Math.random().toString(36).substring(7)}
Content: This is a test file to verify CrunchyCone storage uploads work correctly.
The enhanced error logging should provide detailed information if this upload fails.
`;

  await fs.promises.writeFile(testFilePath, testContent);
  console.log(`✅ Created test file: ${testFilePath}`);
  console.log(`📏 File size: ${testContent.length} bytes`);
  
  return testFilePath;
}

async function testRealUpload() {
  console.log('🧪 CrunchyCone Real Upload Test\n');
  
  try {
    // Check if we have the required environment variables
    if (!process.env.CRUNCHYCONE_PROJECT_ID) {
      console.error('❌ CRUNCHYCONE_PROJECT_ID environment variable is required');
      console.log('Please set it with: export CRUNCHYCONE_PROJECT_ID=your-project-id');
      process.exit(1);
    }

    console.log('🔧 Configuration:');
    console.log(`Project ID: ${process.env.CRUNCHYCONE_PROJECT_ID}`);
    console.log(`API URL: ${process.env.CRUNCHYCONE_API_URL || 'https://api.crunchycone.com'}`);
    console.log(`Platform Mode: ${process.env.CRUNCHYCONE_PLATFORM || 'false'}\n`);

    // Create the provider
    console.log('🏗️ Creating CrunchyCone provider...');
    const provider = new CrunchyConeProvider();
    
    // Verify provider is available
    const isAvailable = await provider.isAvailable();
    console.log(`Provider available: ${isAvailable}\n`);

    // Create a test file
    console.log('📄 Creating test file...');
    const testFilePath = await createTestFile();
    
    try {
      // Test 1: Upload from file path
      console.log('\n🚀 Test 1: Upload from file path');
      const result1 = await provider.uploadFile({
        filePath: testFilePath,
        filename: 'test-upload-from-path.txt',
        contentType: 'text/plain',
        external_id: `test-file-path-${Date.now()}`,
        metadata: {
          test_type: 'file_path_upload',
          created_by: 'test-real-upload-script',
        },
      });
      
      console.log('✅ Upload successful!');
      console.log('Upload result:', {
        external_id: result1.external_id,
        key: result1.key,
        size: result1.size,
        contentType: result1.contentType,
        url: result1.url?.substring(0, 50) + '...',
      });

      // Test 2: Upload from buffer
      console.log('\n🚀 Test 2: Upload from buffer');
      const fileContent = await fs.promises.readFile(testFilePath);
      const result2 = await provider.uploadFile({
        buffer: fileContent,
        filename: 'test-upload-from-buffer.txt',
        contentType: 'text/plain',
        external_id: `test-buffer-${Date.now()}`,
        metadata: {
          test_type: 'buffer_upload',
          created_by: 'test-real-upload-script',
        },
      });
      
      console.log('✅ Buffer upload successful!');
      console.log('Upload result:', {
        external_id: result2.external_id,
        key: result2.key,
        size: result2.size,
        contentType: result2.contentType,
      });

      // Test 3: Test file operations
      console.log('\n🔍 Test 3: File operations');
      
      const exists = await provider.fileExistsByExternalId(result1.external_id!);
      console.log(`File exists: ${exists}`);
      
      if (exists) {
        const fileInfo = await provider.findFileByExternalId(result1.external_id!);
        console.log('File info:', {
          external_id: fileInfo?.external_id,
          key: fileInfo?.key,
          size: fileInfo?.size,
          contentType: fileInfo?.contentType,
        });
        
        const downloadUrl = await provider.getFileUrlByExternalId(result1.external_id!);
        console.log(`Download URL generated: ${downloadUrl.substring(0, 50)}...`);
      }

      console.log('\n🎉 All tests passed! The enhanced error logging is working with real API calls.');
      
    } finally {
      // Clean up test file
      try {
        await fs.promises.unlink(testFilePath);
        console.log(`🗑️ Cleaned up test file: ${testFilePath}`);
      } catch (error) {
        console.warn(`⚠️ Could not clean up test file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
  } catch (error) {
    console.error('\n❌ Test failed with error:');
    console.error(error instanceof Error ? error.message : 'Unknown error');
    
    if (error instanceof Error && error.message.includes('Upload failed at')) {
      console.log('\n💡 This demonstrates the enhanced error logging in action!');
      console.log('The detailed error information above should help identify the issue.');
    }
    
    process.exit(1);
  }
}

// Handle script execution
if (require.main === module) {
  testRealUpload().catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
}

export { testRealUpload, createTestFile };