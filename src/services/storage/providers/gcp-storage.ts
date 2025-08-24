import { StorageProvider, StorageUploadOptions, StorageUploadResult, StorageFileInfo , ListFilesOptions, ListFilesResult, SearchFilesOptions, SearchFilesResult, FileVisibilityResult, FileVisibilityStatus } from '../types';

export interface GCPStorageConfig {
  projectId: string;
  keyFilename?: string; // Path to service account key file
  credentials?: any; // Service account credentials object
  bucket: string;
  cdnUrl?: string; // CDN endpoint for public URLs
}

export class GCPStorageProvider implements StorageProvider {
  private config: GCPStorageConfig;
  private storage: any;
  private bucket: any;

  constructor(config: GCPStorageConfig) {
    this.config = config;
  }

  private async initializeStorage() {
    try {
      // Dynamic import with error handling
      const { Storage } = await import('@google-cloud/storage');
      
      const storageOptions: any = {
        projectId: this.config.projectId,
      };

      if (this.config.keyFilename) {
        storageOptions.keyFilename = this.config.keyFilename;
      } else if (this.config.credentials) {
        storageOptions.credentials = this.config.credentials;
      }

      this.storage = new Storage(storageOptions);
      this.bucket = this.storage.bucket(this.config.bucket);
    } catch (error) {
      if ((error as any).code === 'MODULE_NOT_FOUND') {
        throw new Error(
          'Google Cloud Storage package not found. Please install it with:\n' +
          'npm install @google-cloud/storage\n' +
          'or\n' +
          'yarn add @google-cloud/storage',
        );
      }
      throw error;
    }
  }

  async uploadFile(options: StorageUploadOptions): Promise<StorageUploadResult> {
    await this.ensureInitialized();
    
    const key = options.key || `${Date.now()}-${options.filename || 'file'}`;
    const file = this.bucket.file(key);

    let stream: NodeJS.ReadableStream;
    let size: number | undefined = options.size;

    if (options.filePath) {
      const fs = await import('fs');
      stream = fs.createReadStream(options.filePath);
      if (!size) {
        const stats = await fs.promises.stat(options.filePath);
        size = stats.size;
      }
    } else if (options.stream) {
      stream = options.stream as NodeJS.ReadableStream;
    } else if (options.buffer) {
      const { Readable } = await import('stream');
      stream = Readable.from(options.buffer);
      size = options.buffer.length;
    } else {
      throw new Error('No file source provided');
    }

    const uploadOptions: any = {
      resumable: false,
      metadata: {
        contentType: options.contentType,
        metadata: {
          external_id: options.external_id,
          ...options.metadata,
        },
      },
    };

    if (options.public) {
      uploadOptions.predefinedAcl = 'publicRead';
    }

    return new Promise((resolve, reject) => {
      const uploadStream = file.createWriteStream(uploadOptions);

      uploadStream.on('error', reject);
      uploadStream.on('finish', async () => {
        try {
          const [metadata] = await file.getMetadata();
          const url = await this.getFileUrl(key);

          resolve({
            external_id: options.external_id,
            key,
            url,
            size: size || parseInt(metadata.size),
            contentType: options.contentType || metadata.contentType,
            etag: metadata.etag,
            metadata: options.metadata,
            visibility: options.public ? 'public' : 'private',
            publicUrl: options.public ? `https://storage.googleapis.com/${this.config.bucket}/${key}` : undefined,
          });
        } catch (error) {
          reject(error);
        }
      });

      stream.pipe(uploadStream);
    });
  }

  async deleteFile(key: string): Promise<void> {
    await this.ensureInitialized();
    const file = this.bucket.file(key);
    await file.delete();
  }

  async deleteFileByExternalId(externalId: string): Promise<void> {
    const fileInfo = await this.findFileByExternalId(externalId);
    if (fileInfo) {
      await this.deleteFile(fileInfo.key);
    }
  }

  async getFileUrl(key: string, expiresIn?: number): Promise<string> {
    await this.ensureInitialized();
    
    if (this.config.cdnUrl) {
      return `${this.config.cdnUrl}/${key}`;
    }

    const file = this.bucket.file(key);
    
    if (expiresIn) {
      const [url] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + expiresIn * 1000,
      });
      return url;
    }

    // Check if file is public
    try {
      const [metadata] = await file.getMetadata();
      if (metadata.acl?.some((acl: any) => acl.entity === 'allUsers' && acl.role === 'READER')) {
        return `https://storage.googleapis.com/${this.config.bucket}/${key}`;
      }
    } catch (_error) {
      // Ignore metadata fetch errors, fall back to signed URL
    }

    // Generate signed URL with 1 hour expiry as default
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 3600 * 1000,
    });
    return url;
  }

  async getFileUrlByExternalId(externalId: string, expiresIn?: number): Promise<string> {
    const fileInfo = await this.findFileByExternalId(externalId);
    if (!fileInfo) {
      throw new Error(`File with external_id ${externalId} not found`);
    }
    return this.getFileUrl(fileInfo.key, expiresIn);
  }

  async fileExists(key: string): Promise<boolean> {
    await this.ensureInitialized();
    const file = this.bucket.file(key);
    const [exists] = await file.exists();
    return exists;
  }

  async fileExistsByExternalId(externalId: string): Promise<boolean> {
    const fileInfo = await this.findFileByExternalId(externalId);
    return !!fileInfo;
  }

  async findFileByExternalId(externalId: string): Promise<StorageFileInfo | null> {
    await this.ensureInitialized();
    
    const [files] = await this.bucket.getFiles({
      prefix: '',
    });

    for (const file of files) {
      try {
        const [metadata] = await file.getMetadata();
        if (metadata.metadata?.external_id === externalId) {
          const url = await this.getFileUrl(file.name);
          return {
            external_id: externalId,
            key: file.name,
            url,
            size: parseInt(metadata.size),
            contentType: metadata.contentType,
            lastModified: new Date(metadata.timeCreated),
            etag: metadata.etag,
            metadata: metadata.metadata,
          };
        }
      } catch (_error) {
        // Skip files that can't be accessed
        continue;
      }
    }

    return null;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.storage || !this.bucket) {
      await this.initializeStorage();
    }
  }

  async listFiles(options: ListFilesOptions = {}): Promise<ListFilesResult> {
    await this.ensureInitialized();

    const {
      limit = 100,
      offset = 0,
      continuationToken,
      prefix = '',
      externalIdPrefix,
      contentType,
      minSize,
      maxSize,
      sortBy = 'key',
      sortOrder = 'asc',
    } = options;

    const getFilesOptions: any = {
      prefix: prefix || undefined,
      maxResults: limit + offset + 100, // Get extra files for filtering
      autoPaginate: false,
    };

    if (continuationToken) {
      getFilesOptions.pageToken = continuationToken;
    }

    const allFiles: StorageFileInfo[] = [];
    let nextPageToken: string | undefined;

    try {
      const [files, , apiResponse] = await this.bucket.getFiles(getFilesOptions);
      nextPageToken = apiResponse?.nextPageToken;

      for (const file of files) {
        const [metadata] = await file.getMetadata();

        // Apply filters
        if (externalIdPrefix && !metadata.metadata?.external_id?.startsWith(externalIdPrefix)) {
          continue;
        }

        if (contentType && metadata.contentType !== contentType) {
          continue;
        }

        const fileSize = parseInt(metadata.size) || 0;
        if (minSize !== undefined && fileSize < minSize) {
          continue;
        }

        if (maxSize !== undefined && fileSize > maxSize) {
          continue;
        }

        const url = await this.getFileUrl(file.name);
        const fileInfo: StorageFileInfo = {
          external_id: metadata.metadata?.external_id,
          key: file.name,
          url,
          size: fileSize,
          contentType: metadata.contentType || 'application/octet-stream',
          lastModified: new Date(metadata.timeCreated),
          etag: metadata.etag,
          metadata: metadata.metadata,
        };

        allFiles.push(fileInfo);
      }
    } catch (error) {
      throw new Error(`Failed to list files: ${(error as Error).message}`);
    }

    // Sort files
    allFiles.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortBy) {
        case 'external_id':
          aValue = a.external_id || '';
          bValue = b.external_id || '';
          break;
        case 'size':
          aValue = a.size;
          bValue = b.size;
          break;
        case 'lastModified':
          aValue = a.lastModified?.getTime() || 0;
          bValue = b.lastModified?.getTime() || 0;
          break;
        case 'key':
        default:
          aValue = a.key;
          bValue = b.key;
          break;
      }

      if (sortOrder === 'desc') {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
      return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
    });

    // Apply pagination
    const totalCount = allFiles.length;
    const paginatedFiles = allFiles.slice(offset, offset + limit);
    const hasMore = offset + limit < totalCount || !!nextPageToken;

    return {
      files: paginatedFiles,
      totalCount,
      hasMore,
      nextOffset: hasMore ? offset + limit : undefined,
      continuationToken: nextPageToken,
    };
  }

  async searchFiles(options: SearchFilesOptions): Promise<SearchFilesResult> {
    const startTime = Date.now();
    
    const {
      query = '',
      searchFields = ['external_id', 'filename', 'metadata'],
      caseSensitive = false,
      exactMatch = false,
      limit = 100,
      offset = 0,
      continuationToken,
      externalIdPrefix,
      contentType,
      minSize,
      maxSize,
      sortBy = 'key',
      sortOrder = 'asc',
    } = options;

    // Get all files first, then filter by search criteria
    const listOptions = {
      limit: 1000, // Get more files for searching
      offset: 0,
      continuationToken,
      externalIdPrefix,
      contentType,
      minSize,
      maxSize,
      sortBy,
      sortOrder,
    };

    const listResult = await this.listFiles(listOptions);
    let matchedFiles: StorageFileInfo[] = [];

    if (query) {
      const searchQuery = caseSensitive ? query : query.toLowerCase();
      
      for (const file of listResult.files) {
        let matches = false;

        for (const field of searchFields) {
          let fieldValue = '';

          switch (field) {
            case 'external_id':
              fieldValue = file.external_id || '';
              break;
            case 'filename':
              // Extract filename from key (last part after /)
              fieldValue = file.key.split('/').pop() || '';
              break;
            case 'metadata':
              fieldValue = JSON.stringify(file.metadata || {});
              break;
            case 'contentType':
              fieldValue = file.contentType || '';
              break;
            case 'key':
              fieldValue = file.key;
              break;
          }

          if (!caseSensitive) {
            fieldValue = fieldValue.toLowerCase();
          }

          if (exactMatch) {
            if (fieldValue === searchQuery) {
              matches = true;
              break;
            }
          } else {
            if (fieldValue.includes(searchQuery)) {
              matches = true;
              break;
            }
          }
        }

        if (matches) {
          matchedFiles.push(file);
        }
      }
    } else {
      matchedFiles = listResult.files;
    }

    // Apply pagination to search results
    const totalCount = matchedFiles.length;
    const paginatedFiles = matchedFiles.slice(offset, offset + limit);
    const hasMore = offset + limit < totalCount;
    const searchTime = Date.now() - startTime;

    return {
      files: paginatedFiles,
      totalCount,
      hasMore,
      nextOffset: hasMore ? offset + limit : undefined,
      continuationToken: listResult.continuationToken,
      searchTime,
      query,
    };
  }

  // File visibility management
  async setFileVisibility(key: string, visibility: 'public' | 'private'): Promise<FileVisibilityResult> {
    await this.ensureInitialized();
    
    try {
      const file = this.bucket.file(key);
      
      // Check if file exists
      const [exists] = await file.exists();
      if (!exists) {
        return {
          success: false,
          requestedVisibility: visibility,
          actualVisibility: 'private',
          message: `File with key ${key} not found`,
        };
      }

      if (visibility === 'public') {
        // Add public read permission via ACL
        await file.acl.add({
          entity: 'allUsers',
          role: 'READER',
        });
        
        const publicUrl = `https://storage.googleapis.com/${this.config.bucket}/${key}`;
        
        return {
          success: true,
          requestedVisibility: 'public',
          actualVisibility: 'public',
          publicUrl,
          message: 'File is now publicly accessible via direct URL.',
          providerSpecific: {
            aclApplied: true,
          },
        };
      } else {
        // Remove public access by deleting allUsers ACL entry
        try {
          await file.acl.delete({ entity: 'allUsers' });
        } catch (error) {
          // If ACL doesn't exist, that's fine - file is already private
          if ((error as any).code !== 404) {
            throw error;
          }
        }
        
        return {
          success: true,
          requestedVisibility: 'private',
          actualVisibility: 'private',
          message: 'File is now private and requires authentication.',
        };
      }
    } catch (error) {
      return {
        success: false,
        requestedVisibility: visibility,
        actualVisibility: 'private',
        message: `Failed to change file visibility: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async setFileVisibilityByExternalId(externalId: string, visibility: 'public' | 'private'): Promise<FileVisibilityResult> {
    const fileInfo = await this.findFileByExternalId(externalId);
    if (!fileInfo) {
      return {
        success: false,
        requestedVisibility: visibility,
        actualVisibility: 'private',
        message: `File with external_id ${externalId} not found`,
      };
    }
    
    return this.setFileVisibility(fileInfo.key, visibility);
  }

  async getFileVisibility(key: string): Promise<FileVisibilityStatus> {
    await this.ensureInitialized();
    
    try {
      const file = this.bucket.file(key);
      
      // Check if file exists
      const [exists] = await file.exists();
      if (!exists) {
        throw new Error(`File with key ${key} not found`);
      }

      // Check if file has public read access
      try {
        const [acl] = await file.acl.get();
        const hasPublicAccess = acl.some((entry: any) => 
          entry.entity === 'allUsers' && entry.role === 'READER',
        );
        
        if (hasPublicAccess) {
          const publicUrl = `https://storage.googleapis.com/${this.config.bucket}/${key}`;
          return {
            visibility: 'public',
            publicUrl,
            canMakePublic: true,
            canMakePrivate: true,
            supportsTemporaryAccess: true,
            message: 'File is publicly accessible via direct URL.',
          };
        }
      } catch (_error) {
        // If ACL check fails, assume private
      }

      return {
        visibility: 'private',
        canMakePublic: true,
        canMakePrivate: true,
        supportsTemporaryAccess: true,
        message: 'File is private. Use setFileVisibility to make it public or generate signed URLs for temporary access.',
      };
    } catch (error) {
      throw new Error(`Failed to check file visibility: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getFileVisibilityByExternalId(externalId: string): Promise<FileVisibilityStatus> {
    const fileInfo = await this.findFileByExternalId(externalId);
    if (!fileInfo) {
      throw new Error(`File with external_id ${externalId} not found`);
    }
    
    return this.getFileVisibility(fileInfo.key);
  }
}