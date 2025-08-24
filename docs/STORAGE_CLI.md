# Storage Test CLI

A comprehensive command-line tool for testing all CrunchyCone storage providers. This CLI allows you to upload, download, delete, and manage files across different storage backends.

## Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your storage provider credentials
   ```

3. **Run the CLI**:
   ```bash
   npm run storage-cli -- --help
   ```

## Configuration

### Environment File

The CLI automatically loads environment variables from `.env` in the current directory. You can specify a different file using the `--env` option:

```bash
npm run storage-cli -- --env .env.production info
```

### Provider Examples

Copy and modify the relevant section from `.env.example`:

**LocalStorage (Default)**:
```bash
CRUNCHYCONE_STORAGE_PROVIDER=localstorage
LOCALSTORAGE_PATH=./uploads
LOCALSTORAGE_BASE_URL=/uploads
```

**AWS S3**:
```bash
CRUNCHYCONE_STORAGE_PROVIDER=aws
CRUNCHYCONE_AWS_ACCESS_KEY_ID=your_access_key
CRUNCHYCONE_AWS_SECRET_ACCESS_KEY=your_secret_key
CRUNCHYCONE_AWS_REGION=us-east-1
CRUNCHYCONE_S3_BUCKET=my-bucket
```

**Google Cloud Storage**:
```bash
CRUNCHYCONE_STORAGE_PROVIDER=gcp
CRUNCHYCONE_GCP_PROJECT_ID=my-project
CRUNCHYCONE_GCP_KEY_FILE=/path/to/service-account.json
CRUNCHYCONE_GCS_BUCKET=my-bucket
```

**Azure Blob Storage**:
```bash
CRUNCHYCONE_STORAGE_PROVIDER=azure
CRUNCHYCONE_AZURE_ACCOUNT_NAME=myaccount
CRUNCHYCONE_AZURE_ACCOUNT_KEY=my_key
CRUNCHYCONE_AZURE_CONTAINER=my-container
```

**CrunchyCone Storage Service**:
```bash
CRUNCHYCONE_STORAGE_PROVIDER=crunchycone
CRUNCHYCONE_API_URL=https://api.crunchycone.com
CRUNCHYCONE_API_KEY=your-api-key
CRUNCHYCONE_PROJECT_ID=your-project-id
# User context is determined server-side from the API key
CRUNCHYCONE_TIMEOUT=30000  # Optional: request timeout in ms
```

## Commands

### Show Help
```bash
npm run storage-cli -- --help
```

### Override Storage Provider
You can override the storage provider directly from the command line without modifying environment files:

```bash
# Use AWS S3 provider
npm run storage-cli -- --provider aws info

# Use Google Cloud Storage
npm run storage-cli -- --provider gcp test

# Use Azure Blob Storage  
npm run storage-cli -- --provider azure upload file.jpg

# Combine with custom env file
npm run storage-cli -- --env .env.production --provider aws test
```

Valid providers: `localstorage`, `aws`, `gcp`, `azure`, `digitalocean`, `wasabi`, `backblaze`, `r2`, `s3-custom`, `crunchycone`

### Provider Information
Show current storage provider configuration:
```bash
npm run storage-cli info
```

### Upload Files

Upload a file with auto-generated external ID:
```bash
npm run storage-cli upload /path/to/file.jpg
```

Upload with custom external ID:
```bash
npm run storage-cli upload /path/to/file.jpg --external-id user-123-avatar
```

Upload with custom storage key:
```bash
npm run storage-cli upload /path/to/file.jpg --key users/123/avatar.jpg
```

Upload as public file:
```bash
npm run storage-cli upload /path/to/file.jpg --public
```

Upload with metadata:
```bash
npm run storage-cli upload /path/to/file.jpg --metadata '{"userId":"123","type":"avatar"}'
```

### Download Files

Download a file by external ID:
```bash
npm run storage-cli download user-123-avatar ./downloaded-avatar.jpg
```

Download with custom URL expiration:
```bash
npm run storage-cli download user-123-avatar ./file.jpg --timeout 7200
```

### Find Files

Get file information:
```bash
npm run storage-cli find user-123-avatar
```

Check if file exists:
```bash
npm run storage-cli exists user-123-avatar
```

### Get URLs

Generate a download URL:
```bash
npm run storage-cli url user-123-avatar
```

Generate URL with custom expiration:
```bash
npm run storage-cli url user-123-avatar --timeout 3600
```

### Delete Files

Delete with confirmation:
```bash
npm run storage-cli delete user-123-avatar
```

Force delete without confirmation:
```bash
npm run storage-cli delete user-123-avatar --force
```

### Run Tests

Run comprehensive functionality tests:
```bash
npm run storage-cli test
```

This command will:
1. Upload a test file
2. Verify it exists
3. Find the file info
4. Generate a download URL
5. Download and verify content
6. Delete the file
7. Verify deletion

## Examples

### Complete Workflow Example

```bash
# 1. Check current provider
npm run storage-cli info

# 2. Upload a user avatar
npm run storage-cli upload ./avatar.jpg --external-id user-123-avatar --metadata '{"userId":"123","type":"avatar"}'

# 3. Verify upload
npm run storage-cli find user-123-avatar

# 4. Get download URL
npm run storage-cli url user-123-avatar --timeout 3600

# 5. Download file
npm run storage-cli download user-123-avatar ./downloaded-avatar.jpg

# 6. Clean up
npm run storage-cli delete user-123-avatar --force
```

### Testing Different Providers

Using environment files:
```bash
# Test LocalStorage
npm run storage-cli -- --env .env.local test

# Test AWS S3
npm run storage-cli -- --env .env.aws test

# Test Google Cloud
npm run storage-cli -- --env .env.gcp test

# Test Azure
npm run storage-cli -- --env .env.azure test
```

Using CLI provider override:
```bash
# Test LocalStorage (default configuration)
npm run storage-cli -- --provider localstorage test

# Test AWS S3 (with current environment)
npm run storage-cli -- --provider aws test

# Test Google Cloud (with current environment)
npm run storage-cli -- --provider gcp test

# Test Azure (with current environment)
npm run storage-cli -- --provider azure test

# Test CrunchyCone Storage (with current environment)
npm run storage-cli -- --provider crunchycone test

# Combine both approaches
npm run storage-cli -- --env .env.production --provider aws test
```

### Bulk Operations

```bash
# Upload multiple files
for file in ./images/*.jpg; do
  npm run storage-cli upload "$file" --external-id "image-$(basename "$file" .jpg)"
done

# Check all uploaded files
for id in image-1 image-2 image-3; do
  npm run storage-cli exists "$id"
done
```

## Output Examples

### Upload Success
```
📄 Loaded environment from: /path/to/.env
✅ Storage provider initialized: AWSS3Provider
📁 Uploading file: ./avatar.jpg
📋 External ID: user-123-avatar
📏 File size: 15234 bytes

✅ Upload successful!
📋 Results:
   External ID: user-123-avatar
   Storage Key: files/user-123-avatar-1705312245123.jpg
   File URL: https://my-bucket.s3.us-east-1.amazonaws.com/files/user-123-avatar-1705312245123.jpg
   Size: 15234 bytes
   Content Type: image/jpeg
   ETag: "d41d8cd98f00b204e9800998ecf8427e"
   Metadata: {
     "userId": "123",
     "type": "avatar"
   }
```

### Find File
```
🔍 Looking for file with external ID: user-123-avatar

✅ File found!
📋 File Information:
   External ID: user-123-avatar
   Storage Key: files/user-123-avatar-1705312245123.jpg
   File URL: https://my-bucket.s3.us-east-1.amazonaws.com/files/user-123-avatar-1705312245123.jpg
   Size: 15234 bytes
   Content Type: image/jpeg
   Last Modified: 2024-01-15T10:30:45.123Z
   ETag: "d41d8cd98f00b204e9800998ecf8427e"
   Metadata:
     userId: 123
     type: avatar
```

### Test Results
```
🧪 Running storage provider tests...
📋 Test External ID: cli-test-1705312245123

1️⃣ Testing upload...
   ✅ Upload successful: files/cli-test-1705312245123.txt

2️⃣ Testing exists check...
   ✅ Exists check: true

3️⃣ Testing find file...
   ✅ Find successful: files/cli-test-1705312245123.txt

4️⃣ Testing URL generation...
   ✅ URL generated: https://my-bucket.s3.us-east-1.amazonaws.com/...

5️⃣ Testing download...
   ✅ Download successful: Content matches: true

6️⃣ Testing delete...
   ✅ Delete successful

7️⃣ Testing deletion verification...
   ✅ Deletion verified: File exists: false

🎉 All tests passed successfully!
```

## Troubleshooting

### Common Issues

1. **Missing dependencies**:
   ```
   Error: Cannot find module '@aws-sdk/client-s3'
   ```
   Install required peer dependencies:
   ```bash
   npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner  # For AWS/S3
   npm install @google-cloud/storage                             # For GCP
   npm install @azure/storage-blob                               # For Azure
   ```

2. **Configuration errors**:
   ```
   ❌ Failed to initialize storage provider:
   Missing required environment variables
   ```
   Check your `.env` file and ensure all required variables are set.

3. **Permission errors**:
   ```
   ❌ Upload failed: Access Denied
   ```
   Verify your credentials have the necessary permissions for the bucket/container.

4. **Network errors**:
   ```
   ❌ Download failed: HTTP 404: Not Found
   ```
   Check if the file exists and your network connection is stable.

### Debug Mode

Set verbose logging:
```bash
DEBUG=crunchycone:storage npm run storage-cli test
```

### Test Connectivity

Use the `test` command to verify your provider configuration:
```bash
npm run storage-cli test
```

This will run through all operations and help identify configuration issues.

## Advanced Usage

### Custom Environment Files

Create provider-specific environment files:

```bash
# .env.development
CRUNCHYCONE_STORAGE_PROVIDER=localstorage
LOCALSTORAGE_PATH=./dev-uploads

# .env.staging  
CRUNCHYCONE_STORAGE_PROVIDER=digitalocean
CRUNCHYCONE_DIGITALOCEAN_SPACES_KEY=staging_key
# ... other staging config

# .env.production
CRUNCHYCONE_STORAGE_PROVIDER=aws
CRUNCHYCONE_AWS_ACCESS_KEY_ID=prod_key
# ... other production config
```

Then use:
```bash
npm run storage-cli -- --env .env.staging test
npm run storage-cli -- --env .env.production info
```

### Scripting

The CLI is designed to be script-friendly with clear exit codes:

```bash
#!/bin/bash
set -e

# Upload file
npm run storage-cli upload "$1" --external-id "backup-$(date +%s)"

# Verify upload
if npm run storage-cli exists "backup-$(date +%s)"; then
    echo "Backup successful"
else
    echo "Backup failed"
    exit 1
fi
```

This CLI tool provides a comprehensive way to test and interact with all CrunchyCone storage providers, making it easy to verify configurations and debug issues.