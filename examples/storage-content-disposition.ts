/**
 * Example: Using Content Disposition Control with Storage Providers
 * 
 * This example demonstrates how to use the new content disposition feature
 * to control whether files are downloaded or displayed inline in browsers.
 */

import { CrunchyConeProvider } from '../src/services/storage/providers/crunchycone';
import { AWSS3Provider } from '../src/services/storage/providers/aws-s3';
import { DigitalOceanSpacesProvider } from '../src/services/storage/providers/digitalocean';

async function demonstrateContentDisposition() {
  // Initialize CrunchyCone provider
  const crunchycone = new CrunchyConeProvider({
    apiUrl: 'https://api.crunchycone.com',
    apiKey: 'your-api-key',
    projectId: 'your-project-id',
    userId: 'your-user-id',
  });

  // Example file external ID
  const imageFileId = 'profile-picture-123';
  const pdfFileId = 'document-456';

  console.log('=== Content Disposition Examples ===\n');

  // 1. Default behavior (attachment) - forces download
  console.log('1. Default behavior (forces download):');
  try {
    const downloadUrl = await crunchycone.getFileUrlByExternalId(imageFileId);
    console.log(`   Download URL: ${downloadUrl}`);
    console.log('   → Will force browser to download the file\n');
  } catch (error) {
    console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
  }

  // 2. Explicit attachment disposition - forces download
  console.log('2. Explicit attachment (forces download):');
  try {
    const attachmentUrl = await crunchycone.getFileUrlByExternalId(
      imageFileId, 
      3600, 
      { disposition: 'attachment' }
    );
    console.log(`   Attachment URL: ${attachmentUrl}`);
    console.log('   → Will force browser to download the file\n');
  } catch (error) {
    console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
  }

  // 3. Inline disposition - displays in browser
  console.log('3. Inline disposition (displays in browser):');
  try {
    const inlineUrl = await crunchycone.getFileUrlByExternalId(
      imageFileId, 
      3600, 
      { disposition: 'inline' }
    );
    console.log(`   Inline URL: ${inlineUrl}`);
    console.log('   → Will display image directly in browser\n');
  } catch (error) {
    console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
  }

  // 4. PDF example - inline for viewing, attachment for download
  console.log('4. PDF file examples:');
  try {
    const pdfViewUrl = await crunchycone.getFileUrlByExternalId(
      pdfFileId,
      3600,
      { disposition: 'inline' }
    );
    console.log(`   PDF View URL: ${pdfViewUrl}`);
    console.log('   → Will open PDF in browser viewer');

    const pdfDownloadUrl = await crunchycone.getFileUrlByExternalId(
      pdfFileId,
      3600,
      { disposition: 'attachment' }
    );
    console.log(`   PDF Download URL: ${pdfDownloadUrl}`);
    console.log('   → Will download PDF file\n');
  } catch (error) {
    console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
  }

  // 5. Working with other providers
  console.log('5. Content disposition with other providers:\n');

  // AWS S3 example
  console.log('   AWS S3 Provider:');
  try {
    const s3Provider = new AWSS3Provider({
      accessKeyId: 'your-access-key',
      secretAccessKey: 'your-secret-key',
      region: 'us-east-1',
      bucket: 'your-bucket'
    });

    const s3InlineUrl = await s3Provider.getFileUrl('images/photo.jpg', 3600, { disposition: 'inline' });
    console.log(`   S3 Inline URL: ${s3InlineUrl}`);
    console.log('   → Uses S3 ResponseContentDisposition parameter');
  } catch (error) {
    console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // DigitalOcean Spaces example
  console.log('\n   DigitalOcean Spaces Provider:');
  try {
    const spacesProvider = new DigitalOceanSpacesProvider({
      accessKeyId: 'your-access-key',
      secretAccessKey: 'your-secret-key',
      region: 'nyc3',
      bucket: 'your-space'
    });

    const spacesAttachmentUrl = await spacesProvider.getFileUrl('documents/report.pdf', 3600, { disposition: 'attachment' });
    console.log(`   Spaces Download URL: ${spacesAttachmentUrl}`);
    console.log('   → Uses S3-compatible ResponseContentDisposition parameter');
  } catch (error) {
    console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  console.log('\n=== Use Cases ===\n');
  
  console.log('• Image galleries: Use disposition: "inline" to display images directly');
  console.log('• Document viewers: Use disposition: "inline" for PDFs to open in browser');
  console.log('• File downloads: Use disposition: "attachment" to force download');
  console.log('• Media players: Use disposition: "inline" for audio/video content');
  console.log('• Backward compatibility: Omit the parameter for default behavior');

  console.log('\n=== Provider Support ===\n');
  
  console.log('✅ CrunchyCone: Full support via API disposition parameter');
  console.log('✅ AWS S3: Full support via ResponseContentDisposition');
  console.log('✅ DigitalOcean Spaces: Full support (S3-compatible)');
  console.log('✅ All S3-compatible providers: Full support');
  console.log('✅ Google Cloud: Full support via responseDisposition');
  console.log('✅ Azure: Full support via contentDisposition in SAS tokens');
  console.log('⚠️  LocalStorage: Parameter accepted but not implemented (depends on server setup)');
}

// Type-safe examples
function typeScriptExamples() {
  console.log('\n=== TypeScript Type Safety ===\n');

  // These are the only valid values (TypeScript will enforce this)
  const validDispositions = ['inline', 'attachment'] as const;
  
  validDispositions.forEach(disposition => {
    console.log(`Valid disposition: "${disposition}"`);
  });

  // Example of type-safe options object
  const fileUrlOptions = {
    disposition: 'inline' as const // TypeScript ensures this is 'inline' | 'attachment'
  };

  console.log('FileUrlOptions type ensures only valid disposition values are accepted');
}

// Run the examples
if (require.main === module) {
  demonstrateContentDisposition()
    .then(() => typeScriptExamples())
    .catch(console.error);
}

export { demonstrateContentDisposition, typeScriptExamples };