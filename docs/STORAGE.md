# Storage System

The CrunchyCone library provides a unified storage abstraction that supports multiple storage providers through a clean, consistent interface. This allows you to easily switch between storage backends or add new ones without changing your application code.

## Supported Providers

| Provider | Dependencies | Environment Variables |
|----------|-------------|----------------------|
| **LocalStorage** ⭐ | Built-in (no external deps) | `LOCALSTORAGE_PATH`, `LOCALSTORAGE_BASE_URL` |
| **CrunchyCone Storage** 🚀 | Built-in (no external deps) | `CRUNCHYCONE_API_URL`, `CRUNCHYCONE_API_KEY`, `CRUNCHYCONE_PROJECT_ID`, `CRUNCHYCONE_USER_ID` |
| **AWS S3** | `@aws-sdk/client-s3` (peer dependency) | `CRUNCHYCONE_AWS_ACCESS_KEY_ID`, `CRUNCHYCONE_AWS_SECRET_ACCESS_KEY`, `CRUNCHYCONE_AWS_REGION`, `CRUNCHYCONE_S3_BUCKET` |
| **Google Cloud Storage** | `@google-cloud/storage` (peer dependency) | `CRUNCHYCONE_GCP_PROJECT_ID`, `CRUNCHYCONE_GCP_KEY_FILE`, `CRUNCHYCONE_GCS_BUCKET` |
| **Azure Blob Storage** | `@azure/storage-blob` (peer dependency) | `CRUNCHYCONE_AZURE_ACCOUNT_NAME`, `CRUNCHYCONE_AZURE_ACCOUNT_KEY`, `CRUNCHYCONE_AZURE_CONTAINER` |
| **DigitalOcean Spaces** | `@aws-sdk/client-s3` (peer dependency) | `CRUNCHYCONE_DIGITALOCEAN_SPACES_KEY`, `CRUNCHYCONE_DIGITALOCEAN_SPACES_SECRET`, `CRUNCHYCONE_DIGITALOCEAN_SPACES_REGION`, `CRUNCHYCONE_DIGITALOCEAN_SPACES_BUCKET` |
| **Wasabi** | `@aws-sdk/client-s3` (peer dependency) | `CRUNCHYCONE_WASABI_ACCESS_KEY`, `CRUNCHYCONE_WASABI_SECRET_KEY`, `CRUNCHYCONE_WASABI_REGION`, `CRUNCHYCONE_WASABI_BUCKET` |
| **Backblaze B2** | `@aws-sdk/client-s3` (peer dependency) | `CRUNCHYCONE_BACKBLAZE_KEY_ID`, `CRUNCHYCONE_BACKBLAZE_APPLICATION_KEY`, `CRUNCHYCONE_BACKBLAZE_REGION`, `CRUNCHYCONE_BACKBLAZE_BUCKET` |
| **Cloudflare R2** | `@aws-sdk/client-s3` (peer dependency) | `CRUNCHYCONE_R2_ACCESS_KEY_ID`, `CRUNCHYCONE_R2_SECRET_ACCESS_KEY`, `CRUNCHYCONE_R2_ACCOUNT_ID`, `CRUNCHYCONE_R2_BUCKET` |
| **Custom S3** | `@aws-sdk/client-s3` (peer dependency) | `CRUNCHYCONE_S3_ACCESS_KEY_ID`, `CRUNCHYCONE_S3_SECRET_ACCESS_KEY`, `CRUNCHYCONE_S3_REGION`, `CRUNCHYCONE_S3_BUCKET`, `CRUNCHYCONE_S3_ENDPOINT` |

## Quick Start

### Basic Usage

```typescript
import { initializeStorageProvider, uploadFile, findFileByExternalId } from 'crunchycone-lib';

// Initialize storage (uses environment variables for configuration)
initializeStorageProvider();

// Upload a file
const result = await uploadFile({
  external_id: 'user-123-avatar',
  buffer: Buffer.from('file content'),
  filename: 'avatar.jpg',
  contentType: 'image/jpeg',
  metadata: { userId: '123' }
});

console.log('File uploaded:', result.url);

// Find file later
const fileInfo = await findFileByExternalId('user-123-avatar');
console.log('File info:', fileInfo);
```

### Using Environment Variables

Set the `CRUNCHYCONE_STORAGE_PROVIDER` environment variable to automatically select the provider:

```bash
# Use LocalStorage (default - perfect for development)
CRUNCHYCONE_STORAGE_PROVIDER=localstorage
CRUNCHYCONE_LOCALSTORAGE_PATH=./uploads
CRUNCHYCONE_LOCALSTORAGE_BASE_URL=/uploads

# Use LocalStorage with custom path
CRUNCHYCONE_STORAGE_PROVIDER=localstorage
LOCALSTORAGE_PATH=/var/app/storage
LOCALSTORAGE_BASE_URL=/files

# Use CrunchyCone Storage Service (recommended for production)
CRUNCHYCONE_STORAGE_PROVIDER=crunchycone
CRUNCHYCONE_API_URL=https://api.crunchycone.com
CRUNCHYCONE_API_KEY=your-api-key  # User context determined server-side
CRUNCHYCONE_PROJECT_ID=your-project-id

# Use AWS S3
CRUNCHYCONE_STORAGE_PROVIDER=aws
CRUNCHYCONE_AWS_ACCESS_KEY_ID=your_access_key
CRUNCHYCONE_AWS_SECRET_ACCESS_KEY=your_secret_key
CRUNCHYCONE_AWS_REGION=us-east-1
CRUNCHYCONE_S3_BUCKET=my-app-files

# Use Google Cloud Storage
CRUNCHYCONE_STORAGE_PROVIDER=gcp
CRUNCHYCONE_GCP_PROJECT_ID=my-project
CRUNCHYCONE_GCP_KEY_FILE=/path/to/service-account.json
CRUNCHYCONE_GCS_BUCKET=my-bucket

# Use Azure Blob Storage
CRUNCHYCONE_STORAGE_PROVIDER=azure
CRUNCHYCONE_AZURE_ACCOUNT_NAME=myaccount
CRUNCHYCONE_AZURE_ACCOUNT_KEY=account_key
CRUNCHYCONE_AZURE_CONTAINER=my-container

# Use DigitalOcean Spaces (requires Spaces Access Keys, not API tokens)
CRUNCHYCONE_STORAGE_PROVIDER=digitalocean
CRUNCHYCONE_DIGITALOCEAN_SPACES_KEY=DO801KDUEPQT6EZ3BMZC  # Spaces Access Key (not dop_v1_...)
CRUNCHYCONE_DIGITALOCEAN_SPACES_SECRET=8TJpKBqtXF0i4kIIAKjql1OluDLFdcyKafQd61zUkoI  # Spaces Secret Key
CRUNCHYCONE_DIGITALOCEAN_SPACES_REGION=nyc3
CRUNCHYCONE_DIGITALOCEAN_SPACES_BUCKET=my-space
```

## Provider Configuration

### LocalStorage Provider (Default)

**Dependencies**: None
**Environment Variables**:
- `LOCALSTORAGE_PATH` (optional, defaults to `./uploads`)
- `LOCALSTORAGE_BASE_URL` (optional, defaults to `/uploads`)

The LocalStorage provider stores files in a local directory with individual JSON metadata files alongside each stored file. It provides a more scalable metadata storage approach than centralized mapping files.

### CrunchyCone Storage Provider 🚀

**Dependencies**: None (built-in HTTP client)
**Environment Variables**:
- `CRUNCHYCONE_API_URL` (required) - API endpoint URL
- `CRUNCHYCONE_API_KEY` (required) - API authentication key (user context determined server-side)
- `CRUNCHYCONE_PROJECT_ID` (required) - Project identifier
- `CRUNCHYCONE_TIMEOUT` (optional, defaults to 30000ms) - Request timeout

The CrunchyCone Storage provider integrates with the CrunchyCone Storage Service API, providing enterprise-grade file management with metadata tracking, external ID support, and a two-step upload process.

```bash
CRUNCHYCONE_STORAGE_PROVIDER=localstorage
LOCALSTORAGE_PATH=/var/app/storage  # Optional, defaults to ./uploads
LOCALSTORAGE_BASE_URL=/files        # Optional, defaults to /uploads
```

**Features**:
- ✅ **Zero Configuration** - Works out of the box with sensible defaults
- ✅ **Environment-Configurable** - Path and URL configurable via environment variables
- ✅ **Individual Metadata Files** - Each file has its own `.json` metadata file
- ✅ **Scalable Metadata** - Distributed metadata approach for better performance
- ✅ **External ID Support** - Find files by scanning metadata files
- ✅ **Perfect for Development** - No external services needed

**File Structure**:
```
./uploads/  # or configured path
└── files/
    ├── user-123-avatar-1705312245123.jpg
    ├── user-123-avatar-1705312245123.jpg.json  # Metadata file
    ├── document-456-report-1705312250456.pdf
    └── document-456-report-1705312250456.pdf.json
```

**Configuration Examples**:
```bash
# Default configuration (works out of the box)
# No environment variables needed!

# Custom path configuration
LOCALSTORAGE_PATH=/var/app/storage
LOCALSTORAGE_BASE_URL=/files

# Development with custom URL mapping
LOCALSTORAGE_PATH=./my-uploads
LOCALSTORAGE_BASE_URL=/static/uploads
```

**CrunchyCone Storage Configuration**:
```bash
CRUNCHYCONE_STORAGE_PROVIDER=crunchycone
CRUNCHYCONE_API_URL=https://api.crunchycone.com
CRUNCHYCONE_API_KEY=your-api-key  # User context determined server-side
CRUNCHYCONE_PROJECT_ID=your-project-id
CRUNCHYCONE_TIMEOUT=30000         # Optional, request timeout in ms
```

**Features**:
- ✅ **Two-Step Upload Process** - Creates metadata first, then uploads content with verification
- ✅ **External ID Management** - Use custom identifiers for easy file organization
- ✅ **Rich Metadata Storage** - Store custom key-value metadata with files
- ✅ **User Isolation** - Multi-tenant file access with user-based permissions
- ✅ **Upload Verification** - Tracks actual file size and completion status
- ✅ **Form-Friendly** - Supports HTML form uploads via presigned URLs
- ✅ **Enterprise-Grade** - Built for production with comprehensive API
- ✅ **No External Dependencies** - Uses built-in HTTP client

**Manual Configuration**:
```typescript
import { CrunchyConeProvider, setStorageProvider } from 'crunchycone-lib';

const provider = new CrunchyConeProvider({
  apiUrl: 'https://api.crunchycone.com',
  apiKey: 'your-api-key',  // User context determined server-side
  projectId: 'your-project-id',
  timeout: 30000
});

// In multi-tenant scenarios, you can override user context for specific operations
provider.setUserId('different-user-id');

setStorageProvider(provider);
```

**Two-Step Upload Process**:
1. **Create File Descriptor** - Creates metadata record and generates presigned upload URL
2. **Upload Content** - Uploads file to presigned URL and marks upload complete
3. **Access File** - Generate download URLs with custom filenames and expiration

**Document Management Example**:
```typescript
// Upload invoice with rich metadata
await uploadFile({
  external_id: 'invoice-2025-q1-001',
  buffer: invoiceBuffer,
  filename: 'invoice-january.pdf',
  metadata: {
    type: 'invoice',
    quarter: 'Q1',
    year: '2025',
    invoice_number: 'INV-001',
    amount: '1250.00',
    currency: 'USD',
    customer: 'acme-corp'
  }
});

// Later, find and download
const invoice = await findFileByExternalId('invoice-2025-q1-001');
const downloadUrl = await getFileUrlByExternalId('invoice-2025-q1-001');
```

### AWS S3 Provider

**Dependencies**: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` (peer dependencies - install separately)

**Installation**:
```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

**Environment Variables**:
```bash
CRUNCHYCONE_STORAGE_PROVIDER=aws
CRUNCHYCONE_AWS_ACCESS_KEY_ID=your_access_key
CRUNCHYCONE_AWS_SECRET_ACCESS_KEY=your_secret_key
CRUNCHYCONE_AWS_REGION=us-east-1
CRUNCHYCONE_S3_BUCKET=my-app-files
CRUNCHYCONE_CLOUDFRONT_DOMAIN=d123abc.cloudfront.net  # Optional CDN
```

**Manual Configuration**:
```typescript
import { AWSS3Provider, setStorageProvider } from 'crunchycone-lib';

const provider = new AWSS3Provider({
  accessKeyId: 'your_access_key',
  secretAccessKey: 'your_secret_key',
  region: 'us-east-1',
  bucket: 'my-app-files',
  cloudFrontDomain: 'd123abc.cloudfront.net'
});

setStorageProvider(provider);
```

### Google Cloud Storage Provider

**Dependencies**: `@google-cloud/storage` (peer dependency - install separately)

**Installation**:
```bash
npm install @google-cloud/storage
```

**Environment Variables**:
```bash
CRUNCHYCONE_STORAGE_PROVIDER=gcp
CRUNCHYCONE_GCP_PROJECT_ID=my-project-id
CRUNCHYCONE_GCP_KEY_FILE=/path/to/service-account.json  # Optional if using other auth
CRUNCHYCONE_GCS_BUCKET=my-bucket
CRUNCHYCONE_GCS_CDN_URL=https://cdn.example.com  # Optional CDN
```

**Manual Configuration**:
```typescript
import { GCPStorageProvider, setStorageProvider } from 'crunchycone-lib';

// Using service account key file
const provider = new GCPStorageProvider({
  projectId: 'my-project-id',
  keyFilename: '/path/to/service-account.json',
  bucket: 'my-bucket',
  cdnUrl: 'https://cdn.example.com'
});

// Using credentials object
const provider2 = new GCPStorageProvider({
  projectId: 'my-project-id',
  credentials: {
    type: 'service_account',
    project_id: 'my-project-id',
    private_key_id: 'key-id',
    private_key: '-----BEGIN PRIVATE KEY-----\n...',
    client_email: 'service@my-project.iam.gserviceaccount.com',
    client_id: 'client-id',
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
  },
  bucket: 'my-bucket'
});

setStorageProvider(provider);
```

### Azure Blob Storage Provider

**Dependencies**: `@azure/storage-blob` (peer dependency - install separately)

**Installation**:
```bash
npm install @azure/storage-blob
```

**Environment Variables**:
```bash
CRUNCHYCONE_STORAGE_PROVIDER=azure
CRUNCHYCONE_AZURE_ACCOUNT_NAME=mystorageaccount
CRUNCHYCONE_AZURE_ACCOUNT_KEY=account_access_key  # One of: accountKey, sasToken, or connectionString
CRUNCHYCONE_AZURE_CONTAINER=my-container
CRUNCHYCONE_AZURE_CDN_URL=https://cdn.example.com  # Optional CDN
```

**Alternative Authentication Methods**:
```bash
# Using connection string
CRUNCHYCONE_STORAGE_PROVIDER=azure
CRUNCHYCONE_AZURE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=myaccount;AccountKey=mykey;EndpointSuffix=core.windows.net
CRUNCHYCONE_AZURE_CONTAINER=my-container

# Using SAS token
CRUNCHYCONE_STORAGE_PROVIDER=azure
CRUNCHYCONE_AZURE_ACCOUNT_NAME=mystorageaccount
CRUNCHYCONE_AZURE_SAS_TOKEN=?sv=2021-06-08&ss=b&srt=sco&sp=rwdlacupx&se=2023-01-01T00:00:00Z&st=2022-01-01T00:00:00Z&spr=https&sig=signature
CRUNCHYCONE_AZURE_CONTAINER=my-container
```

**Manual Configuration**:
```typescript
import { AzureStorageProvider, setStorageProvider } from 'crunchycone-lib';

// Using account key
const provider = new AzureStorageProvider({
  accountName: 'mystorageaccount',
  accountKey: 'account_access_key',
  containerName: 'my-container',
  cdnUrl: 'https://cdn.example.com'
});

// Using connection string
const provider2 = new AzureStorageProvider({
  accountName: 'mystorageaccount',
  connectionString: 'DefaultEndpointsProtocol=https;AccountName=myaccount;AccountKey=mykey;EndpointSuffix=core.windows.net',
  containerName: 'my-container'
});

// Using SAS token
const provider3 = new AzureStorageProvider({
  accountName: 'mystorageaccount',
  sasToken: '?sv=2021-06-08&ss=b&srt=sco&sp=rwdlacupx&se=2023-01-01T00:00:00Z&st=2022-01-01T00:00:00Z&spr=https&sig=signature',
  containerName: 'my-container'
});

setStorageProvider(provider);
```

### DigitalOcean Spaces Provider

**Dependencies**: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` (peer dependencies)

**Installation**:
```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

**⚠️ Important: Spaces Access Keys vs API Tokens**

DigitalOcean has **two different types of credentials**:
- **API Tokens** (`dop_v1_...`) - For managing DigitalOcean resources (droplets, domains, etc.)
- **Spaces Access Keys** - For S3-compatible object storage operations

For this library, you need **Spaces Access Keys**, not API tokens.

**How to Generate Spaces Access Keys**:
1. Go to [DigitalOcean Spaces Access Keys](https://cloud.digitalocean.com/spaces/access_keys)
   - **NOT** the general API tokens page
   - Direct URL: `https://cloud.digitalocean.com/spaces/access_keys`
2. Click "Generate New Key"
3. Give it a name (e.g., "crunchycone-lib-storage")
4. You'll receive **two values**:
   - **Access Key**: Short format like `DO801KDUEPQT6EZ3BMZC`
   - **Secret Key**: Longer format like `8TJpKBqtXF0i4kIIAKjql1OluDLFdcyKafQd61zUkoI`

**Environment Variables**:
```bash
CRUNCHYCONE_STORAGE_PROVIDER=digitalocean
CRUNCHYCONE_DIGITALOCEAN_SPACES_KEY=DO801KDUEPQT6EZ3BMZC
CRUNCHYCONE_DIGITALOCEAN_SPACES_SECRET=8TJpKBqtXF0i4kIIAKjql1OluDLFdcyKafQd61zUkoI
CRUNCHYCONE_DIGITALOCEAN_SPACES_REGION=nyc3
CRUNCHYCONE_DIGITALOCEAN_SPACES_BUCKET=my-space
CRUNCHYCONE_DIGITALOCEAN_CDN_ENDPOINT=https://my-space.nyc3.cdn.digitaloceanspaces.com  # Optional
```

**Manual Configuration**:
```typescript
import { DigitalOceanSpacesProvider, setStorageProvider } from 'crunchycone-lib';

const provider = new DigitalOceanSpacesProvider({
  accessKeyId: 'your_key',
  secretAccessKey: 'your_secret',
  region: 'nyc3',
  bucket: 'my-space',
  cdnEndpoint: 'https://my-space.nyc3.cdn.digitaloceanspaces.com'
});

setStorageProvider(provider);
```

### Wasabi Provider

**Dependencies**: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` (peer dependencies)

**Environment Variables**:
```bash
CRUNCHYCONE_STORAGE_PROVIDER=wasabi
CRUNCHYCONE_WASABI_ACCESS_KEY=your_key
CRUNCHYCONE_WASABI_SECRET_KEY=your_secret
CRUNCHYCONE_WASABI_REGION=us-east-1
CRUNCHYCONE_WASABI_BUCKET=my-bucket
```

### Backblaze B2 Provider

**Dependencies**: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` (peer dependencies)

**Environment Variables**:
```bash
CRUNCHYCONE_STORAGE_PROVIDER=backblaze
CRUNCHYCONE_BACKBLAZE_KEY_ID=your_key_id
CRUNCHYCONE_BACKBLAZE_APPLICATION_KEY=your_app_key
CRUNCHYCONE_BACKBLAZE_REGION=us-west-000
CRUNCHYCONE_BACKBLAZE_BUCKET=my-bucket
```

### Cloudflare R2 Provider

**Dependencies**: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` (peer dependencies)

**Environment Variables**:
```bash
CRUNCHYCONE_STORAGE_PROVIDER=r2
CRUNCHYCONE_R2_ACCESS_KEY_ID=your_access_key
CRUNCHYCONE_R2_SECRET_ACCESS_KEY=your_secret_key
CRUNCHYCONE_R2_ACCOUNT_ID=your_account_id
CRUNCHYCONE_R2_BUCKET=my-bucket
CRUNCHYCONE_R2_PUBLIC_DOMAIN=files.mydomain.com  # Optional custom domain
```

### Custom S3-Compatible Provider

For other S3-compatible services:

**Dependencies**: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` (peer dependencies)

**Environment Variables**:
```bash
CRUNCHYCONE_STORAGE_PROVIDER=s3-custom
CRUNCHYCONE_S3_ACCESS_KEY_ID=your_key
CRUNCHYCONE_S3_SECRET_ACCESS_KEY=your_secret
CRUNCHYCONE_S3_REGION=us-east-1
CRUNCHYCONE_S3_BUCKET=my-bucket
CRUNCHYCONE_S3_ENDPOINT=https://s3.example.com
CRUNCHYCONE_S3_FORCE_PATH_STYLE=true
CRUNCHYCONE_S3_PUBLIC_BASE_URL=https://files.example.com
CRUNCHYCONE_S3_CDN_URL=https://cdn.example.com
CRUNCHYCONE_S3_DEFAULT_ACL=public-read
```

## Storage Interface

All providers implement the same `StorageProvider` interface:

```typescript
interface StorageProvider {
  uploadFile(options: StorageUploadOptions): Promise<StorageUploadResult>;
  deleteFile(key: string): Promise<void>;
  deleteFileByExternalId(externalId: string): Promise<void>;
  getFileUrl(key: string, expiresIn?: number): Promise<string>;
  getFileUrlByExternalId(externalId: string, expiresIn?: number): Promise<string>;
  fileExists(key: string): Promise<boolean>;
  fileExistsByExternalId(externalId: string): Promise<boolean>;
  findFileByExternalId(externalId: string): Promise<StorageFileInfo | null>;
}

interface StorageUploadOptions {
  // Input source - exactly one of these three
  filePath?: string;           // Path to existing file on disk
  stream?: ReadableStream | NodeJS.ReadableStream;  // Direct stream
  buffer?: Buffer;             // In-memory buffer

  // File identification
  external_id: string;         // External identifier for easy lookup/management
  key?: string;                // Storage path/key (auto-generated if not provided)
  filename?: string;           // Original filename

  // File metadata
  contentType?: string;        // MIME type
  size?: number;              // File size in bytes

  // Storage options
  bucket?: string;            // Override default bucket
  public?: boolean;           // Public access
  metadata?: Record<string, string>; // Custom metadata
}

interface StorageUploadResult {
  external_id: string;
  key: string;
  url: string;
  size: number;
  contentType: string;
  etag?: string;
  metadata?: Record<string, string>;
}

interface StorageFileInfo {
  external_id: string;
  key: string;
  url: string;
  size: number;
  contentType: string;
  lastModified?: Date;
  etag?: string;
  metadata?: Record<string, string>;
}
```

## Upload Methods

The storage system supports three different upload methods to handle various scenarios:

### 1. Buffer Upload (Small Files)

Best for small files that can fit in memory:

```typescript
const fileBuffer = await file.arrayBuffer();
const buffer = Buffer.from(fileBuffer);

const result = await uploadFile({
  external_id: 'user-123-avatar',
  buffer,
  filename: 'avatar.jpg',
  contentType: 'image/jpeg'
});
```

### 2. Stream Upload (Large Files)

Best for large files to avoid memory issues:

```typescript
// From a web File object
const result = await uploadFile({
  external_id: 'user-123-video',
  stream: file.stream(),
  filename: 'video.mp4',
  contentType: 'video/mp4',
  size: file.size
});

// From Node.js readable stream
import { createReadStream } from 'fs';

const result = await uploadFile({
  external_id: 'processed-image',
  stream: createReadStream('/tmp/processed.jpg'),
  filename: 'processed.jpg',
  contentType: 'image/jpeg'
});
```

### 3. File Path Upload (Temporary Files)

Best when you have a file already saved to disk:

```typescript
const result = await uploadFile({
  external_id: 'backup-file',
  filePath: '/tmp/backup.zip',
  filename: 'backup.zip',
  contentType: 'application/zip'
});
```

## External ID System

The external ID system allows you to associate files with your application's entities:

### Setting External IDs

```typescript
// User avatar
await uploadFile({
  external_id: 'user-123-avatar',
  buffer: avatarBuffer,
  filename: 'avatar.jpg'
});

// Document upload
await uploadFile({
  external_id: 'document-456-contract',
  buffer: documentBuffer,
  filename: 'contract.pdf'
});

// Product image
await uploadFile({
  external_id: 'product-789-image-1',
  buffer: imageBuffer,
  filename: 'product.jpg'
});
```

### Finding Files by External ID

```typescript
// Find user's avatar
const avatar = await findFileByExternalId('user-123-avatar');
if (avatar) {
  console.log('Avatar URL:', avatar.url);
  console.log('File size:', avatar.size);
  console.log('Last modified:', avatar.lastModified);
}

// Check if file exists
const exists = await fileExistsByExternalId('document-456-contract');
if (exists) {
  const url = await getFileUrlByExternalId('document-456-contract');
  console.log('Document URL:', url);
}
```

### Managing Files by External ID

```typescript
// Delete user's old avatar before uploading new one
try {
  await deleteFileByExternalId('user-123-avatar');
} catch (error) {
  // File might not exist, which is fine
}

// Upload new avatar
const result = await uploadFile({
  external_id: 'user-123-avatar',
  buffer: newAvatarBuffer,
  filename: 'new-avatar.jpg'
});
```

## File Keys and Organization

Files are organized using keys (paths) that can be auto-generated or manually specified:

### Auto-Generated Keys

When no key is provided, the system generates one based on external_id and timestamp:

```typescript
const result = await uploadFile({
  external_id: 'user-123-avatar',
  buffer: avatarBuffer,
  filename: 'avatar.jpg'
});

console.log(result.key);
// Output: "files/user-123-avatar-1705312245123.jpg"
```

### Custom Keys

You can specify custom keys for organized file structure:

```typescript
const result = await uploadFile({
  external_id: 'user-123-avatar',
  key: 'users/123/avatar.jpg',
  buffer: avatarBuffer,
  filename: 'avatar.jpg'
});

console.log(result.key);
// Output: "users/123/avatar.jpg"
```

### Organized Structure Examples

```typescript
// User files
await uploadFile({
  external_id: 'user-123-avatar',
  key: 'users/123/avatar.jpg',
  buffer: avatarBuffer
});

await uploadFile({
  external_id: 'user-123-document',
  key: 'users/123/documents/resume.pdf',
  buffer: documentBuffer
});

// Product images
await uploadFile({
  external_id: 'product-456-main',
  key: 'products/456/images/main.jpg',
  buffer: imageBuffer
});

// Temporary files
await uploadFile({
  external_id: 'temp-export-789',
  key: 'temp/exports/data-789.csv',
  buffer: csvBuffer
});
```

## Content Type Detection

The system automatically detects content types based on file extensions:

```typescript
// Automatic detection based on filename
const result = await uploadFile({
  external_id: 'document-123',
  buffer: fileBuffer,
  filename: 'report.pdf'  // Will set contentType to 'application/pdf'
});

// Manual override
const result2 = await uploadFile({
  external_id: 'custom-file',
  buffer: fileBuffer,
  filename: 'data.txt',
  contentType: 'text/csv'  // Override automatic detection
});
```

**Supported File Types**:
- **Images**: jpg, jpeg, png, gif, webp, svg
- **Documents**: pdf, txt, html, css, js, json, xml
- **Archives**: zip
- **Media**: mp4, mp3, wav
- **Default**: application/octet-stream (for unknown types)

## Error Handling

All storage operations include comprehensive error handling:

```typescript
try {
  const result = await uploadFile({
    external_id: 'test-file',
    buffer: fileBuffer,
    filename: 'test.jpg'
  });

  console.log('Upload successful:', result.url);
} catch (error) {
  console.error('Upload failed:', error.message);

  // Handle specific error types
  if (error.message.includes('required environment variable')) {
    // Configuration issue
  } else if (error.message.includes('Failed to upload')) {
    // Upload-specific error
  }
}

// Check operations
const fileInfo = await findFileByExternalId('non-existent-file');
console.log(fileInfo); // null (not an error)

const exists = await fileExistsByExternalId('non-existent-file');
console.log(exists); // false (not an error)

// Delete operations
try {
  await deleteFileByExternalId('non-existent-file');
} catch (error) {
  console.error('File not found:', error.message);
}
```

## Next.js Integration

### Server Action Example

```typescript
// app/actions/upload.ts
'use server';

import { uploadFile } from 'crunchycone-lib';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export async function uploadUserAvatar(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    return { error: 'Unauthorized' };
  }

  try {
    const file = formData.get('avatar') as File;
    if (!file || file.size === 0) {
      return { error: 'No file provided' };
    }

    // Validate file
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      return { error: 'File too large (max 5MB)' };
    }

    if (!file.type.startsWith('image/')) {
      return { error: 'Only images are allowed' };
    }

    // Delete old avatar if it exists
    try {
      await deleteFileByExternalId(`user-${session.user.id}-avatar`);
    } catch {
      // Old avatar might not exist, ignore error
    }

    // Upload new avatar
    const result = await uploadFile({
      external_id: `user-${session.user.id}-avatar`,
      stream: file.stream(),
      filename: file.name,
      contentType: file.type,
      size: file.size,
      metadata: {
        userId: session.user.id,
        uploadedAt: new Date().toISOString()
      }
    });

    revalidatePath('/profile');
    return { success: true, url: result.url };

  } catch (error) {
    console.error('Avatar upload error:', error);
    return { error: 'Upload failed' };
  }
}
```

### API Route Example

```typescript
// app/api/files/[externalId]/route.ts
import { findFileByExternalId, getFileUrlByExternalId } from 'crunchycone-lib';
import { auth } from '@/lib/auth';

export async function GET(
  request: Request,
  { params }: { params: { externalId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const fileInfo = await findFileByExternalId(params.externalId);
    if (!fileInfo) {
      return new Response('File not found', { status: 404 });
    }

    // Check if user owns this file
    if (fileInfo.metadata?.userId !== session.user.id) {
      return new Response('Forbidden', { status: 403 });
    }

    return Response.json({
      id: fileInfo.external_id,
      url: fileInfo.url,
      size: fileInfo.size,
      contentType: fileInfo.contentType,
      lastModified: fileInfo.lastModified
    });

  } catch (error) {
    console.error('File retrieval error:', error);
    return new Response('Internal error', { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { externalId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const fileInfo = await findFileByExternalId(params.externalId);
    if (!fileInfo) {
      return new Response('File not found', { status: 404 });
    }

    // Check if user owns this file
    if (fileInfo.metadata?.userId !== session.user.id) {
      return new Response('Forbidden', { status: 403 });
    }

    await deleteFileByExternalId(params.externalId);
    return new Response('File deleted', { status: 200 });

  } catch (error) {
    console.error('File deletion error:', error);
    return new Response('Internal error', { status: 500 });
  }
}
```

## Adding Custom Providers

You can create custom storage providers by implementing the `StorageProvider` interface:

### 1. Create Provider Class

```typescript
import { StorageProvider, StorageUploadOptions, StorageUploadResult, StorageFileInfo } from 'crunchycone-lib';

export class CustomStorageProvider implements StorageProvider {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: { apiKey: string; baseUrl: string }) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl;
  }

  async uploadFile(options: StorageUploadOptions): Promise<StorageUploadResult> {
    // Validate input
    const inputCount = [options.filePath, options.stream, options.buffer].filter(Boolean).length;
    if (inputCount !== 1) {
      throw new Error('Exactly one of filePath, stream, or buffer must be provided');
    }

    // Convert input to buffer/stream as needed by your API
    let uploadData: Buffer;
    if (options.buffer) {
      uploadData = options.buffer;
    } else if (options.filePath) {
      uploadData = await fs.readFile(options.filePath);
    } else if (options.stream) {
      uploadData = await streamToBuffer(options.stream);
    }

    // Make API call to your custom storage service
    const response = await this.callCustomAPI({
      data: uploadData,
      key: options.key || this.generateKey(options.external_id, options.filename),
      contentType: options.contentType,
      metadata: options.metadata
    });

    return {
      external_id: options.external_id,
      key: response.key,
      url: response.url,
      size: uploadData.length,
      contentType: options.contentType || 'application/octet-stream',
      etag: response.etag,
      metadata: options.metadata
    };
  }

  async deleteFile(key: string): Promise<void> {
    await this.callCustomDeleteAPI(key);
  }

  async deleteFileByExternalId(externalId: string): Promise<void> {
    // Implementation depends on how your service tracks external IDs
    const fileInfo = await this.findFileByExternalId(externalId);
    if (!fileInfo) {
      throw new Error(`File with external_id "${externalId}" not found`);
    }
    await this.deleteFile(fileInfo.key);
  }

  async getFileUrl(key: string, expiresIn?: number): Promise<string> {
    // Return public URL or generate signed URL
    return `${this.baseUrl}/files/${key}`;
  }

  async getFileUrlByExternalId(externalId: string, expiresIn?: number): Promise<string> {
    const fileInfo = await this.findFileByExternalId(externalId);
    if (!fileInfo) {
      throw new Error(`File with external_id "${externalId}" not found`);
    }
    return this.getFileUrl(fileInfo.key, expiresIn);
  }

  async fileExists(key: string): Promise<boolean> {
    try {
      await this.callCustomHeadAPI(key);
      return true;
    } catch (error) {
      if (error.status === 404) return false;
      throw error;
    }
  }

  async fileExistsByExternalId(externalId: string): Promise<boolean> {
    const fileInfo = await this.findFileByExternalId(externalId);
    return fileInfo !== null;
  }

  async findFileByExternalId(externalId: string): Promise<StorageFileInfo | null> {
    // Implementation depends on how your service indexes external IDs
    try {
      const response = await this.callCustomSearchAPI(externalId);
      return {
        external_id: response.external_id,
        key: response.key,
        url: response.url,
        size: response.size,
        contentType: response.contentType,
        lastModified: new Date(response.lastModified),
        etag: response.etag,
        metadata: response.metadata
      };
    } catch (error) {
      if (error.status === 404) return null;
      throw error;
    }
  }

  private generateKey(externalId: string, filename?: string): string {
    const timestamp = Date.now();
    const extension = filename ? path.extname(filename) : '';
    return `files/${externalId}-${timestamp}${extension}`;
  }

  private async callCustomAPI(options: any) {
    // Implement your custom API calls
    const response = await fetch(`${this.baseUrl}/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/octet-stream'
      },
      body: options.data
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    return response.json();
  }

  // ... other custom API methods
}

async function streamToBuffer(stream: ReadableStream | NodeJS.ReadableStream): Promise<Buffer> {
  // Convert stream to buffer implementation
}
```

### 2. Register Provider in Configuration

```typescript
// Extend the storage configuration
import { initializeStorageProvider as originalInit, setStorageProvider } from 'crunchycone-lib';
import { CustomStorageProvider } from './custom-storage-provider';

export function initializeStorageProvider(): void {
  const provider = process.env.CRUNCHYCONE_STORAGE_PROVIDER || 'local';

  if (provider === 'custom') {
    const apiKey = process.env.CUSTOM_STORAGE_API_KEY;
    const baseUrl = process.env.CUSTOM_STORAGE_BASE_URL;

    if (!apiKey || !baseUrl) {
      throw new Error('CUSTOM_STORAGE_API_KEY and CUSTOM_STORAGE_BASE_URL environment variables are required');
    }

    setStorageProvider(new CustomStorageProvider({ apiKey, baseUrl }));
    return;
  }

  // Fall back to original initialization
  originalInit();
}
```

### 3. Add TypeScript Types

```typescript
// Extend the StorageProviderType
declare module 'crunchycone-lib' {
  type StorageProviderType = 'localstorage' | 'aws' | 's3' | 'gcp' | 'azure' | 'digitalocean' | 'wasabi' | 'backblaze' | 'r2' | 's3-custom' | 'custom';
}
```

## Testing Storage Providers

The library includes comprehensive tests for all providers:

```bash
# Test all storage providers
npm test -- --testPathPattern=storage

# Test specific provider
npm test -- tests/services/storage/providers/localstorage.test.ts

# Test configuration
npm test -- tests/services/storage/config.test.ts
```

### Testing Your Custom Provider

```typescript
import { CustomStorageProvider } from './custom-storage-provider';

describe('CustomStorageProvider', () => {
  let provider: CustomStorageProvider;

  beforeEach(() => {
    provider = new CustomStorageProvider({
      apiKey: 'test-key',
      baseUrl: 'https://api.example.com'
    });
  });

  it('should upload file successfully', async () => {
    const buffer = Buffer.from('test content');
    const result = await provider.uploadFile({
      external_id: 'test-file',
      buffer,
      filename: 'test.txt',
      contentType: 'text/plain'
    });

    expect(result.external_id).toBe('test-file');
    expect(result.url).toBeDefined();
    expect(result.size).toBe(buffer.length);
  });

  it('should find file by external ID', async () => {
    // Upload file first
    await provider.uploadFile({
      external_id: 'findable-file',
      buffer: Buffer.from('test'),
      filename: 'test.txt'
    });

    const fileInfo = await provider.findFileByExternalId('findable-file');
    expect(fileInfo).not.toBeNull();
    expect(fileInfo!.external_id).toBe('findable-file');
  });

  it('should handle errors gracefully', async () => {
    // Test error scenarios
    await expect(provider.uploadFile({
      external_id: 'test'
      // Missing input source
    })).rejects.toThrow('Exactly one of filePath, stream, or buffer must be provided');
  });
});
```

## Best Practices

### 1. Environment-Based Configuration

Use environment variables for different stages:

```bash
# Development - Use LocalStorage provider (default)
CRUNCHYCONE_STORAGE_PROVIDER=localstorage
# No additional configuration needed!

# Staging
CRUNCHYCONE_STORAGE_PROVIDER=digitalocean
CRUNCHYCONE_DIGITALOCEAN_SPACES_KEY=staging_key
CRUNCHYCONE_DIGITALOCEAN_SPACES_SECRET=staging_secret
CRUNCHYCONE_DIGITALOCEAN_SPACES_REGION=nyc3
CRUNCHYCONE_DIGITALOCEAN_SPACES_BUCKET=staging-files

# Production
CRUNCHYCONE_STORAGE_PROVIDER=aws
CRUNCHYCONE_AWS_ACCESS_KEY_ID=prod_key
CRUNCHYCONE_AWS_SECRET_ACCESS_KEY=prod_secret
CRUNCHYCONE_AWS_REGION=us-east-1
CRUNCHYCONE_S3_BUCKET=production-files
```

### 2. File Organization

Use consistent external ID patterns:

```typescript
// User files
const avatarId = `user-${userId}-avatar`;
const documentId = `user-${userId}-document-${documentType}`;

// Product files
const productImageId = `product-${productId}-image-${imageIndex}`;
const productManualId = `product-${productId}-manual`;

// Temporary files
const exportId = `export-${userId}-${Date.now()}`;
const cacheId = `cache-${cacheKey}`;
```

### 3. Error Handling and Cleanup

```typescript
async function replaceUserAvatar(userId: string, newAvatarFile: File) {
  const externalId = `user-${userId}-avatar`;
  let uploadResult: StorageUploadResult | null = null;

  try {
    // Upload new avatar first
    uploadResult = await uploadFile({
      external_id: externalId,
      stream: newAvatarFile.stream(),
      filename: newAvatarFile.name,
      contentType: newAvatarFile.type
    });

    // Update database with new avatar URL
    await updateUserAvatar(userId, uploadResult.url);

    // Only delete old avatar after successful database update
    // (The external_id system will handle overwrites automatically in most cases)

    return uploadResult;

  } catch (error) {
    // If upload succeeded but database update failed, clean up the uploaded file
    if (uploadResult) {
      try {
        await deleteFileByExternalId(externalId);
      } catch (cleanupError) {
        console.error('Failed to clean up uploaded file:', cleanupError);
      }
    }

    throw error;
  }
}
```

### 4. File Validation

```typescript
function validateFile(file: File): { valid: boolean; error?: string } {
  // Size validation
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    return { valid: false, error: 'File too large (max 10MB)' };
  }

  // Type validation
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'File type not allowed' };
  }

  // Extension validation
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
  const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
  if (!allowedExtensions.includes(extension)) {
    return { valid: false, error: 'File extension not allowed' };
  }

  return { valid: true };
}

async function safeUploadFile(options: StorageUploadOptions & { file?: File }) {
  if (options.file) {
    const validation = validateFile(options.file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
  }

  return uploadFile(options);
}
```

### 5. Metadata Usage

Use metadata for enhanced file management:

```typescript
await uploadFile({
  external_id: 'user-123-avatar',
  buffer: avatarBuffer,
  filename: 'avatar.jpg',
  metadata: {
    userId: '123',
    uploadedAt: new Date().toISOString(),
    userAgent: request.headers['user-agent'],
    ipAddress: getClientIP(request),
    originalSize: originalFile.size.toString(),
    processedSize: processedBuffer.length.toString(),
    version: '1'
  }
});

// Later, retrieve and use metadata
const fileInfo = await findFileByExternalId('user-123-avatar');
if (fileInfo?.metadata) {
  console.log('Uploaded by user:', fileInfo.metadata.userId);
  console.log('Upload time:', fileInfo.metadata.uploadedAt);
  console.log('File version:', fileInfo.metadata.version);
}
```

## Troubleshooting

### Common Issues

1. **Missing Dependencies**:
   ```
   Error: Cannot find module '@aws-sdk/client-s3'
   Error: Cannot find module '@google-cloud/storage'
   Error: Cannot find module '@azure/storage-blob'
   ```
   Install the required peer dependencies:
   - AWS S3: `npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`
   - Google Cloud: `npm install @google-cloud/storage`
   - Azure: `npm install @azure/storage-blob`

2. **DigitalOcean InvalidAccessKeyId Error**:
   ```
   Error: InvalidAccessKeyId: UnknownError
   ```
   You're using DigitalOcean **API tokens** (`dop_v1_...`) instead of **Spaces Access Keys**:
   - ❌ Wrong: API tokens from `https://cloud.digitalocean.com/account/api/tokens`
   - ✅ Correct: Spaces access keys from `https://cloud.digitalocean.com/spaces/access_keys`

   Spaces access keys look like:
   - Access Key: `DO801KDUEPQT6EZ3BMZC` (not `dop_v1_...`)
   - Secret Key: `8TJpKBqtXF0i4kIIAKjql1OluDLFdcyKafQd61zUkoI`

3. **Invalid Configuration**:
   ```
   Error: Missing required environment variables
   ```
   Check that all required environment variables are set for your chosen provider

3. **Custom Path Configuration**:
   ```bash
   # Use custom storage path
   LOCALSTORAGE_PATH=/var/app/files
   LOCALSTORAGE_BASE_URL=/static/files
   ```
   The LocalStorage provider uses sensible defaults but can be customized via environment variables

4. **File Not Found**:
   ```
   Error: File with external_id "xxx" not found
   ```
   The external ID doesn't exist. Use `findFileByExternalId()` to check before operations

5. **Upload Failures**:
   ```
   Error: Failed to upload file
   ```
   Check network connectivity, credentials, and bucket/container permissions

### Debug Mode

Enable debug logging for troubleshooting:

```typescript
// Set debug environment variable
process.env.DEBUG = 'crunchycone:storage';

// Check provider initialization
try {
  initializeStorageProvider();
  console.log('Storage provider initialized successfully');
} catch (error) {
  console.error('Storage initialization failed:', error.message);
}

// Test upload with error handling
try {
  const result = await uploadFile({
    external_id: 'debug-test',
    buffer: Buffer.from('test'),
    filename: 'test.txt'
  });
  console.log('Test upload successful:', result);
} catch (error) {
  console.error('Test upload failed:', error);
}
```

### Provider-Specific Debugging

```typescript
// Check if provider is correctly initialized
import { getStorageProvider } from 'crunchycone-lib';

try {
  const provider = getStorageProvider();
  console.log('Current provider:', provider.constructor.name);
} catch (error) {
  console.error('No storage provider initialized:', error.message);
}

// Test basic operations
const testExternalId = `debug-test-${Date.now()}`;

try {
  // Test upload
  const uploadResult = await uploadFile({
    external_id: testExternalId,
    buffer: Buffer.from('debug test content'),
    filename: 'debug.txt'
  });
  console.log('✅ Upload successful:', uploadResult.url);

  // Test find
  const fileInfo = await findFileByExternalId(testExternalId);
  console.log('✅ Find successful:', fileInfo?.url);

  // Test exists
  const exists = await fileExistsByExternalId(testExternalId);
  console.log('✅ Exists check:', exists);

  // Test delete
  await deleteFileByExternalId(testExternalId);
  console.log('✅ Delete successful');

} catch (error) {
  console.error('❌ Storage test failed:', error);
}
```

This comprehensive guide covers all aspects of the storage system, from basic usage to advanced customization and troubleshooting. The storage system provides a robust, flexible foundation for file management in your applications.
