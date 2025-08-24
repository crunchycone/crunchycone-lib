#!/usr/bin/env ts-node

import { config } from 'dotenv';
import { join } from 'path';
import { promises as fs } from 'fs';
import { 
  initializeStorageProvider, 
  uploadFile, 
  validateFile, 
  generateExternalId,
  getCommonValidationOptions,
  formatBytes,
  findFileByExternalId,
} from '../services/storage';

config();

async function testStorageSystem() {
  console.log('🚀 Testing CrunchyCone Storage System\n');

  try {
    // Initialize storage provider
    console.log('📦 Initializing storage provider...');
    initializeStorageProvider();
    console.log('✅ Storage provider initialized\n');

    // Create a test file
    const testFileName = 'test-file.txt';
    const testFilePath = join(__dirname, testFileName);
    const testContent = `Test file created at ${new Date().toISOString()}\nThis is a test upload for the CrunchyCone storage system.`;
    
    await fs.writeFile(testFilePath, testContent);
    console.log(`📝 Created test file: ${testFileName}`);

    // Create a mock file object for validation
    const mockFile = {
      name: testFileName,
      size: Buffer.byteLength(testContent),
      type: 'text/plain',
    };

    // Test file validation
    console.log('\n🔍 Testing file validation...');
    const validation = validateFile(mockFile, getCommonValidationOptions().permissive);
    
    if (validation.valid) {
      console.log('✅ File validation passed');
    } else {
      console.log(`❌ File validation failed: ${validation.error}`);
      return;
    }

    // Generate external ID for easy lookup
    const externalId = generateExternalId();
    console.log(`🆔 Generated external ID: ${externalId}`);

    // Test file upload using file path
    console.log('\n⬆️  Testing file upload...');
    const uploadResult = await uploadFile({
      filePath: testFilePath,
      external_id: externalId,
      filename: testFileName,
      contentType: 'text/plain',
      size: mockFile.size,
      public: true,
      metadata: {
        testUpload: 'true',
        environment: 'development',
      },
    });

    console.log('✅ File uploaded successfully!');
    console.log(`   🆔 External ID: ${uploadResult.external_id}`);
    console.log(`   📍 Key: ${uploadResult.key}`);
    console.log(`   🌐 URL: ${uploadResult.url}`);
    console.log(`   📦 Size: ${formatBytes(uploadResult.size)}`);
    console.log(`   📄 Content Type: ${uploadResult.contentType}`);
    
    if (uploadResult.etag) {
      console.log(`   🏷️  ETag: ${uploadResult.etag}`);
    }

    // Test finding file by external ID
    console.log('\n🔍 Testing file lookup by external ID...');
    const foundFile = await findFileByExternalId(externalId);
    
    if (foundFile) {
      console.log('✅ File found by external ID!');
      console.log(`   🆔 External ID: ${foundFile.external_id}`);
      console.log(`   📍 Key: ${foundFile.key}`);
      console.log(`   🌐 URL: ${foundFile.url}`);
    } else {
      console.log('❌ File not found by external ID');
    }

    // Clean up test file
    await fs.unlink(testFilePath);
    console.log('\n🧹 Cleaned up test file');

    console.log('\n🎉 Storage system test completed successfully!');

  } catch (error) {
    console.error('\n❌ Storage system test failed:');
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

async function showConfig() {
  console.log('🔧 Storage Configuration:');
  console.log(`   Provider: ${process.env.CRUNCHYCONE_STORAGE_PROVIDER || 'local (default)'}`);
  
  const provider = process.env.CRUNCHYCONE_STORAGE_PROVIDER || 'local';
  
  switch (provider.toLowerCase()) {
    case 'local':
      console.log(`   Base Path: ${process.env.CRUNCHYCONE_STORAGE_BASE_PATH || './uploads (default)'}`);
      console.log(`   Base URL: ${process.env.CRUNCHYCONE_STORAGE_BASE_URL || '/uploads (default)'}`);
      break;
    case 'aws':
    case 's3':
      console.log(`   Region: ${process.env.CRUNCHYCONE_AWS_REGION || 'Not set'}`);
      console.log(`   Bucket: ${process.env.CRUNCHYCONE_S3_BUCKET || 'Not set'}`);
      break;
    case 'digitalocean':
      console.log(`   Region: ${process.env.CRUNCHYCONE_DIGITALOCEAN_SPACES_REGION || 'Not set'}`);
      console.log(`   Space: ${process.env.CRUNCHYCONE_DIGITALOCEAN_SPACES_BUCKET || 'Not set'}`);
      break;
    default:
      console.log('   Custom configuration');
  }
  console.log('');
}

if (require.main === module) {
  showConfig().then(() => testStorageSystem());
}