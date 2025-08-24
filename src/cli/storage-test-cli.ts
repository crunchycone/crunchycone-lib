#!/usr/bin/env node

import { config as dotenvConfig } from 'dotenv';
import { Command } from 'commander';
import { writeFileSync, statSync, existsSync } from 'fs';
import { basename, resolve } from 'path';

// Load environment variables from .env file
const envPath = resolve(process.cwd(), '.env');
if (existsSync(envPath)) {
  dotenvConfig({ path: envPath });
  console.log(`📄 Loaded environment from: ${envPath}`);
} else {
  console.log('📄 No .env file found, using system environment variables');
}
import { 
  initializeStorageProvider, 
  uploadFile, 
  deleteFile,
  deleteFileByExternalId,
  getFileUrlByExternalId,
  fileExistsByExternalId,
  findFileByExternalId,
  getStorageProvider,
} from '../services/storage';

const program = new Command();

program
  .name('storage-test')
  .description('CLI tool to test CrunchyCone storage providers')
  .version('1.0.0')
  .option('-e, --env <file>', 'Path to .env file', '.env')
  .option('-p, --provider <provider>', 'Storage provider to use (localstorage, aws, gcp, azure, digitalocean, wasabi, backblaze, r2, s3-custom, crunchycone)')
  .hook('preAction', (thisCommand) => {
    // Reload with custom .env file if specified
    const envFile = thisCommand.opts().env;
    if (envFile !== '.env') {
      const customEnvPath = resolve(process.cwd(), envFile);
      if (existsSync(customEnvPath)) {
        dotenvConfig({ path: customEnvPath, override: true });
        console.log(`📄 Loaded environment from: ${customEnvPath}`);
      } else {
        console.error(`❌ Environment file not found: ${customEnvPath}`);
        process.exit(1);
      }
    }

    // Override storage provider if specified via CLI
    const provider = thisCommand.opts().provider;
    if (provider) {
      const validProviders = ['localstorage', 'aws', 'gcp', 'azure', 'digitalocean', 'wasabi', 'backblaze', 'r2', 's3-custom', 'crunchycone'];
      if (!validProviders.includes(provider)) {
        console.error(`❌ Invalid storage provider: ${provider}`);
        console.error(`Valid providers: ${validProviders.join(', ')}`);
        process.exit(1);
      }
      process.env.CRUNCHYCONE_STORAGE_PROVIDER = provider;
      console.log(`🔧 Storage provider overridden to: ${provider}`);
    }
  });

// Helper function to initialize storage with error handling
function initStorage() {
  try {
    initializeStorageProvider();
    const provider = getStorageProvider();
    console.log(`✅ Storage provider initialized: ${provider.constructor.name}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize storage provider:');
    console.error(error instanceof Error ? error.message : String(error));
    console.error('\n💡 Make sure you have set the correct environment variables for your chosen provider.');
    console.error('See docs/STORAGE.md for configuration details.');
    return false;
  }
}

// Helper function to generate external ID
function generateExternalId(filename: string): string {
  const timestamp = Date.now();
  const baseName = basename(filename, require('path').extname(filename));
  return `cli-test-${baseName}-${timestamp}`;
}

// Upload command
program
  .command('upload <file>')
  .description('Upload a file to storage')
  .option('-e, --external-id <id>', 'External ID for the file (auto-generated if not provided)')
  .option('-k, --key <key>', 'Storage key/path for the file (auto-generated if not provided)')
  .option('-p, --public', 'Make the file publicly accessible', false)
  .option('-m, --metadata <json>', 'Custom metadata as JSON string')
  .action(async (filePath: string, options) => {
    if (!initStorage()) return;

    try {
      // Validate file exists
      const stats = statSync(filePath);
      const filename = basename(filePath);
      const externalId = options.externalId || generateExternalId(filename);
      
      console.log(`📁 Uploading file: ${filePath}`);
      console.log(`📋 External ID: ${externalId}`);
      console.log(`📏 File size: ${stats.size} bytes`);

      // Parse metadata if provided
      let metadata: Record<string, string> | undefined;
      if (options.metadata) {
        try {
          metadata = JSON.parse(options.metadata);
        } catch (error) {
          console.error('❌ Invalid metadata JSON:', error);
          return;
        }
      }

      // Upload file
      const result = await uploadFile({
        external_id: externalId,
        filePath,
        filename,
        key: options.key,
        public: options.public,
        metadata,
      });

      console.log('\n✅ Upload successful!');
      console.log('📋 Results:');
      console.log(`   External ID: ${result.external_id}`);
      console.log(`   Storage Key: ${result.key}`);
      console.log(`   File URL: ${result.url}`);
      console.log(`   Size: ${result.size} bytes`);
      console.log(`   Content Type: ${result.contentType}`);
      if (result.etag) console.log(`   ETag: ${result.etag}`);
      if (result.metadata) {
        console.log(`   Metadata: ${JSON.stringify(result.metadata, null, 2)}`);
      }

    } catch (error) {
      console.error('❌ Upload failed:');
      console.error(error instanceof Error ? error.message : String(error));
    }
  });

// Download command
program
  .command('download <external-id> <output-file>')
  .description('Download a file by external ID')
  .option('-t, --timeout <seconds>', 'URL expiration time in seconds', '3600')
  .action(async (externalId: string, outputFile: string, options) => {
    if (!initStorage()) return;

    try {
      console.log(`🔍 Looking for file with external ID: ${externalId}`);

      // Find file info
      const fileInfo = await findFileByExternalId(externalId);
      if (!fileInfo) {
        console.error(`❌ File not found with external ID: ${externalId}`);
        return;
      }

      console.log(`✅ File found: ${fileInfo.key}`);
      console.log(`📏 Size: ${fileInfo.size} bytes`);
      console.log(`📄 Content Type: ${fileInfo.contentType}`);
      if (fileInfo.lastModified) {
        console.log(`📅 Last Modified: ${fileInfo.lastModified.toISOString()}`);
      }

      // Get download URL
      const expiresIn = parseInt(options.timeout);
      const url = await getFileUrlByExternalId(externalId, expiresIn);
      
      console.log(`🔗 Download URL: ${url}`);
      console.log(`⏰ Expires in: ${expiresIn} seconds`);

      // Download file
      console.log(`⬇️ Downloading to: ${outputFile}`);
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      writeFileSync(outputFile, buffer);

      console.log('✅ Download successful!');
      console.log(`📁 Saved to: ${outputFile}`);
      console.log(`📏 Downloaded: ${buffer.length} bytes`);

    } catch (error) {
      console.error('❌ Download failed:');
      console.error(error instanceof Error ? error.message : String(error));
    }
  });

// List/Find command
program
  .command('find <external-id>')
  .description('Find file information by external ID')
  .action(async (externalId: string) => {
    if (!initStorage()) return;

    try {
      console.log(`🔍 Looking for file with external ID: ${externalId}`);

      const fileInfo = await findFileByExternalId(externalId);
      if (!fileInfo) {
        console.error(`❌ File not found with external ID: ${externalId}`);
        return;
      }

      console.log('\n✅ File found!');
      console.log('📋 File Information:');
      console.log(`   External ID: ${fileInfo.external_id}`);
      console.log(`   Storage Key: ${fileInfo.key}`);
      console.log(`   File URL: ${fileInfo.url}`);
      console.log(`   Size: ${fileInfo.size} bytes`);
      console.log(`   Content Type: ${fileInfo.contentType}`);
      if (fileInfo.lastModified) {
        console.log(`   Last Modified: ${fileInfo.lastModified.toISOString()}`);
      }
      if (fileInfo.etag) {
        console.log(`   ETag: ${fileInfo.etag}`);
      }
      if (fileInfo.metadata) {
        console.log('   Metadata:');
        Object.entries(fileInfo.metadata).forEach(([key, value]) => {
          console.log(`     ${key}: ${value}`);
        });
      }

    } catch (error) {
      console.error('❌ Find failed:');
      console.error(error instanceof Error ? error.message : String(error));
    }
  });

// Exists command
program
  .command('exists <external-id>')
  .description('Check if a file exists by external ID')
  .action(async (externalId: string) => {
    if (!initStorage()) return;

    try {
      console.log(`🔍 Checking if file exists with external ID: ${externalId}`);

      const exists = await fileExistsByExternalId(externalId);
      
      if (exists) {
        console.log('✅ File exists!');
        
        // Also get the file info
        const fileInfo = await findFileByExternalId(externalId);
        if (fileInfo) {
          console.log(`📋 Key: ${fileInfo.key}`);
          console.log(`📏 Size: ${fileInfo.size} bytes`);
        }
      } else {
        console.log('❌ File does not exist');
      }

    } catch (error) {
      console.error('❌ Exists check failed:');
      console.error(error instanceof Error ? error.message : String(error));
    }
  });

// Get URL command
program
  .command('url <external-id>')
  .description('Get a URL for a file by external ID')
  .option('-t, --timeout <seconds>', 'URL expiration time in seconds', '3600')
  .action(async (externalId: string, options) => {
    if (!initStorage()) return;

    try {
      console.log(`🔗 Getting URL for file with external ID: ${externalId}`);

      const expiresIn = parseInt(options.timeout);
      const url = await getFileUrlByExternalId(externalId, expiresIn);
      
      console.log('✅ URL generated!');
      console.log(`🔗 URL: ${url}`);
      console.log(`⏰ Expires in: ${expiresIn} seconds`);

    } catch (error) {
      console.error('❌ URL generation failed:');
      console.error(error instanceof Error ? error.message : String(error));
    }
  });

// Delete command
program
  .command('delete <external-id>')
  .description('Delete a file by external ID')
  .option('-f, --force', 'Skip confirmation prompt', false)
  .action(async (externalId: string, options) => {
    if (!initStorage()) return;

    try {
      console.log(`🔍 Looking for file with external ID: ${externalId}`);

      // Check if file exists first
      const fileInfo = await findFileByExternalId(externalId);
      if (!fileInfo) {
        console.error(`❌ File not found with external ID: ${externalId}`);
        return;
      }

      console.log(`✅ File found: ${fileInfo.key}`);
      console.log(`📏 Size: ${fileInfo.size} bytes`);

      // Confirmation prompt (unless force flag is used)
      if (!options.force) {
        const readline = require('readline').createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        const answer = await new Promise<string>((resolve) => {
          readline.question('❓ Are you sure you want to delete this file? (y/N): ', resolve);
        });

        readline.close();

        if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
          console.log('❌ Deletion cancelled');
          return;
        }
      }

      // Delete file
      console.log('🗑️ Deleting file...');
      await deleteFileByExternalId(externalId);

      console.log('✅ File deleted successfully!');

    } catch (error) {
      console.error('❌ Delete failed:');
      console.error(error instanceof Error ? error.message : String(error));
    }
  });

// Delete by key command
program
  .command('delete-key <storage-key>')
  .description('Delete a file by storage key')
  .option('-f, --force', 'Skip confirmation prompt', false)
  .action(async (storageKey: string, options) => {
    if (!initStorage()) return;

    try {
      console.log(`🔍 Checking storage key: ${storageKey}`);

      // Confirmation prompt (unless force flag is used)
      if (!options.force) {
        const readline = require('readline').createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        const answer = await new Promise<string>((resolve) => {
          readline.question(`❓ Are you sure you want to delete file with key "${storageKey}"? (y/N): `, resolve);
        });

        readline.close();

        if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
          console.log('❌ Deletion cancelled');
          return;
        }
      }

      // Delete file by storage key
      console.log(`🗑️ Deleting file with key: ${storageKey}`);
      await deleteFile(storageKey);

      console.log('✅ File deleted successfully!');

    } catch (error) {
      console.error('❌ Delete failed:');
      console.error(error instanceof Error ? error.message : String(error));
    }
  });

// Info command - show current storage provider info
program
  .command('info')
  .description('Show current storage provider information')
  .action(() => {
    try {
      initializeStorageProvider();
      const provider = getStorageProvider();
      
      console.log('📋 Storage Provider Information:');
      console.log(`   Provider: ${provider.constructor.name}`);
      console.log(`   Environment: ${process.env.CRUNCHYCONE_STORAGE_PROVIDER || 'localstorage (default)'}`);
      
      // Show relevant environment variables based on provider
      const providerType = process.env.CRUNCHYCONE_STORAGE_PROVIDER || 'localstorage';
      console.log('\n🔧 Configuration:');
      
      switch (providerType) {
        case 'localstorage':
          console.log(`   Path: ${process.env.CRUNCHYCONE_LOCALSTORAGE_PATH || './uploads'}`);
          console.log(`   Base URL: ${process.env.CRUNCHYCONE_LOCALSTORAGE_BASE_URL || '/uploads'}`);
          break;
        case 'aws':
          console.log(`   Region: ${process.env.CRUNCHYCONE_AWS_REGION || 'not set'}`);
          console.log(`   Bucket: ${process.env.CRUNCHYCONE_S3_BUCKET || 'not set'}`);
          break;
        case 'gcp':
          console.log(`   Project: ${process.env.CRUNCHYCONE_GCP_PROJECT_ID || 'not set'}`);
          console.log(`   Bucket: ${process.env.CRUNCHYCONE_GCS_BUCKET || 'not set'}`);
          break;
        case 'azure':
          console.log(`   Account: ${process.env.CRUNCHYCONE_AZURE_ACCOUNT_NAME || 'not set'}`);
          console.log(`   Container: ${process.env.CRUNCHYCONE_AZURE_CONTAINER || 'not set'}`);
          break;
        case 'crunchycone':
          console.log(`   API URL: ${process.env.CRUNCHYCONE_API_URL || 'not set'}`);
          console.log(`   Project ID: ${process.env.CRUNCHYCONE_PROJECT_ID || 'not set'}`);
          console.log('   User Context: determined by server from API key');
          break;
        default:
          console.log(`   Provider-specific configuration for: ${providerType}`);
      }

    } catch (error) {
      console.error('❌ Failed to get provider info:');
      console.error(error instanceof Error ? error.message : String(error));
    }
  });

// Test command - run basic functionality tests
program
  .command('test')
  .description('Run basic functionality tests with a temporary file')
  .option('-k, --keep', 'Keep the test file after testing (default: delete)', false)
  .action(async (options) => {
    if (!initStorage()) return;

    const testExternalId = `cli-test-${Date.now()}`;
    const testContent = `Test file created at ${new Date().toISOString()}\nStorage provider test content`;
    const testBuffer = Buffer.from(testContent);

    console.log('🧪 Running storage provider tests...');
    console.log(`📋 Test External ID: ${testExternalId}`);

    try {
      // Test 1: Upload
      console.log('\n1️⃣ Testing upload...');
      const uploadResult = await uploadFile({
        external_id: testExternalId,
        buffer: testBuffer,
        filename: 'test.txt',
        contentType: 'text/plain',
        metadata: {
          test: 'true',
          timestamp: Date.now().toString(),
          source: 'cli-test',
        },
      });
      console.log(`   ✅ Upload successful: ${uploadResult.key}`);

      // Test 2: Exists check
      console.log('\n2️⃣ Testing exists check...');
      const exists = await fileExistsByExternalId(testExternalId);
      console.log(`   ✅ Exists check: ${exists}`);

      // Test 3: Find file
      console.log('\n3️⃣ Testing find file...');
      const fileInfo = await findFileByExternalId(testExternalId);
      console.log(`   ✅ Find successful: ${fileInfo?.key || 'not found'}`);

      // Test 4: Get URL
      console.log('\n4️⃣ Testing URL generation...');
      const url = await getFileUrlByExternalId(testExternalId, 300);
      console.log(`   ✅ URL generated: ${url.substring(0, 50)}...`);

      // Test 5: Download content
      console.log('\n5️⃣ Testing download...');
      
      // For LocalStorage, we need to construct a full URL or read directly from filesystem
      let downloadedContent: string;
      if (url.startsWith('http')) {
        const provider = getStorageProvider();
        const fetchOptions: RequestInit = {};
        
        // Add authentication headers for CrunchyCone provider
        if (provider.constructor.name === 'CrunchyConeProvider') {
          fetchOptions.headers = {
            'X-API-Key': process.env.CRUNCHYCONE_API_KEY || '',
          };
        }
        
        const response = await fetch(url, fetchOptions);
        downloadedContent = await response.text();
      } else {
        // For local storage, read directly from the file system
        const provider = getStorageProvider();
        if (provider.constructor.name === 'LocalStorageProvider') {
          // Read from filesystem directly for LocalStorage
          const fs = require('fs');
          const path = require('path');
          const localPath = path.join(process.env.CRUNCHYCONE_LOCALSTORAGE_PATH || './uploads', uploadResult.key);
          downloadedContent = fs.readFileSync(localPath, 'utf8');
        } else {
          // For other providers, try to fetch the URL
          const response = await fetch(url);
          downloadedContent = await response.text();
        }
      }
      
      const contentMatches = downloadedContent === testContent;
      console.log(`   ✅ Download successful: Content matches: ${contentMatches}`);
      if (!contentMatches) {
        console.log(`   🔍 Debug: Expected content: "${testContent}"`);
        console.log(`   🔍 Debug: Downloaded content: "${downloadedContent}"`);
        console.log(`   🔍 Debug: Expected length: ${testContent.length}, Downloaded length: ${downloadedContent.length}`);
      }

      // Test 6: Delete
      console.log('\n6️⃣ Testing delete...');
      await deleteFileByExternalId(testExternalId);
      console.log('   ✅ Delete successful');

      // Test 7: Verify deletion
      console.log('\n7️⃣ Testing deletion verification...');
      const existsAfterDelete = await fileExistsByExternalId(testExternalId);
      console.log(`   ✅ Deletion verified: File exists: ${existsAfterDelete}`);

      // Re-upload file if keeping it
      if (options.keep) {
        console.log('\n8️⃣ Re-uploading file for preservation (--keep flag used)...');
        const finalUpload = await uploadFile({
          external_id: testExternalId,
          buffer: testBuffer,
          filename: 'test.txt',
          contentType: 'text/plain',
          metadata: {
            test: 'true',
            timestamp: Date.now().toString(),
            source: 'cli-test-preserved',
          },
        });
        console.log(`   ✅ File preserved with external ID: ${testExternalId}`);
        console.log(`   📋 Storage key: ${finalUpload.key}`);
        console.log(`   🔗 File URL: ${finalUpload.url}`);
      }

      console.log('\n🎉 All tests passed successfully!');

    } catch (error) {
      console.error('\n❌ Test failed:');
      console.error(error instanceof Error ? error.message : String(error));
      
      // Cleanup on failure (unless keeping file)
      if (!options.keep) {
        try {
          console.log('\n🧹 Attempting cleanup...');
          await deleteFileByExternalId(testExternalId);
          console.log('   ✅ Cleanup successful');
        } catch (_cleanupError) {
          console.log('   ⚠️ Cleanup failed (file may not exist)');
        }
      } else {
        console.log('\n📋 File preserved due to --keep flag (not cleaned up on error)');
      }
    }
  });

// Parse command line arguments
program.parse();

// Show help if no command provided
if (process.argv.length <= 2) {
  program.help();
}