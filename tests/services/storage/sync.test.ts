import {
  syncStorageProviders,
  verifySyncedFile,
  getSyncStatus,
  SyncProgress,
  SyncFileResult,
  SyncError,
} from '../../../src/services/storage/sync';
import {
  StorageProvider,
  StorageFileInfo,
  StorageUploadOptions,
  StorageUploadResult,
  ListFilesOptions,
  ListFilesResult,
  SearchFilesOptions,
  SearchFilesResult,
  FileVisibilityResult,
  FileVisibilityStatus,
  FileUrlOptions,
} from '../../../src/services/storage/types';

// Mock storage provider implementation
class MockStorageProvider implements StorageProvider {
  private files: Map<string, StorageFileInfo> = new Map();
  public uploadCalls: StorageUploadOptions[] = [];
  public deleteCalls: string[] = [];

  constructor(private name: string) {}

  addFile(file: StorageFileInfo): void {
    this.files.set(file.external_id, file);
  }

  async uploadFile(options: StorageUploadOptions): Promise<StorageUploadResult> {
    this.uploadCalls.push(options);

    const fileInfo: StorageFileInfo = {
      external_id: options.external_id,
      key: options.key || `files/${options.external_id}`,
      url: `http://example.com/${options.key || options.external_id}`,
      size: options.size || 1000,
      contentType: options.contentType || 'application/octet-stream',
      lastModified: new Date(),
      metadata: options.metadata,
      visibility: options.public ? 'public' : 'private',
    };

    this.files.set(options.external_id, fileInfo);

    return {
      external_id: options.external_id,
      key: fileInfo.key,
      url: fileInfo.url,
      size: fileInfo.size,
      contentType: fileInfo.contentType,
      metadata: options.metadata,
      visibility: fileInfo.visibility || 'private',
    };
  }

  async deleteFile(key: string): Promise<void> {
    this.deleteCalls.push(key);
    // Find by key and delete
    for (const [id, file] of this.files.entries()) {
      if (file.key === key) {
        this.files.delete(id);
        break;
      }
    }
  }

  async deleteFileByExternalId(externalId: string): Promise<void> {
    this.deleteCalls.push(externalId);
    this.files.delete(externalId);
  }

  async getFileUrl(key: string, _expiresIn?: number, _options?: FileUrlOptions): Promise<string> {
    for (const file of this.files.values()) {
      if (file.key === key) {
        return file.url;
      }
    }
    throw new Error(`File with key ${key} not found`);
  }

  async getFileUrlByExternalId(externalId: string, _expiresIn?: number, _options?: FileUrlOptions): Promise<string> {
    const file = this.files.get(externalId);
    if (!file) {
      throw new Error(`File with external_id ${externalId} not found`);
    }
    return file.url;
  }

  async fileExists(key: string): Promise<boolean> {
    for (const file of this.files.values()) {
      if (file.key === key) return true;
    }
    return false;
  }

  async fileExistsByExternalId(externalId: string): Promise<boolean> {
    return this.files.has(externalId);
  }

  async findFileByExternalId(externalId: string): Promise<StorageFileInfo | null> {
    return this.files.get(externalId) || null;
  }

  async listFiles(options: ListFilesOptions = {}): Promise<ListFilesResult> {
    let files = Array.from(this.files.values());

    // Apply filters
    if (options.prefix) {
      files = files.filter(f => f.key.startsWith(options.prefix!));
    }
    if (options.externalIds) {
      files = files.filter(f => options.externalIds!.includes(f.external_id));
    }
    if (options.contentType) {
      files = files.filter(f => f.contentType === options.contentType);
    }
    if (options.contentTypePrefix) {
      files = files.filter(f => f.contentType.startsWith(options.contentTypePrefix!));
    }
    if (options.minSize !== undefined) {
      files = files.filter(f => f.size >= options.minSize!);
    }
    if (options.maxSize !== undefined) {
      files = files.filter(f => f.size <= options.maxSize!);
    }

    // Apply pagination
    const offset = options.offset || 0;
    const limit = options.limit || 100;
    const paginatedFiles = files.slice(offset, offset + limit);

    return {
      files: paginatedFiles,
      totalCount: files.length,
      hasMore: offset + limit < files.length,
      nextOffset: offset + limit < files.length ? offset + limit : undefined,
    };
  }

  async searchFiles(options: SearchFilesOptions): Promise<SearchFilesResult> {
    const listResult = await this.listFiles(options);
    return {
      ...listResult,
      query: options.query,
      searchFields: options.searchFields,
    };
  }

  async setFileVisibility(key: string, visibility: 'public' | 'private'): Promise<FileVisibilityResult> {
    for (const file of this.files.values()) {
      if (file.key === key) {
        file.visibility = visibility;
        return {
          success: true,
          requestedVisibility: visibility,
          actualVisibility: visibility,
        };
      }
    }
    return {
      success: false,
      requestedVisibility: visibility,
      actualVisibility: 'private',
      message: 'File not found',
    };
  }

  async setFileVisibilityByExternalId(externalId: string, visibility: 'public' | 'private'): Promise<FileVisibilityResult> {
    const file = this.files.get(externalId);
    if (file) {
      file.visibility = visibility;
      return {
        success: true,
        requestedVisibility: visibility,
        actualVisibility: visibility,
      };
    }
    return {
      success: false,
      requestedVisibility: visibility,
      actualVisibility: 'private',
      message: 'File not found',
    };
  }

  async getFileVisibility(key: string): Promise<FileVisibilityStatus> {
    for (const file of this.files.values()) {
      if (file.key === key) {
        return {
          visibility: file.visibility || 'private',
          canMakePublic: true,
          canMakePrivate: true,
          supportsTemporaryAccess: false,
        };
      }
    }
    throw new Error('File not found');
  }

  async getFileVisibilityByExternalId(externalId: string): Promise<FileVisibilityStatus> {
    const file = this.files.get(externalId);
    if (file) {
      return {
        visibility: file.visibility || 'private',
        canMakePublic: true,
        canMakePrivate: true,
        supportsTemporaryAccess: false,
      };
    }
    throw new Error('File not found');
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  // Helper methods for testing
  getFileCount(): number {
    return this.files.size;
  }

  clearFiles(): void {
    this.files.clear();
    this.uploadCalls = [];
    this.deleteCalls = [];
  }
}

describe('Storage Sync', () => {
  let source: MockStorageProvider;
  let destination: MockStorageProvider;

  beforeEach(() => {
    source = new MockStorageProvider('source');
    destination = new MockStorageProvider('destination');

    // Mock global fetch for file downloads
    global.fetch = jest.fn((_input: string | URL | Request) => {
      return Promise.resolve({
        ok: true,
        status: 200,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(1000)),
      } as Response);
    }) as jest.Mock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('syncStorageProviders', () => {
    it('should sync files from source to destination (one-way)', async () => {
      // Add files to source
      source.addFile({
        external_id: 'file1',
        key: 'uploads/file1.jpg',
        url: 'http://source.com/file1.jpg',
        size: 1000,
        contentType: 'image/jpeg',
        lastModified: new Date('2025-01-01'),
      });
      source.addFile({
        external_id: 'file2',
        key: 'uploads/file2.jpg',
        url: 'http://source.com/file2.jpg',
        size: 2000,
        contentType: 'image/jpeg',
        lastModified: new Date('2025-01-02'),
      });

      const result = await syncStorageProviders({
        source,
        destination,
        direction: 'one-way',
      });

      expect(result.success).toBe(true);
      expect(result.summary.copied).toBe(2);
      expect(result.summary.skipped).toBe(0);
      expect(result.summary.errors).toBe(0);
      expect(destination.getFileCount()).toBe(2);
    });

    it('should skip existing files with "skip" conflict resolution', async () => {
      // Add file to both source and destination
      const file: StorageFileInfo = {
        external_id: 'file1',
        key: 'uploads/file1.jpg',
        url: 'http://example.com/file1.jpg',
        size: 1000,
        contentType: 'image/jpeg',
        lastModified: new Date('2025-01-01'),
      };

      source.addFile(file);
      destination.addFile(file);

      const result = await syncStorageProviders({
        source,
        destination,
        direction: 'one-way',
        conflictResolution: 'skip',
      });

      expect(result.summary.copied).toBe(0);
      expect(result.summary.skipped).toBe(1);
      expect(result.details[0].action).toBe('skipped');
    });

    it('should overwrite existing files with "overwrite" conflict resolution', async () => {
      // Add file to both
      source.addFile({
        external_id: 'file1',
        key: 'uploads/file1.jpg',
        url: 'http://source.com/file1.jpg',
        size: 1000,
        contentType: 'image/jpeg',
        lastModified: new Date('2025-01-01'),
      });
      destination.addFile({
        external_id: 'file1',
        key: 'uploads/file1.jpg',
        url: 'http://dest.com/file1.jpg',
        size: 500,
        contentType: 'image/jpeg',
        lastModified: new Date('2024-12-01'),
      });

      const result = await syncStorageProviders({
        source,
        destination,
        direction: 'one-way',
        conflictResolution: 'overwrite',
      });

      expect(result.summary.copied).toBe(1);
      expect(result.summary.skipped).toBe(0);
      expect(destination.uploadCalls.length).toBe(1);
    });

    it('should use "newest-wins" conflict resolution', async () => {
      // Source has newer file
      source.addFile({
        external_id: 'file1',
        key: 'uploads/file1.jpg',
        url: 'http://source.com/file1.jpg',
        size: 1000,
        contentType: 'image/jpeg',
        lastModified: new Date('2025-01-02'),
      });
      destination.addFile({
        external_id: 'file1',
        key: 'uploads/file1.jpg',
        url: 'http://dest.com/file1.jpg',
        size: 1000,
        contentType: 'image/jpeg',
        lastModified: new Date('2025-01-01'),
      });

      const result = await syncStorageProviders({
        source,
        destination,
        direction: 'one-way',
        conflictResolution: 'newest-wins',
      });

      expect(result.summary.copied).toBe(1);
      expect(result.summary.skipped).toBe(0);
    });

    it('should use "largest-wins" conflict resolution', async () => {
      // Source has larger file
      source.addFile({
        external_id: 'file1',
        key: 'uploads/file1.jpg',
        url: 'http://source.com/file1.jpg',
        size: 2000,
        contentType: 'image/jpeg',
        lastModified: new Date('2025-01-01'),
      });
      destination.addFile({
        external_id: 'file1',
        key: 'uploads/file1.jpg',
        url: 'http://dest.com/file1.jpg',
        size: 1000,
        contentType: 'image/jpeg',
        lastModified: new Date('2025-01-01'),
      });

      const result = await syncStorageProviders({
        source,
        destination,
        direction: 'one-way',
        conflictResolution: 'largest-wins',
      });

      expect(result.summary.copied).toBe(1);
      expect(result.summary.skipped).toBe(0);
    });

    it('should perform two-way sync', async () => {
      // File only in source
      source.addFile({
        external_id: 'file1',
        key: 'uploads/file1.jpg',
        url: 'http://source.com/file1.jpg',
        size: 1000,
        contentType: 'image/jpeg',
        lastModified: new Date('2025-01-01'),
      });

      // File only in destination
      destination.addFile({
        external_id: 'file2',
        key: 'uploads/file2.jpg',
        url: 'http://dest.com/file2.jpg',
        size: 2000,
        contentType: 'image/jpeg',
        lastModified: new Date('2025-01-02'),
      });

      const result = await syncStorageProviders({
        source,
        destination,
        direction: 'two-way',
      });

      expect(result.summary.copied).toBe(2); // One each direction
      expect(source.getFileCount()).toBe(2);
      expect(destination.getFileCount()).toBe(2);
    });

    it('should filter files by prefix', async () => {
      source.addFile({
        external_id: 'file1',
        key: 'uploads/avatars/file1.jpg',
        url: 'http://source.com/file1.jpg',
        size: 1000,
        contentType: 'image/jpeg',
      });
      source.addFile({
        external_id: 'file2',
        key: 'uploads/documents/file2.pdf',
        url: 'http://source.com/file2.pdf',
        size: 2000,
        contentType: 'application/pdf',
      });

      const result = await syncStorageProviders({
        source,
        destination,
        direction: 'one-way',
        filter: {
          prefix: 'uploads/avatars/',
        },
      });

      expect(result.summary.copied).toBe(1);
      expect(result.details[0].key).toBe('uploads/avatars/file1.jpg');
    });

    it('should filter files by content type', async () => {
      source.addFile({
        external_id: 'file1',
        key: 'uploads/file1.jpg',
        url: 'http://source.com/file1.jpg',
        size: 1000,
        contentType: 'image/jpeg',
      });
      source.addFile({
        external_id: 'file2',
        key: 'uploads/file2.pdf',
        url: 'http://source.com/file2.pdf',
        size: 2000,
        contentType: 'application/pdf',
      });

      const result = await syncStorageProviders({
        source,
        destination,
        direction: 'one-way',
        filter: {
          contentTypePrefix: 'image/',
        },
      });

      expect(result.summary.copied).toBe(1);
      expect(result.details[0].external_id).toBe('file1');
    });

    it('should filter files by size', async () => {
      source.addFile({
        external_id: 'small',
        key: 'uploads/small.jpg',
        url: 'http://source.com/small.jpg',
        size: 500,
        contentType: 'image/jpeg',
      });
      source.addFile({
        external_id: 'large',
        key: 'uploads/large.jpg',
        url: 'http://source.com/large.jpg',
        size: 5000,
        contentType: 'image/jpeg',
      });

      const result = await syncStorageProviders({
        source,
        destination,
        direction: 'one-way',
        filter: {
          minSize: 1000,
          maxSize: 10000,
        },
      });

      expect(result.summary.copied).toBe(1);
      expect(result.details[0].external_id).toBe('large');
    });

    it('should respect dry run mode', async () => {
      source.addFile({
        external_id: 'file1',
        key: 'uploads/file1.jpg',
        url: 'http://source.com/file1.jpg',
        size: 1000,
        contentType: 'image/jpeg',
      });

      const result = await syncStorageProviders({
        source,
        destination,
        direction: 'one-way',
        dryRun: true,
      });

      expect(result.summary.copied).toBe(1);
      expect(destination.getFileCount()).toBe(0); // Nothing actually copied
      expect(destination.uploadCalls.length).toBe(0);
    });

    it('should delete orphaned files when enabled', async () => {
      source.addFile({
        external_id: 'file1',
        key: 'uploads/file1.jpg',
        url: 'http://source.com/file1.jpg',
        size: 1000,
        contentType: 'image/jpeg',
      });

      // File only in destination (orphaned)
      destination.addFile({
        external_id: 'orphan',
        key: 'uploads/orphan.jpg',
        url: 'http://dest.com/orphan.jpg',
        size: 2000,
        contentType: 'image/jpeg',
      });

      const result = await syncStorageProviders({
        source,
        destination,
        direction: 'one-way',
        deleteOrphaned: true,
      });

      expect(result.summary.copied).toBe(1);
      expect(result.summary.deleted).toBe(1);
      expect(destination.deleteCalls).toContain('orphan');
    });

    it('should call progress callbacks', async () => {
      source.addFile({
        external_id: 'file1',
        key: 'uploads/file1.jpg',
        url: 'http://source.com/file1.jpg',
        size: 1000,
        contentType: 'image/jpeg',
      });

      const progressCalls: SyncProgress[] = [];
      const fileCompleteCalls: SyncFileResult[] = [];

      await syncStorageProviders({
        source,
        destination,
        direction: 'one-way',
        onProgress: (progress) => {
          progressCalls.push({ ...progress });
        },
        onFileComplete: (result) => {
          fileCompleteCalls.push({ ...result });
        },
      });

      expect(progressCalls.length).toBeGreaterThan(0);
      expect(progressCalls.some(p => p.phase === 'scanning')).toBe(true);
      expect(progressCalls.some(p => p.phase === 'syncing')).toBe(true);
      expect(progressCalls.some(p => p.phase === 'complete')).toBe(true);
      expect(fileCompleteCalls.length).toBe(1);
      expect(fileCompleteCalls[0].action).toBe('copied');
    });

    it('should handle errors gracefully', async () => {
      source.addFile({
        external_id: 'file1',
        key: 'uploads/file1.jpg',
        url: 'http://source.com/file1.jpg',
        size: 1000,
        contentType: 'image/jpeg',
      });

      // Mock fetch to fail
      global.fetch = jest.fn(() => {
        return Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        } as Response);
      });

      const errorCalls: SyncError[] = [];

      const result = await syncStorageProviders({
        source,
        destination,
        direction: 'one-way',
        onError: (error) => {
          errorCalls.push({ ...error });
        },
      });

      expect(result.success).toBe(false);
      expect(result.summary.errors).toBe(1);
      expect(errorCalls.length).toBe(1);
      expect(errorCalls[0].external_id).toBe('file1');
    });

    it('should process files in batches', async () => {
      // Add 10 files
      for (let i = 1; i <= 10; i++) {
        source.addFile({
          external_id: `file${i}`,
          key: `uploads/file${i}.jpg`,
          url: `http://source.com/file${i}.jpg`,
          size: 1000,
          contentType: 'image/jpeg',
        });
      }

      const result = await syncStorageProviders({
        source,
        destination,
        direction: 'one-way',
        batchSize: 3,
      });

      expect(result.summary.copied).toBe(10);
      expect(destination.getFileCount()).toBe(10);
    });

    it('should preserve metadata', async () => {
      source.addFile({
        external_id: 'file1',
        key: 'uploads/file1.jpg',
        url: 'http://source.com/file1.jpg',
        size: 1000,
        contentType: 'image/jpeg',
        metadata: {
          userId: '123',
          category: 'avatar',
        },
      });

      await syncStorageProviders({
        source,
        destination,
        direction: 'one-way',
      });

      const destFile = await destination.findFileByExternalId('file1');
      expect(destFile?.metadata).toBeDefined();
      expect(destFile?.metadata?.userId).toBe('123');
      expect(destFile?.metadata?.category).toBe('avatar');
      expect(destFile?.metadata?._synced_from).toBe('MockStorageProvider');
      expect(destFile?.metadata?._synced_at).toBeDefined();
    });

    it('should preserve visibility', async () => {
      source.addFile({
        external_id: 'file1',
        key: 'uploads/file1.jpg',
        url: 'http://source.com/file1.jpg',
        size: 1000,
        contentType: 'image/jpeg',
        visibility: 'public',
      });

      await syncStorageProviders({
        source,
        destination,
        direction: 'one-way',
      });

      const destFile = await destination.findFileByExternalId('file1');
      expect(destFile?.visibility).toBe('public');
    });
  });

  describe('verifySyncedFile', () => {
    it('should verify matching files', async () => {
      const file: StorageFileInfo = {
        external_id: 'file1',
        key: 'uploads/file1.jpg',
        url: 'http://example.com/file1.jpg',
        size: 1000,
        contentType: 'image/jpeg',
        metadata: { test: 'value' },
        visibility: 'private',
      };

      source.addFile(file);

      // Sync the file
      await syncStorageProviders({
        source,
        destination,
        direction: 'one-way',
      });

      const result = await verifySyncedFile('file1', source, destination);

      expect(result.matched).toBe(true);
      expect(result.differences).toHaveLength(0);
    });

    it('should detect size mismatches', async () => {
      source.addFile({
        external_id: 'file1',
        key: 'uploads/file1.jpg',
        url: 'http://source.com/file1.jpg',
        size: 1000,
        contentType: 'image/jpeg',
      });
      destination.addFile({
        external_id: 'file1',
        key: 'uploads/file1.jpg',
        url: 'http://dest.com/file1.jpg',
        size: 2000,
        contentType: 'image/jpeg',
      });

      const result = await verifySyncedFile('file1', source, destination);

      expect(result.matched).toBe(false);
      expect(result.differences).toContain('Size mismatch: 1000 bytes != 2000 bytes');
    });

    it('should detect content type mismatches', async () => {
      source.addFile({
        external_id: 'file1',
        key: 'uploads/file1.jpg',
        url: 'http://source.com/file1.jpg',
        size: 1000,
        contentType: 'image/jpeg',
      });
      destination.addFile({
        external_id: 'file1',
        key: 'uploads/file1.jpg',
        url: 'http://dest.com/file1.jpg',
        size: 1000,
        contentType: 'image/png',
      });

      const result = await verifySyncedFile('file1', source, destination);

      expect(result.matched).toBe(false);
      expect(result.differences.some(d => d.includes('ContentType mismatch'))).toBe(true);
    });

    it('should detect metadata mismatches', async () => {
      source.addFile({
        external_id: 'file1',
        key: 'uploads/file1.jpg',
        url: 'http://source.com/file1.jpg',
        size: 1000,
        contentType: 'image/jpeg',
        metadata: { userId: '123' },
      });
      destination.addFile({
        external_id: 'file1',
        key: 'uploads/file1.jpg',
        url: 'http://dest.com/file1.jpg',
        size: 1000,
        contentType: 'image/jpeg',
        metadata: { userId: '456' },
      });

      const result = await verifySyncedFile('file1', source, destination);

      expect(result.matched).toBe(false);
      expect(result.differences.some(d => d.includes('Metadata'))).toBe(true);
    });

    it('should return error when file not found', async () => {
      const result = await verifySyncedFile('nonexistent', source, destination);

      expect(result.matched).toBe(false);
      expect(result.differences).toContain('File not found in one or both providers');
    });
  });

  describe('getSyncStatus', () => {
    it('should report files only in source', async () => {
      source.addFile({
        external_id: 'file1',
        key: 'uploads/file1.jpg',
        url: 'http://source.com/file1.jpg',
        size: 1000,
        contentType: 'image/jpeg',
      });

      const status = await getSyncStatus(source, destination);

      expect(status.sourceFiles).toBe(1);
      expect(status.destFiles).toBe(0);
      expect(status.sourceOnly).toBe(1);
      expect(status.destOnly).toBe(0);
      expect(status.inBoth).toBe(0);
      expect(status.conflicts).toBe(0);
    });

    it('should report files only in destination', async () => {
      destination.addFile({
        external_id: 'file1',
        key: 'uploads/file1.jpg',
        url: 'http://dest.com/file1.jpg',
        size: 1000,
        contentType: 'image/jpeg',
      });

      const status = await getSyncStatus(source, destination);

      expect(status.sourceFiles).toBe(0);
      expect(status.destFiles).toBe(1);
      expect(status.sourceOnly).toBe(0);
      expect(status.destOnly).toBe(1);
      expect(status.inBoth).toBe(0);
      expect(status.conflicts).toBe(0);
    });

    it('should report files in both without conflicts', async () => {
      const file: StorageFileInfo = {
        external_id: 'file1',
        key: 'uploads/file1.jpg',
        url: 'http://example.com/file1.jpg',
        size: 1000,
        contentType: 'image/jpeg',
        lastModified: new Date('2025-01-01'),
      };

      source.addFile(file);
      destination.addFile({ ...file });

      const status = await getSyncStatus(source, destination);

      expect(status.sourceFiles).toBe(1);
      expect(status.destFiles).toBe(1);
      expect(status.sourceOnly).toBe(0);
      expect(status.destOnly).toBe(0);
      expect(status.inBoth).toBe(1);
      expect(status.conflicts).toBe(0);
    });

    it('should detect conflicts (different sizes)', async () => {
      source.addFile({
        external_id: 'file1',
        key: 'uploads/file1.jpg',
        url: 'http://source.com/file1.jpg',
        size: 1000,
        contentType: 'image/jpeg',
        lastModified: new Date('2025-01-01'),
      });
      destination.addFile({
        external_id: 'file1',
        key: 'uploads/file1.jpg',
        url: 'http://dest.com/file1.jpg',
        size: 2000,
        contentType: 'image/jpeg',
        lastModified: new Date('2025-01-01'),
      });

      const status = await getSyncStatus(source, destination);

      expect(status.inBoth).toBe(1);
      expect(status.conflicts).toBe(1);
      expect(status.conflictDetails.length).toBe(1);
      expect(status.conflictDetails[0].external_id).toBe('file1');
      expect(status.conflictDetails[0].sourceSize).toBe(1000);
      expect(status.conflictDetails[0].destSize).toBe(2000);
    });

    it('should detect conflicts (different timestamps)', async () => {
      source.addFile({
        external_id: 'file1',
        key: 'uploads/file1.jpg',
        url: 'http://source.com/file1.jpg',
        size: 1000,
        contentType: 'image/jpeg',
        lastModified: new Date('2025-01-01'),
      });
      destination.addFile({
        external_id: 'file1',
        key: 'uploads/file1.jpg',
        url: 'http://dest.com/file1.jpg',
        size: 1000,
        contentType: 'image/jpeg',
        lastModified: new Date('2025-01-02'),
      });

      const status = await getSyncStatus(source, destination);

      expect(status.conflicts).toBe(1);
      expect(status.conflictDetails[0].sourceModified).toEqual(new Date('2025-01-01'));
      expect(status.conflictDetails[0].destModified).toEqual(new Date('2025-01-02'));
    });

    it('should respect filter options', async () => {
      source.addFile({
        external_id: 'image1',
        key: 'uploads/image1.jpg',
        url: 'http://source.com/image1.jpg',
        size: 1000,
        contentType: 'image/jpeg',
      });
      source.addFile({
        external_id: 'doc1',
        key: 'uploads/doc1.pdf',
        url: 'http://source.com/doc1.pdf',
        size: 2000,
        contentType: 'application/pdf',
      });

      const status = await getSyncStatus(source, destination, {
        contentTypePrefix: 'image/',
      });

      expect(status.sourceFiles).toBe(1);
      expect(status.sourceOnly).toBe(1);
    });
  });
});
