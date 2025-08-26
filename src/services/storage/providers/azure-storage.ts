import { StorageProvider, StorageUploadOptions, StorageUploadResult, StorageFileInfo , ListFilesOptions, ListFilesResult, SearchFilesOptions, SearchFilesResult, FileVisibilityResult, FileVisibilityStatus } from '../types';

export interface AzureStorageConfig {
  accountName: string;
  accountKey?: string;
  sasToken?: string;
  connectionString?: string;
  containerName: string;
  cdnUrl?: string; // CDN endpoint for public URLs
}

export class AzureStorageProvider implements StorageProvider {
  private config: AzureStorageConfig;
  private blobServiceClient: any;
  private containerClient: any;

  constructor(config: AzureStorageConfig) {
    this.config = config;
  }

  private async initializeStorage() {
    try {
      // Dynamic import with error handling
      const azurePackage = '@azure/storage-blob'.split('').join('');
      const { BlobServiceClient, StorageSharedKeyCredential } = await import(azurePackage);
      
      if (this.config.connectionString) {
        this.blobServiceClient = BlobServiceClient.fromConnectionString(this.config.connectionString);
      } else if (this.config.accountKey) {
        const credential = new StorageSharedKeyCredential(this.config.accountName, this.config.accountKey);
        this.blobServiceClient = new BlobServiceClient(
          `https://${this.config.accountName}.blob.core.windows.net`,
          credential,
        );
      } else if (this.config.sasToken) {
        this.blobServiceClient = new BlobServiceClient(
          `https://${this.config.accountName}.blob.core.windows.net${this.config.sasToken}`,
        );
      } else {
        throw new Error('Azure Storage requires either connectionString, accountKey, or sasToken');
      }

      this.containerClient = this.blobServiceClient.getContainerClient(this.config.containerName);
    } catch (error) {
      if ((error as any).code === 'MODULE_NOT_FOUND') {
        throw new Error(
          'Azure Storage package not found. Please install it with:\n' +
          'npm install @azure/storage-blob\n' +
          'or\n' +
          'yarn add @azure/storage-blob',
        );
      }
      throw error;
    }
  }

  async uploadFile(options: StorageUploadOptions): Promise<StorageUploadResult> {
    await this.ensureInitialized();
    
    const key = options.key || `${Date.now()}-${options.filename || 'file'}`;
    const blockBlobClient = this.containerClient.getBlockBlobClient(key);

    let data: Buffer | NodeJS.ReadableStream;
    let size: number | undefined = options.size;

    if (options.filePath) {
      const fs = await import('fs');
      data = fs.createReadStream(options.filePath);
      if (!size) {
        const stats = await fs.promises.stat(options.filePath);
        size = stats.size;
      }
    } else if (options.stream) {
      data = options.stream as NodeJS.ReadableStream;
    } else if (options.buffer) {
      data = options.buffer;
      size = options.buffer.length;
    } else {
      throw new Error('No file source provided');
    }

    const uploadOptions: any = {
      blobHTTPHeaders: {
        blobContentType: options.contentType,
      },
      metadata: {
        external_id: options.external_id,
        ...options.metadata,
      },
    };

    let response: any;
    if (data instanceof Buffer) {
      response = await blockBlobClient.upload(data, data.length, uploadOptions);
    } else {
      response = await blockBlobClient.uploadStream(data, size, 5, uploadOptions);
    }

    const url = await this.getFileUrl(key);

    return {
      external_id: options.external_id,
      key,
      url,
      size: size || 0,
      contentType: options.contentType || 'application/octet-stream',
      etag: response.etag,
      metadata: options.metadata,
      visibility: options.public ? 'temporary-public' : 'private',
      publicUrl: options.public ? url : undefined,
    };
  }

  async deleteFile(key: string): Promise<void> {
    await this.ensureInitialized();
    const blockBlobClient = this.containerClient.getBlockBlobClient(key);
    await blockBlobClient.delete();
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

    const blockBlobClient = this.containerClient.getBlockBlobClient(key);
    
    if (expiresIn) {
      // Generate SAS URL with expiry
      try {
        const azurePackage = '@azure/storage-blob'.split('').join('');
        const { generateBlobSASQueryParameters, BlobSASPermissions } = await import(azurePackage);
        
        if (this.config.accountKey) {
          const { StorageSharedKeyCredential } = await import(azurePackage);
          const credential = new StorageSharedKeyCredential(this.config.accountName, this.config.accountKey);
          
          const sasOptions = {
            containerName: this.config.containerName,
            blobName: key,
            permissions: BlobSASPermissions.parse('r'),
            startsOn: new Date(),
            expiresOn: new Date(Date.now() + expiresIn * 1000),
          };
          
          const sasToken = generateBlobSASQueryParameters(sasOptions, credential).toString();
          return `${blockBlobClient.url}?${sasToken}`;
        }
      } catch (_error) {
        // Fall back to direct URL if SAS generation fails
      }
    }

    // Return direct URL (works for public containers or when using SAS token in config)
    return blockBlobClient.url;
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
    const blockBlobClient = this.containerClient.getBlockBlobClient(key);
    try {
      await blockBlobClient.getProperties();
      return true;
    } catch (error) {
      if ((error as any).statusCode === 404) {
        return false;
      }
      throw error;
    }
  }

  async fileExistsByExternalId(externalId: string): Promise<boolean> {
    const fileInfo = await this.findFileByExternalId(externalId);
    return !!fileInfo;
  }

  async findFileByExternalId(externalId: string): Promise<StorageFileInfo | null> {
    await this.ensureInitialized();
    
    for await (const blob of this.containerClient.listBlobsFlat({ 
      includeMetadata: true, 
    })) {
      if (blob.metadata?.external_id === externalId) {
        const url = await this.getFileUrl(blob.name);
        return {
          external_id: externalId,
          key: blob.name,
          url,
          size: blob.properties.contentLength || 0,
          contentType: blob.properties.contentType || 'application/octet-stream',
          lastModified: blob.properties.lastModified,
          etag: blob.properties.etag,
          metadata: blob.metadata,
        };
      }
    }

    return null;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.blobServiceClient || !this.containerClient) {
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

    const listOptions: any = {
      includeMetadata: true,
      prefix: prefix || undefined,
    };

    if (continuationToken) {
      listOptions.continuationToken = continuationToken;
    }

    const allFiles: StorageFileInfo[] = [];
    let nextContinuationToken: string | undefined;

    try {
      const listResponse = this.containerClient.listBlobsFlat(listOptions);
      
      for await (const blob of listResponse.byPage({ maxPageSize: limit + offset + 100 })) {
        nextContinuationToken = blob.continuationToken;
        
        for (const blobItem of blob.segment.blobItems) {
          // Apply filters
          if (externalIdPrefix && !blobItem.metadata?.external_id?.startsWith(externalIdPrefix)) {
            continue;
          }

          if (contentType && blobItem.properties.contentType !== contentType) {
            continue;
          }

          const fileSize = blobItem.properties.contentLength || 0;
          if (minSize !== undefined && fileSize < minSize) {
            continue;
          }

          if (maxSize !== undefined && fileSize > maxSize) {
            continue;
          }

          const url = await this.getFileUrl(blobItem.name);
          const fileInfo: StorageFileInfo = {
            external_id: blobItem.metadata?.external_id,
            key: blobItem.name,
            url,
            size: fileSize,
            contentType: blobItem.properties.contentType || 'application/octet-stream',
            lastModified: blobItem.properties.lastModified,
            etag: blobItem.properties.etag,
            metadata: blobItem.metadata,
          };

          allFiles.push(fileInfo);
        }

        // Break if we have enough files for pagination
        if (allFiles.length >= limit + offset) {
          break;
        }
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
    const hasMore = offset + limit < totalCount || !!nextContinuationToken;

    return {
      files: paginatedFiles,
      totalCount,
      hasMore,
      nextOffset: hasMore ? offset + limit : undefined,
      continuationToken: nextContinuationToken,
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
    
    if (visibility === 'public') {
      // Azure Blob Storage doesn't support individual blob permissions
      // Generate SAS token with long expiry (1 year) as workaround
      try {
        const sasUrl = await this.generateSASToken(key, 365 * 24 * 60 * 60); // 1 year
        
        return {
          success: true,
          requestedVisibility: 'public',
          actualVisibility: 'temporary-public',
          publicUrl: sasUrl,
          publicUrlExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          message: 'Azure Blob Storage uses SAS tokens for public access. Token valid for 1 year and can be regenerated.',
          providerSpecific: {
            sasToken: sasUrl.split('?')[1],
            expirationExtensible: true,
          },
        };
      } catch (error) {
        return {
          success: false,
          requestedVisibility: 'public',
          actualVisibility: 'private',
          message: `Failed to generate SAS token: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    } else {
      // For private visibility, we just indicate it's private
      // (SAS tokens will expire naturally)
      return {
        success: true,
        requestedVisibility: 'private',
        actualVisibility: 'private',
        message: 'File is private. Access requires authentication or valid SAS token.',
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
    
    // Check if file exists
    const exists = await this.fileExists(key);
    if (!exists) {
      throw new Error(`File with key ${key} not found`);
    }

    // Azure doesn't support individual blob permissions, so files are always private
    // unless accessed via SAS token
    return {
      visibility: 'private',
      canMakePublic: true,
      canMakePrivate: true,
      supportsTemporaryAccess: true,
      message: 'Azure Blob Storage requires SAS tokens for public access. Use setFileVisibility to generate temporary public URLs.',
    };
  }

  async getFileVisibilityByExternalId(externalId: string): Promise<FileVisibilityStatus> {
    const fileInfo = await this.findFileByExternalId(externalId);
    if (!fileInfo) {
      throw new Error(`File with external_id ${externalId} not found`);
    }
    
    return this.getFileVisibility(fileInfo.key);
  }

  private async generateSASToken(key: string, expiresInSeconds: number): Promise<string> {
    try {
      const azurePackage = '@azure/storage-blob'.split('').join('');
      const { generateBlobSASQueryParameters, BlobSASPermissions } = await import(azurePackage);
      
      if (!this.config.accountKey) {
        throw new Error('Account key required for SAS token generation');
      }

      const { StorageSharedKeyCredential } = await import(azurePackage);
      const credential = new StorageSharedKeyCredential(this.config.accountName, this.config.accountKey);
      
      const blockBlobClient = this.containerClient.getBlockBlobClient(key);
      
      const sasOptions = {
        containerName: this.config.containerName,
        blobName: key,
        permissions: BlobSASPermissions.parse('r'), // Read permission
        startsOn: new Date(),
        expiresOn: new Date(Date.now() + expiresInSeconds * 1000),
      };
      
      const sasToken = generateBlobSASQueryParameters(sasOptions, credential).toString();
      return `${blockBlobClient.url}?${sasToken}`;
    } catch (error) {
      throw new Error(`Failed to generate SAS token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const azurePackage = '@azure/storage-blob'.split('').join('');
      await import(azurePackage);
      return true;
    } catch {
      return false;
    }
  }
}