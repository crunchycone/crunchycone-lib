import { StorageProvider, StorageFileInfo } from './types';

export interface SyncOptions {
  // Source and destination providers
  source: StorageProvider;
  destination: StorageProvider;

  // What to sync
  filter?: {
    prefix?: string;
    externalIds?: string[];
    contentType?: string;
    contentTypePrefix?: string;
    minSize?: number;
    maxSize?: number;
  };

  // How to sync
  direction: 'one-way' | 'two-way';
  conflictResolution?: 'skip' | 'overwrite' | 'newest-wins' | 'largest-wins';

  // Options
  dryRun?: boolean; // Don't actually copy, just report what would be done
  deleteOrphaned?: boolean; // Delete files in destination that don't exist in source
  batchSize?: number; // Process N files at a time (default: 10)
  preserveTimestamps?: boolean; // Attempt to preserve original timestamps (LocalStorage only)

  // Callbacks for progress tracking
  onProgress?: (progress: SyncProgress) => void;
  onError?: (error: SyncError) => void;
  onFileComplete?: (result: SyncFileResult) => void;
}

export interface SyncProgress {
  phase: 'scanning' | 'syncing' | 'cleaning' | 'complete';
  totalFiles: number;
  processedFiles: number;
  copiedFiles: number;
  skippedFiles: number;
  deletedFiles: number;
  errors: number;
  currentFile?: string;
}

export interface SyncResult {
  success: boolean;
  summary: {
    scanned: number;
    copied: number;
    skipped: number;
    deleted: number;
    errors: number;
    durationMs: number;
  };
  details: SyncFileResult[];
}

export interface SyncFileResult {
  external_id: string;
  key: string;
  action: 'copied' | 'skipped' | 'deleted' | 'error';
  reason?: string;
  error?: string;
  size?: number;
}

export interface SyncError {
  external_id: string;
  key?: string;
  error: string;
  phase: 'scan' | 'copy' | 'delete' | 'verify';
}

export interface SyncVerificationResult {
  matched: boolean;
  differences: string[];
}

/**
 * Synchronize files between two storage providers
 *
 * @example
 * ```typescript
 * import { LocalStorageProvider } from 'crunchycone-lib/storage/providers/local';
 * import { CrunchyConeProvider } from 'crunchycone-lib/storage/providers/crunchycone';
 * import { syncStorageProviders } from 'crunchycone-lib/storage';
 *
 * const local = new LocalStorageProvider();
 * const remote = new CrunchyConeProvider();
 *
 * const result = await syncStorageProviders({
 *   source: local,
 *   destination: remote,
 *   direction: 'one-way',
 *   conflictResolution: 'skip',
 *   onProgress: (progress) => {
 *     console.log(`Progress: ${progress.processedFiles}/${progress.totalFiles}`);
 *   },
 * });
 *
 * console.log(`Synced ${result.summary.copied} files`);
 * ```
 */
export async function syncStorageProviders(
  options: SyncOptions,
): Promise<SyncResult> {
  const startTime = Date.now();

  const result: SyncResult = {
    success: true,
    summary: {
      scanned: 0,
      copied: 0,
      skipped: 0,
      deleted: 0,
      errors: 0,
      durationMs: 0,
    },
    details: [],
  };

  try {
    // Phase 1: Scan source files
    options.onProgress?.({
      phase: 'scanning',
      totalFiles: 0,
      processedFiles: 0,
      copiedFiles: 0,
      skippedFiles: 0,
      deletedFiles: 0,
      errors: 0,
    });

    const sourceFiles = await listAllFiles(options.source, options.filter);
    result.summary.scanned = sourceFiles.length;

    // Phase 2: Sync files from source to destination
    options.onProgress?.({
      phase: 'syncing',
      totalFiles: sourceFiles.length,
      processedFiles: 0,
      copiedFiles: 0,
      skippedFiles: 0,
      deletedFiles: 0,
      errors: 0,
    });

    const batchSize = options.batchSize || 10;
    for (let i = 0; i < sourceFiles.length; i += batchSize) {
      const batch = sourceFiles.slice(i, i + batchSize);

      const batchResults = await Promise.allSettled(
        batch.map(file => syncSingleFile(file, options)),
      );

      for (const batchResult of batchResults) {
        if (batchResult.status === 'fulfilled') {
          const fileResult = batchResult.value;
          result.details.push(fileResult);

          if (fileResult.action === 'copied') result.summary.copied++;
          else if (fileResult.action === 'skipped') result.summary.skipped++;
          else if (fileResult.action === 'error') result.summary.errors++;

          options.onFileComplete?.(fileResult);
        } else {
          result.summary.errors++;
          const errorResult: SyncFileResult = {
            external_id: 'unknown',
            key: 'unknown',
            action: 'error',
            error: batchResult.reason?.toString() || 'Unknown error',
          };
          result.details.push(errorResult);

          options.onError?.({
            external_id: 'unknown',
            error: batchResult.reason?.toString() || 'Unknown error',
            phase: 'copy',
          });
        }
      }

      options.onProgress?.({
        phase: 'syncing',
        totalFiles: sourceFiles.length,
        processedFiles: Math.min(i + batch.length, sourceFiles.length),
        copiedFiles: result.summary.copied,
        skippedFiles: result.summary.skipped,
        deletedFiles: result.summary.deleted,
        errors: result.summary.errors,
        currentFile: batch[batch.length - 1]?.external_id,
      });
    }

    // Phase 3: Handle two-way sync or orphaned file deletion
    if (options.direction === 'two-way' || options.deleteOrphaned) {
      options.onProgress?.({
        phase: 'cleaning',
        totalFiles: sourceFiles.length,
        processedFiles: sourceFiles.length,
        copiedFiles: result.summary.copied,
        skippedFiles: result.summary.skipped,
        deletedFiles: result.summary.deleted,
        errors: result.summary.errors,
      });

      const destFiles = await listAllFiles(options.destination, options.filter);
      const sourceIds = new Set(sourceFiles.map(f => f.external_id));
      const destOnlyFiles = destFiles.filter(f => !sourceIds.has(f.external_id));

      if (options.direction === 'two-way') {
        // Sync files that only exist in destination back to source
        for (const file of destOnlyFiles) {
          const fileResult = await syncSingleFile(file, {
            ...options,
            source: options.destination,
            destination: options.source,
          });

          result.details.push(fileResult);
          if (fileResult.action === 'copied') result.summary.copied++;
          else if (fileResult.action === 'error') result.summary.errors++;

          options.onFileComplete?.(fileResult);
        }
      } else if (options.deleteOrphaned) {
        // Delete orphaned files in destination
        for (const file of destOnlyFiles) {
          const deleteResult: SyncFileResult = {
            external_id: file.external_id,
            key: file.key,
            action: 'deleted',
            size: file.size,
          };

          if (!options.dryRun) {
            try {
              await options.destination.deleteFileByExternalId(file.external_id);
              result.summary.deleted++;
            } catch (error) {
              result.summary.errors++;
              deleteResult.action = 'error';
              deleteResult.error = error instanceof Error ? error.message : 'Unknown error';

              options.onError?.({
                external_id: file.external_id,
                key: file.key,
                error: error instanceof Error ? error.message : 'Unknown error',
                phase: 'delete',
              });
            }
          } else {
            result.summary.deleted++;
          }

          result.details.push(deleteResult);
          options.onFileComplete?.(deleteResult);
        }
      }
    }

    // Phase 4: Complete
    result.summary.durationMs = Date.now() - startTime;

    options.onProgress?.({
      phase: 'complete',
      totalFiles: sourceFiles.length,
      processedFiles: sourceFiles.length,
      copiedFiles: result.summary.copied,
      skippedFiles: result.summary.skipped,
      deletedFiles: result.summary.deleted,
      errors: result.summary.errors,
    });

    result.success = result.summary.errors === 0;
    return result;
  } catch (error) {
    result.success = false;
    result.summary.durationMs = Date.now() - startTime;
    throw error;
  }
}

/**
 * Sync a single file from source to destination with full metadata preservation
 */
async function syncSingleFile(
  sourceFile: StorageFileInfo,
  options: SyncOptions,
): Promise<SyncFileResult> {
  try {
    // Check if file exists in destination
    const destFile = await options.destination.findFileByExternalId(
      sourceFile.external_id,
    );

    if (destFile) {
      // File exists - apply conflict resolution
      const shouldCopy = await shouldCopyFile(
        sourceFile,
        destFile,
        options.conflictResolution || 'skip',
      );

      if (!shouldCopy) {
        return {
          external_id: sourceFile.external_id,
          key: sourceFile.key,
          action: 'skipped',
          reason: 'File exists in destination and conflict resolution says skip',
          size: sourceFile.size,
        };
      }
    }

    // Copy the file with full metadata preservation
    if (!options.dryRun) {
      await copyFileWithMetadata(
        sourceFile,
        options.source,
        options.destination,
        options.preserveTimestamps,
      );
    }

    return {
      external_id: sourceFile.external_id,
      key: sourceFile.key,
      action: 'copied',
      size: sourceFile.size,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    options.onError?.({
      external_id: sourceFile.external_id,
      key: sourceFile.key,
      error: errorMessage,
      phase: 'copy',
    });

    return {
      external_id: sourceFile.external_id,
      key: sourceFile.key,
      action: 'error',
      error: errorMessage,
      size: sourceFile.size,
    };
  }
}

/**
 * Determine if a file should be copied based on conflict resolution strategy
 */
async function shouldCopyFile(
  sourceFile: StorageFileInfo,
  destFile: StorageFileInfo,
  resolution: 'skip' | 'overwrite' | 'newest-wins' | 'largest-wins',
): Promise<boolean> {
  switch (resolution) {
    case 'skip':
      return false;

    case 'overwrite':
      return true;

    case 'newest-wins':
      return (sourceFile.lastModified?.getTime() || 0) >
             (destFile.lastModified?.getTime() || 0);

    case 'largest-wins':
      return sourceFile.size > destFile.size;
  }
}

/**
 * Copy a file from source to destination with full metadata preservation
 * Preserves:
 * - File content (binary exact)
 * - Folder/path structure (key)
 * - External ID
 * - Content type
 * - File size
 * - Custom metadata
 * - Visibility (public/private)
 * - Original timestamps (in metadata)
 * - Original ETag (in metadata)
 */
async function copyFileWithMetadata(
  file: StorageFileInfo,
  source: StorageProvider,
  destination: StorageProvider,
  preserveTimestamps?: boolean,
): Promise<void> {
  // Get file content - prefer direct stream access over HTTP fetch
  let buffer: Buffer;

  if (source.getFileStreamByExternalId) {
    // Use direct file stream access (more efficient for server-side sync)
    const streamResult = await source.getFileStreamByExternalId(file.external_id);
    if (!streamResult || !streamResult.stream) {
      throw new Error(`Failed to get file stream for ${file.external_id}`);
    }

    // Convert stream to buffer based on stream type
    const chunks: Uint8Array[] = [];

    if (streamResult.streamType === 'web') {
      // Handle Web ReadableStream
      const reader = (streamResult.stream as ReadableStream).getReader();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }
    } else {
      // Handle Node.js ReadableStream
      const nodeStream = streamResult.stream as NodeJS.ReadableStream;

      await new Promise<void>((resolve, reject) => {
        nodeStream.on('data', (chunk: Buffer) => {
          chunks.push(new Uint8Array(chunk));
        });
        nodeStream.on('end', () => resolve());
        nodeStream.on('error', reject);
      });
    }

    buffer = Buffer.concat(chunks);
  } else {
    // Fallback to HTTP fetch for providers without direct stream access
    const url = await source.getFileUrlByExternalId(file.external_id);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
    }
    buffer = Buffer.from(await response.arrayBuffer());
  }

  // Get visibility status from source
  let visibility: 'public' | 'private' = 'private';
  try {
    const visibilityStatus = await source.getFileVisibilityByExternalId(file.external_id);
    visibility = visibilityStatus.visibility === 'public' ? 'public' : 'private';
  } catch {
    // If visibility check fails, default to private
    visibility = 'private';
  }

  // Prepare comprehensive metadata with all original information
  const syncMetadata: Record<string, string> = {
    ...(file.metadata || {}), // Preserve all original custom metadata

    // Sync provenance information
    _synced_from: source.constructor.name,
    _synced_at: new Date().toISOString(),

    // Original file attributes (for audit trail)
    _original_size: file.size.toString(),
    _original_content_type: file.contentType,
    _original_key: file.key,
  };

  // Add timestamp information if available
  if (file.lastModified) {
    syncMetadata._original_last_modified = file.lastModified.toISOString();
  }

  // Add ETag if available (for content verification)
  if (file.etag) {
    syncMetadata._original_etag = file.etag;
  }

  // Add original URL for reference
  if (file.url) {
    syncMetadata._original_url = file.url;
  }

  // Add visibility information
  syncMetadata._original_visibility = visibility;

  // Upload to destination with all metadata preserved
  console.log('[Sync] Uploading to destination:', {
    provider: destination.constructor.name,
    external_id: file.external_id,
    key: file.key,
    filename: file.key.split('/').pop(),
    contentType: file.contentType,
    size: file.size,
    bufferSize: buffer.length,
    visibility,
  });

  const uploadResult = await destination.uploadFile({
    buffer,
    external_id: file.external_id,
    key: file.key, // Preserves full folder/path structure
    filename: file.key.split('/').pop(),
    contentType: file.contentType,
    size: file.size,
    public: visibility === 'public',
    metadata: syncMetadata,
  });

  console.log('[Sync] Upload result:', {
    external_id: uploadResult.external_id,
    key: uploadResult.key,
    url: uploadResult.url,
    size: uploadResult.size,
    visibility: uploadResult.visibility,
  });

  // Explicitly set visibility after upload (some providers may not respect the 'public' flag)
  if (visibility === 'public') {
    try {
      await destination.setFileVisibilityByExternalId(file.external_id, 'public');
    } catch (error) {
      // Log warning but don't fail - some providers may not support visibility changes
      console.warn(`Warning: Could not set public visibility for ${file.external_id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Special handling for LocalStorage -> LocalStorage to preserve exact timestamps
  if (
    preserveTimestamps &&
    source.constructor.name === 'LocalStorageProvider' &&
    destination.constructor.name === 'LocalStorageProvider' &&
    file.lastModified
  ) {
    await preserveLocalStorageTimestamps(file, destination);
  }
}

/**
 * Special handling for LocalStorage -> LocalStorage to preserve exact timestamps
 * This only works when syncing between two LocalStorage providers
 */
async function preserveLocalStorageTimestamps(
  file: StorageFileInfo,
  _destination: StorageProvider,
): Promise<void> {
  try {
    const fs = await import('fs');
    const path = await import('path');

    const basePath = process.env.CRUNCHYCONE_LOCALSTORAGE_PATH;
    if (!basePath || !file.lastModified) return;

    const metadataPath = path.join(basePath, `${file.key}.json`);
    const filePath = path.join(basePath, file.key);

    // Update metadata file with original timestamp
    try {
      const metadataContent = await fs.promises.readFile(metadataPath, 'utf-8');
      const metadata = JSON.parse(metadataContent);

      metadata.lastModified = file.lastModified.toISOString();
      await fs.promises.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

      // Also set file system mtime to match original
      await fs.promises.utimes(filePath, new Date(), file.lastModified);
    } catch (_error) {
      // Best effort - don't fail if timestamp preservation doesn't work
      console.warn(`Warning: Could not preserve timestamps for ${file.key}`);
    }
  } catch (_error) {
    // Ignore errors - timestamp preservation is best effort
  }
}

/**
 * List all files from a provider with optional filtering
 * Handles pagination automatically
 */
async function listAllFiles(
  provider: StorageProvider,
  filter?: SyncOptions['filter'],
): Promise<StorageFileInfo[]> {
  const allFiles: StorageFileInfo[] = [];
  let offset = 0;
  const limit = 100;
  let hasMore = true;

  while (hasMore) {
    const result = await provider.listFiles({
      limit,
      offset,
      prefix: filter?.prefix,
      externalIds: filter?.externalIds,
      contentType: filter?.contentType,
      contentTypePrefix: filter?.contentTypePrefix,
      minSize: filter?.minSize,
      maxSize: filter?.maxSize,
    });

    allFiles.push(...result.files);
    hasMore = result.hasMore;
    offset += limit;
  }

  return allFiles;
}

/**
 * Verify that a synced file matches between source and destination
 *
 * @example
 * ```typescript
 * const verification = await verifySyncedFile('user-avatar-123', local, remote);
 * if (!verification.matched) {
 *   console.error('Sync verification failed:', verification.differences);
 * }
 * ```
 */
export async function verifySyncedFile(
  externalId: string,
  source: StorageProvider,
  destination: StorageProvider,
): Promise<SyncVerificationResult> {
  const sourceFile = await source.findFileByExternalId(externalId);
  const destFile = await destination.findFileByExternalId(externalId);

  if (!sourceFile || !destFile) {
    return {
      matched: false,
      differences: ['File not found in one or both providers'],
    };
  }

  const differences: string[] = [];

  // Check key/path (folder structure)
  if (sourceFile.key !== destFile.key) {
    differences.push(`Key mismatch: "${sourceFile.key}" != "${destFile.key}"`);
  }

  // Check file size
  if (sourceFile.size !== destFile.size) {
    differences.push(`Size mismatch: ${sourceFile.size} bytes != ${destFile.size} bytes`);
  }

  // Check content type
  if (sourceFile.contentType !== destFile.contentType) {
    differences.push(`ContentType mismatch: "${sourceFile.contentType}" != "${destFile.contentType}"`);
  }

  // Check visibility
  try {
    const sourceVis = await source.getFileVisibilityByExternalId(externalId);
    const destVis = await destination.getFileVisibilityByExternalId(externalId);

    if (sourceVis.visibility !== destVis.visibility) {
      differences.push(`Visibility mismatch: "${sourceVis.visibility}" != "${destVis.visibility}"`);
    }
  } catch (error) {
    differences.push(`Could not verify visibility: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Check custom metadata (excluding sync metadata)
  const sourceKeys = Object.keys(sourceFile.metadata || {}).filter(k => !k.startsWith('_synced') && !k.startsWith('_original'));
  const destMetadata = destFile.metadata || {};

  for (const key of sourceKeys) {
    const sourceValue = sourceFile.metadata![key];
    const destValue = destMetadata[key];

    if (sourceValue !== destValue) {
      differences.push(`Metadata["${key}"] mismatch: "${sourceValue}" != "${destValue}"`);
    }
  }

  // Check if destination has the sync metadata
  if (!destMetadata._synced_from) {
    differences.push('Missing sync metadata in destination file');
  }

  return {
    matched: differences.length === 0,
    differences,
  };
}

/**
 * Get a summary of sync status by comparing two providers
 * Useful for understanding what would happen before running a sync
 *
 * @example
 * ```typescript
 * const status = await getSyncStatus(local, remote);
 * console.log(`${status.sourceOnly} files only in source`);
 * console.log(`${status.destOnly} files only in destination`);
 * console.log(`${status.conflicts} potential conflicts`);
 * ```
 */
export async function getSyncStatus(
  source: StorageProvider,
  destination: StorageProvider,
  filter?: SyncOptions['filter'],
): Promise<{
  sourceFiles: number;
  destFiles: number;
  sourceOnly: number;
  destOnly: number;
  inBoth: number;
  conflicts: number;
  conflictDetails: Array<{
    external_id: string;
    sourceSize: number;
    destSize: number;
    sourceModified?: Date;
    destModified?: Date;
  }>;
}> {
  const sourceFiles = await listAllFiles(source, filter);
  const destFiles = await listAllFiles(destination, filter);

  const sourceIds = new Map(sourceFiles.map(f => [f.external_id, f]));
  const destIds = new Map(destFiles.map(f => [f.external_id, f]));

  const sourceOnly = sourceFiles.filter(f => !destIds.has(f.external_id)).length;
  const destOnly = destFiles.filter(f => !sourceIds.has(f.external_id)).length;
  const inBoth = sourceFiles.filter(f => destIds.has(f.external_id)).length;

  // Check for conflicts (files that exist in both but differ)
  const conflicts: Array<{
    external_id: string;
    sourceSize: number;
    destSize: number;
    sourceModified?: Date;
    destModified?: Date;
  }> = [];

  for (const sourceFile of sourceFiles) {
    const destFile = destIds.get(sourceFile.external_id);
    if (destFile) {
      // Check if files differ
      if (sourceFile.size !== destFile.size ||
          sourceFile.lastModified?.getTime() !== destFile.lastModified?.getTime()) {
        conflicts.push({
          external_id: sourceFile.external_id,
          sourceSize: sourceFile.size,
          destSize: destFile.size,
          sourceModified: sourceFile.lastModified,
          destModified: destFile.lastModified,
        });
      }
    }
  }

  return {
    sourceFiles: sourceFiles.length,
    destFiles: destFiles.length,
    sourceOnly,
    destOnly,
    inBoth,
    conflicts: conflicts.length,
    conflictDetails: conflicts,
  };
}
