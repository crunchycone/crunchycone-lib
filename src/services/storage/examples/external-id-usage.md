# External ID Usage Examples

The storage system now supports `external_id` for easier file management and lookup. Here are examples of how to use this feature:

## Basic Upload with External ID

```typescript
import { uploadFile, generateExternalId } from 'crunchycone-lib/storage';

// Generate a unique external ID
const externalId = generateExternalId(); // Returns: ext_1234567890_abc123...

// Upload file with external_id
const result = await uploadFile({
  external_id: externalId,
  stream: file.stream(),
  filename: 'document.pdf',
  contentType: 'application/pdf',
  size: file.size,
  public: false,
});

console.log('File uploaded:', result.external_id); // Same as externalId
```

## Using Custom External IDs

```typescript
// You can use your own external IDs (e.g., database record IDs)
const customExternalId = `user-avatar-${userId}`;

const result = await uploadFile({
  external_id: customExternalId,
  buffer: imageBuffer,
  filename: 'avatar.jpg',
  contentType: 'image/jpeg',
  public: true,
});
```

## Finding Files by External ID

```typescript
import { findFileByExternalId } from 'crunchycone-lib/storage';

// Find a file using its external_id
const fileInfo = await findFileByExternalId('user-avatar-123');

if (fileInfo) {
  console.log('File found:', fileInfo.url);
  console.log('File size:', fileInfo.size);
  console.log('Content type:', fileInfo.contentType);
} else {
  console.log('File not found');
}
```

## Getting File URLs by External ID

```typescript
import { getFileUrlByExternalId } from 'crunchycone-lib/storage';

// Get a file URL without needing the storage key
const url = await getFileUrlByExternalId('user-document-456');
console.log('File URL:', url);

// For signed URLs (S3 providers)
const signedUrl = await getFileUrlByExternalId('private-file-789', 3600); // 1 hour
```

## Deleting Files by External ID

```typescript
import { deleteFileByExternalId } from 'crunchycone-lib/storage';

// Delete a file using its external_id
await deleteFileByExternalId('old-profile-pic-123');
console.log('File deleted');
```

## Checking File Existence

```typescript
import { fileExistsByExternalId } from 'crunchycone-lib/storage';

const exists = await fileExistsByExternalId('report-2024-001');
if (exists) {
  console.log('File exists');
} else {
  console.log('File not found');
}
```

## Real-world Example: User Profile Pictures

```typescript
export async function updateUserAvatar(userId: string, file: File) {
  // Use a predictable external_id pattern
  const externalId = `user-avatar-${userId}`;
  
  // Check if user already has an avatar and delete it
  const existingFile = await findFileByExternalId(externalId);
  if (existingFile) {
    await deleteFileByExternalId(externalId);
  }
  
  // Upload new avatar with same external_id
  const result = await uploadFile({
    external_id: externalId,
    stream: file.stream(),
    filename: `avatar-${userId}.jpg`,
    contentType: file.type,
    size: file.size,
    public: true,
    metadata: {
      userId,
      type: 'avatar',
      uploadedAt: new Date().toISOString(),
    },
  });
  
  return result.url;
}

export async function getUserAvatarUrl(userId: string): Promise<string | null> {
  const externalId = `user-avatar-${userId}`;
  
  try {
    return await getFileUrlByExternalId(externalId);
  } catch (error) {
    return null; // File not found
  }
}
```

## Benefits of External ID System

### ✅ **Easy File Management**
- No need to store or remember complex storage keys
- Use meaningful identifiers that relate to your business logic

### ✅ **Direct Lookup**
- Find files by external_id without database queries
- Perfect for user-uploaded content, documents, and media

### ✅ **Update Operations**
- Easily replace files by using the same external_id
- Maintain consistent URLs for users

### ✅ **Database Integration**
- Use database record IDs as external_ids
- No need for separate file_path columns in your database

### ✅ **Provider Agnostic**
- Works with all storage providers (local, S3, DigitalOcean, etc.)
- Consistent API regardless of backend storage

---
*Last updated: 2025-08-22*