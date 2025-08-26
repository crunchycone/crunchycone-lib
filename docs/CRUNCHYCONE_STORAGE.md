# CrunchyCone Storage Provider

The CrunchyCone Storage Provider integrates with the CrunchyCone Storage Service API, which provides a comprehensive file management system with metadata tracking, external ID support, and a two-step upload process.

## Features

- **Two-step upload process**: Creates metadata first, then uploads content
- **External ID support**: Use custom identifiers for easy file management
- **Metadata storage**: Store custom key-value metadata with files
- **Upload verification**: Tracks actual file size and completion status
- **Form-friendly uploads**: Support for HTML form uploads
- **Download URL management**: Custom filenames and expiration control

## Configuration

### Environment Variables

```bash
# Required
CRUNCHYCONE_API_URL=https://api.crunchycone.com
CRUNCHYCONE_API_KEY=your-api-key              # Optional if stored in keychain  
CRUNCHYCONE_PROJECT_ID=your-project-id

# Optional
CRUNCHYCONE_USER_ID=user-123  # Can be set via setUserId() method
CRUNCHYCONE_TIMEOUT=30000     # Request timeout in milliseconds
```

**Keychain Authentication**: The CrunchyCone provider automatically falls back to keychain-stored API keys when `CRUNCHYCONE_API_KEY` is not set in environment variables. Use `crunchycone auth login` to store your API key securely.

### Programmatic Configuration

```typescript
import { CrunchyConeProvider } from '@crunchycone/lib';

const provider = new CrunchyConeProvider({
  apiUrl: 'https://api.crunchycone.com',
  apiKey: 'your-api-key',
  projectId: 'your-project-id',
  userId: 'user-123',      // Optional
  timeout: 30000,          // Optional, default: 30000ms
});

// Set or change user ID after initialization
provider.setUserId('different-user-id');
```

## Usage Examples

### Basic File Upload

```typescript
import { uploadFile } from '@crunchycone/lib';

const result = await uploadFile({
  external_id: 'invoice-2025-001',
  buffer: fileBuffer,
  filename: 'invoice.pdf',
  contentType: 'application/pdf',
  metadata: {
    category: 'invoice',
    year: '2025',
    quarter: 'Q1'
  }
});

console.log('File uploaded:', result.url);
```

### Upload with Custom File Path

```typescript
const result = await uploadFile({
  external_id: 'user-avatar-123',
  key: 'avatars/users/123/profile.jpg',  // Custom storage path
  buffer: imageBuffer,
  filename: 'profile.jpg',
  contentType: 'image/jpeg',
  public: true
});
```

### Find and Download Files

```typescript
import { findFileByExternalId, getFileUrlByExternalId } from '@crunchycone/lib';

// Find file metadata
const fileInfo = await findFileByExternalId('invoice-2025-001');
if (fileInfo) {
  console.log('File size:', fileInfo.size);
  console.log('Upload date:', fileInfo.lastModified);
  console.log('Metadata:', fileInfo.metadata);
}

// Get download URL (returns redirect URL to presigned download)
const downloadUrl = await getFileUrlByExternalId('invoice-2025-001');
```

### Document Management System

```typescript
// Upload invoice with rich metadata
await uploadFile({
  external_id: 'invoice-2025-q1-001',
  filePath: './documents/invoice-january.pdf',
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

// Later, find and update
const invoice = await findFileByExternalId('invoice-2025-q1-001');
if (invoice) {
  // Generate download with custom filename
  const url = await getFileUrlByExternalId('invoice-2025-q1-001');
  // URL will be: /v1/storage/files/by-external-id/invoice-2025-q1-001/download
}
```

### User Avatar Management

```typescript
// Replace user avatar (delete old, upload new with same external ID)
try {
  await deleteFileByExternalId(`avatar-user-${userId}`);
} catch (error) {
  // Ignore if file doesn't exist
}

await uploadFile({
  external_id: `avatar-user-${userId}`,
  key: `avatars/${userId}/profile.jpg`,
  buffer: avatarBuffer,
  filename: 'profile.jpg',
  contentType: 'image/jpeg',
  metadata: {
    type: 'avatar',
    user_id: userId,
    size: 'large',
    uploaded_by: 'user'
  }
});
```

## Upload Flow

The CrunchyCone provider follows a two-step upload process:

### 1. Create File Descriptor
```
Client → POST /v1/storage/files
├─ Creates metadata record in database
├─ Generates presigned upload URL (15 min expiry)
└─ Returns: file_id + upload_url + expires_at
```

### 2. Upload File Content
```
Client → Upload to presigned URL (PUT)
├─ Uploads file directly to storage
├─ Client → POST /v1/storage/files/{file_id}/upload
├─ Updates metadata with actual file size
├─ Marks upload as completed
└─ Returns: success confirmation
```

### 3. Access File
```
Client → GET /v1/storage/files/by-external-id/{external_id}/download
├─ Validates user access
├─ Generates presigned download URL
└─ Returns: 302 Redirect to signed download URL
```

## External ID and Metadata

### External ID Features
- **Format**: Alphanumeric characters, hyphens, and underscores only (`^[a-zA-Z0-9_-]+$`)
- **Length**: 1-255 characters
- **Uniqueness**: Must be unique per user
- **Optional**: Files can be managed via UUID alone
- **Case Sensitive**: `user-doc-123` and `USER-DOC-123` are different

### Metadata Features
- **Format**: JSON object with string keys and string values
- **Key Limits**: 
  - Maximum 50 characters per key
  - Maximum 20 keys per file
  - Key format: `^[a-zA-Z0-9_.-]+$`
- **Value Limits**: Maximum 500 characters per value
- **Total Size**: Maximum 10KB total metadata per file

## CLI Usage

```bash
# Set provider to crunchycone
export CRUNCHYCONE_STORAGE_PROVIDER=crunchycone

# Upload file
npm run storage-cli -- upload document.pdf --external-id doc-123 --provider crunchycone

# Find file
npm run storage-cli -- find doc-123 --provider crunchycone

# Check if file exists
npm run storage-cli -- exists doc-123 --provider crunchycone

# Delete file
npm run storage-cli -- delete doc-123 --provider crunchycone

# Run comprehensive tests
npm run storage-cli -- test --provider crunchycone
```

## API Methods

### Core Storage Interface

All methods from the standard `StorageProvider` interface:

- `uploadFile(options)` - Upload file with two-step process
- `deleteFile(key)` - Delete file by storage key
- `deleteFileByExternalId(externalId)` - Delete file by external ID
- `getFileUrl(key, expiresIn?)` - Get download URL by storage key
- `getFileUrlByExternalId(externalId, expiresIn?)` - Get download URL by external ID
- `fileExists(key)` - Check if file exists by storage key
- `fileExistsByExternalId(externalId)` - Check if file exists by external ID
- `findFileByExternalId(externalId)` - Get file metadata by external ID

### CrunchyCone-Specific Methods

- `setUserId(userId)` - Set or change the user ID for operations

## Error Handling

### Common Errors

```typescript
try {
  await uploadFile(options);
} catch (error) {
  if (error.message.includes('409')) {
    // External ID already exists
    console.error('File with this external ID already exists');
  } else if (error.message.includes('413')) {
    // File too large
    console.error('File size exceeds maximum limit');
  } else if (error.message.includes('timeout')) {
    // Request timeout
    console.error('Upload timed out, please try again');
  }
}
```

### Upload Verification

The CrunchyCone service tracks upload status:
- `pending` - File descriptor created, upload not started
- `uploading` - Upload in progress
- `completed` - Upload successful and verified
- `failed` - Upload failed validation

### Retry Logic

Failed uploads can be retried using the same `external_id`. The service will:
1. Clean up any partial uploads
2. Create a new file descriptor
3. Generate a fresh presigned upload URL

## Performance Considerations

### Upload Size Limits
- Maximum file size: 100MB per file
- Presigned URL expiry: 15 minutes
- Size validation: ±1% tolerance between expected and actual size

### Rate Limiting
- Upload creation: 100 requests/minute per API key
- File uploads: 10 concurrent uploads per API key
- Download requests: 1000 requests/minute per API key

### Best Practices

1. **Use meaningful external IDs**: Makes file management easier
2. **Add rich metadata**: Enables powerful filtering and search
3. **Handle timeouts gracefully**: Implement retry logic for failed uploads
4. **Validate file sizes**: Check before upload to avoid waste
5. **Cache download URLs**: URLs are valid for 60 minutes by default

## Integration with Other Systems

### Next.js Server Actions

```typescript
'use server';

import { uploadFile } from '@crunchycone/lib';

export async function uploadUserDocument(formData: FormData) {
  const file = formData.get('file') as File;
  const userId = formData.get('userId') as string;
  
  const buffer = Buffer.from(await file.arrayBuffer());
  
  return await uploadFile({
    external_id: `user-doc-${userId}-${Date.now()}`,
    buffer,
    filename: file.name,
    contentType: file.type,
    metadata: {
      user_id: userId,
      upload_source: 'web_form',
      original_name: file.name
    }
  });
}
```

### React File Upload Component

```typescript
import { useState } from 'react';

export function FileUploadComponent() {
  const [uploading, setUploading] = useState(false);
  
  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', currentUserId);
      
      const result = await uploadUserDocument(formData);
      console.log('Upload successful:', result.url);
    } finally {
      setUploading(false);
    }
  };
  
  return (
    <div>
      <input 
        type="file" 
        onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
        disabled={uploading}
      />
      {uploading && <p>Uploading...</p>}
    </div>
  );
}
```

## Security Considerations

- **API Key Security**: Never expose API keys in client-side code
- **User Isolation**: Each user can only access their own files
- **Signed URLs**: Download URLs are temporary and signed
- **Project Scoping**: Files are scoped to specific projects
- **Metadata Validation**: All metadata is validated and sanitized

## Troubleshooting

### Common Issues

1. **User ID not set**: Ensure `setUserId()` is called or `CRUNCHYCONE_USER_ID` is set
2. **API key invalid**: Check that your API key is correct and has proper permissions
3. **Project not found**: Verify the project ID exists and user has access
4. **External ID conflicts**: External IDs must be unique per user
5. **File too large**: Check file size limits (100MB max)
6. **Upload timeout**: Increase timeout or check network connectivity

### Debug Mode

Enable debug logging by setting environment variable:
```bash
DEBUG=crunchycone:storage
```

This will log all API requests and responses for troubleshooting.