# Storage Sync

Synchronize files between different storage providers (e.g., LocalStorage to CrunchyCone, or any provider to any provider).

## Features

- **One-way or two-way sync** between any storage providers
- **Full metadata preservation** - preserves paths, custom metadata, visibility, timestamps, etc.
- **Conflict resolution strategies** - skip, overwrite, newest-wins, largest-wins
- **Progress tracking** - monitor sync progress with callbacks
- **Dry run mode** - preview what would be synced without actually copying
- **Batch processing** - control concurrency and performance
- **Verification** - verify synced files match

## Basic Usage

### One-Way Sync (Local → Remote)

```typescript
import { LocalStorageProvider } from 'crunchycone-lib/storage/providers/local';
import { CrunchyConeProvider } from 'crunchycone-lib/storage/providers/crunchycone';
import { syncStorageProviders } from 'crunchycone-lib/storage';

// Initialize providers
const local = new LocalStorageProvider();
const remote = new CrunchyConeProvider();

// Sync all files from local to remote
const result = await syncStorageProviders({
  source: local,
  destination: remote,
  direction: 'one-way',
  conflictResolution: 'skip', // Don't overwrite existing files
  onProgress: (progress) => {
    console.log(`Progress: ${progress.processedFiles}/${progress.totalFiles}`);
    console.log(`Copied: ${progress.copiedFiles}, Skipped: ${progress.skippedFiles}`);
  },
});

console.log(`✅ Synced ${result.summary.copied} files`);
console.log(`⏭️  Skipped ${result.summary.skipped} files`);
console.log(`❌ Errors: ${result.summary.errors}`);
```

### Two-Way Sync

```typescript
// Sync files in both directions
const result = await syncStorageProviders({
  source: local,
  destination: remote,
  direction: 'two-way',
  conflictResolution: 'newest-wins', // Newest file wins conflicts
});
```

## Conflict Resolution Strategies

When a file exists in both source and destination:

- **`skip`** - Don't copy, keep destination file (safest)
- **`overwrite`** - Always copy from source to destination
- **`newest-wins`** - Copy the file with the most recent modification time
- **`largest-wins`** - Copy the larger file

```typescript
await syncStorageProviders({
  source: local,
  destination: remote,
  direction: 'one-way',
  conflictResolution: 'newest-wins',
});
```

## Filtering

Sync only specific files:

```typescript
// Sync only images
await syncStorageProviders({
  source: local,
  destination: remote,
  direction: 'one-way',
  filter: {
    contentTypePrefix: 'image/',
  },
});

// Sync files in specific folder
await syncStorageProviders({
  source: local,
  destination: remote,
  direction: 'one-way',
  filter: {
    prefix: 'uploads/avatars/',
  },
});

// Sync specific files
await syncStorageProviders({
  source: local,
  destination: remote,
  direction: 'one-way',
  filter: {
    externalIds: ['user-avatar-123', 'user-avatar-456'],
  },
});

// Sync files by size
await syncStorageProviders({
  source: local,
  destination: remote,
  direction: 'one-way',
  filter: {
    minSize: 1024, // At least 1KB
    maxSize: 10 * 1024 * 1024, // At most 10MB
  },
});
```

## Dry Run

Preview what would be synced without actually copying:

```typescript
const result = await syncStorageProviders({
  source: local,
  destination: remote,
  direction: 'one-way',
  dryRun: true, // Don't actually copy files
});

console.log(`Would sync ${result.summary.copied} files`);
console.log(`Would skip ${result.summary.skipped} files`);

// Review details
for (const detail of result.details) {
  console.log(`${detail.action}: ${detail.external_id}`);
}
```

## Progress Tracking

Monitor sync progress with detailed callbacks:

```typescript
await syncStorageProviders({
  source: local,
  destination: remote,
  direction: 'one-way',
  onProgress: (progress) => {
    const percent = (progress.processedFiles / progress.totalFiles * 100).toFixed(1);
    console.log(`[${percent}%] ${progress.currentFile || ''}`);
  },
  onFileComplete: (result) => {
    if (result.action === 'copied') {
      console.log(`✅ Copied: ${result.key} (${result.size} bytes)`);
    } else if (result.action === 'error') {
      console.error(`❌ Error: ${result.key} - ${result.error}`);
    }
  },
  onError: (error) => {
    console.error(`Error in ${error.phase}: ${error.external_id} - ${error.error}`);
  },
});
```

## Delete Orphaned Files

Delete files in destination that don't exist in source:

```typescript
await syncStorageProviders({
  source: local,
  destination: remote,
  direction: 'one-way',
  deleteOrphaned: true, // ⚠️ Use with caution!
});
```

## Batch Size Control

Control how many files are processed concurrently:

```typescript
await syncStorageProviders({
  source: local,
  destination: remote,
  direction: 'one-way',
  batchSize: 5, // Process 5 files at a time (default: 10)
});
```

## Preserve Timestamps

For LocalStorage → LocalStorage syncs, preserve exact timestamps:

```typescript
await syncStorageProviders({
  source: local1,
  destination: local2,
  direction: 'one-way',
  preserveTimestamps: true, // Only works for LocalStorage → LocalStorage
});
```

## Verification

Verify that synced files match:

```typescript
import { verifySyncedFile } from 'crunchycone-lib/storage';

// Verify a specific file
const verification = await verifySyncedFile('user-avatar-123', local, remote);

if (!verification.matched) {
  console.error('Sync verification failed:', verification.differences);
}
```

## Sync Status Check

Check sync status before syncing:

```typescript
import { getSyncStatus } from 'crunchycone-lib/storage';

const status = await getSyncStatus(local, remote);

console.log(`Source files: ${status.sourceFiles}`);
console.log(`Destination files: ${status.destFiles}`);
console.log(`Only in source: ${status.sourceOnly}`);
console.log(`Only in destination: ${status.destOnly}`);
console.log(`In both: ${status.inBoth}`);
console.log(`Conflicts: ${status.conflicts}`);

// Review conflict details
for (const conflict of status.conflictDetails) {
  console.log(`Conflict: ${conflict.external_id}`);
  console.log(`  Source: ${conflict.sourceSize} bytes, modified ${conflict.sourceModified}`);
  console.log(`  Dest: ${conflict.destSize} bytes, modified ${conflict.destModified}`);
}
```

## What Gets Preserved

### ✅ Fully Preserved
- File content (binary exact)
- Folder/path structure (`key`)
- External ID
- Content type
- File size
- Custom metadata (all key-value pairs)
- Visibility (public/private)
- Original timestamps (stored in metadata)
- Original ETag (stored in metadata)

### 🔄 Regenerated by Destination
- URLs (provider-specific)
- ETags (provider-specific, but original saved in metadata)
- Provider-specific timestamps (`created_at`, `updated_at`)

### Sync Metadata

The sync process adds metadata to track provenance:

```json
{
  "_synced_from": "LocalStorageProvider",
  "_synced_at": "2025-10-08T12:34:56.789Z",
  "_original_size": "12345",
  "_original_content_type": "image/jpeg",
  "_original_key": "uploads/avatar.jpg",
  "_original_last_modified": "2025-10-08T10:00:00.000Z",
  "_original_etag": "abc123",
  "_original_url": "http://localhost:3000/uploads/avatar.jpg",
  "_original_visibility": "public"
}
```

## Error Handling

The sync function returns detailed error information:

```typescript
const result = await syncStorageProviders({
  source: local,
  destination: remote,
  direction: 'one-way',
});

if (!result.success) {
  console.error(`Sync failed with ${result.summary.errors} errors`);

  // Review errors
  const errors = result.details.filter(d => d.action === 'error');
  for (const error of errors) {
    console.error(`Failed: ${error.external_id} - ${error.error}`);
  }
}
```

## Complete Example

```typescript
import { LocalStorageProvider } from 'crunchycone-lib/storage/providers/local';
import { CrunchyConeProvider } from 'crunchycone-lib/storage/providers/crunchycone';
import { syncStorageProviders, getSyncStatus } from 'crunchycone-lib/storage';

async function syncLocalToRemote() {
  const local = new LocalStorageProvider();
  const remote = new CrunchyConeProvider();

  // Check status first
  console.log('Checking sync status...');
  const status = await getSyncStatus(local, remote);

  console.log(`Files to sync: ${status.sourceOnly}`);
  console.log(`Potential conflicts: ${status.conflicts}`);

  if (status.conflicts > 0) {
    console.log('Conflicts will be resolved using newest-wins strategy');
  }

  // Perform sync
  console.log('\nStarting sync...');
  const result = await syncStorageProviders({
    source: local,
    destination: remote,
    direction: 'one-way',
    conflictResolution: 'newest-wins',
    batchSize: 5,
    onProgress: (progress) => {
      if (progress.phase === 'syncing') {
        const percent = (progress.processedFiles / progress.totalFiles * 100).toFixed(1);
        process.stdout.write(`\r[${percent}%] ${progress.copiedFiles} copied, ${progress.skippedFiles} skipped`);
      }
    },
  });

  console.log('\n\nSync complete!');
  console.log(`✅ Copied: ${result.summary.copied}`);
  console.log(`⏭️  Skipped: ${result.summary.skipped}`);
  console.log(`❌ Errors: ${result.summary.errors}`);
  console.log(`⏱️  Duration: ${(result.summary.durationMs / 1000).toFixed(2)}s`);

  if (result.summary.errors > 0) {
    console.log('\nErrors:');
    const errors = result.details.filter(d => d.action === 'error');
    for (const error of errors) {
      console.error(`  - ${error.external_id}: ${error.error}`);
    }
  }

  return result.success;
}

syncLocalToRemote()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Sync failed:', error);
    process.exit(1);
  });
```

## Use Cases

### 1. Migrate from Local to Cloud

```typescript
// One-time migration
await syncStorageProviders({
  source: localProvider,
  destination: crunchyConeProvider,
  direction: 'one-way',
  conflictResolution: 'overwrite',
});
```

### 2. Backup Cloud to Local

```typescript
// Regular backups
await syncStorageProviders({
  source: crunchyConeProvider,
  destination: localProvider,
  direction: 'one-way',
  conflictResolution: 'skip', // Don't overwrite local backups
});
```

### 3. Keep Two Systems in Sync

```typescript
// Bidirectional sync
await syncStorageProviders({
  source: provider1,
  destination: provider2,
  direction: 'two-way',
  conflictResolution: 'newest-wins',
});
```

### 4. Clone Storage Provider

```typescript
// Exact copy
await syncStorageProviders({
  source: sourceProvider,
  destination: destinationProvider,
  direction: 'one-way',
  conflictResolution: 'overwrite',
  deleteOrphaned: true, // Make exact mirror
});
```
