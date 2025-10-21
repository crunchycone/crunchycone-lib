import {
  StorageProvider,
  StorageUploadOptions,
  StorageUploadResult,
  StorageFileInfo,
  ListFilesOptions,
  ListFilesResult,
  SearchFilesOptions,
  SearchFilesResult,
  FileVisibilityResult,
  FileVisibilityStatus,
  FileUrlOptions,
  FileStreamOptions,
  FileStreamResult,
} from '../types';
import { createReadStream, createWriteStream, promises as fs } from 'fs';
import { join, dirname, extname } from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

export class LocalStorageProvider implements StorageProvider {
  private basePath: string;
  private baseUrl: string;

  constructor() {
    const envPath = process.env.CRUNCHYCONE_LOCALSTORAGE_PATH;
    if (!envPath) {
      throw new Error('CRUNCHYCONE_LOCALSTORAGE_PATH environment variable is required but not configured');
    }
    
    this.basePath = envPath;
    this.baseUrl = process.env.CRUNCHYCONE_LOCALSTORAGE_BASE_URL || '/localstorage';
    this.baseUrl = this.baseUrl.endsWith('/') ? this.baseUrl.slice(0, -1) : this.baseUrl;
    
    // Ensure the storage directory exists
    this.ensureStorageDirectory();
  }

  private async ensureStorageDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.basePath, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to create storage directory at ${this.basePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async uploadFile(options: StorageUploadOptions): Promise<StorageUploadResult> {
    const inputCount = [options.filePath, options.stream, options.buffer].filter(Boolean).length;
    if (inputCount !== 1) {
      throw new Error('Exactly one of filePath, stream, or buffer must be provided');
    }

    const key = options.key || this.generateKeyFromExternalId(options.external_id, options.filename);
    const fullPath = join(this.basePath, key);
    const metadataPath = `${fullPath}.json`;
    const dirPath = dirname(fullPath);

    await fs.mkdir(dirPath, { recursive: true });

    let contentType = options.contentType || 'application/octet-stream';
    let size = 0;

    try {
      if (options.buffer) {
        await fs.writeFile(fullPath, options.buffer);
        size = options.buffer.length;
      } else if (options.filePath) {
        const stats = await fs.stat(options.filePath);
        size = stats.size;
        
        const readStream = createReadStream(options.filePath);
        const writeStream = createWriteStream(fullPath);
        await pipeline(readStream, writeStream);
      } else if (options.stream) {
        let readableStream: Readable;
        
        if (options.stream instanceof ReadableStream) {
          readableStream = Readable.fromWeb(options.stream as any);
        } else {
          readableStream = options.stream as Readable;
        }

        const writeStream = createWriteStream(fullPath);
        await pipeline(readableStream, writeStream);
        
        const stats = await fs.stat(fullPath);
        size = stats.size;
      } else {
        throw new Error('No valid input source provided');
      }

      if (!options.contentType && options.filename) {
        contentType = this.getContentTypeFromFilename(options.filename);
      } else if (!options.contentType) {
        contentType = this.getContentTypeFromFilename(key);
      }

      const url = `${this.baseUrl}/${key}`;

      const metadata = {
        external_id: options.external_id,
        key,
        filename: options.filename,
        contentType,
        size,
        lastModified: new Date().toISOString(),
        url,
        metadata: options.metadata,
      };

      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

      return {
        external_id: options.external_id,
        key,
        url,
        size,
        contentType,
        metadata: options.metadata,
        visibility: 'private', // Always private - public access handled by web server
        publicUrl: options.public ? url : undefined,
      };
    } catch (error) {
      try {
        await fs.unlink(fullPath);
        await fs.unlink(metadataPath);
      } catch {
        // Ignore cleanup errors
      }
      throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteFile(key: string): Promise<void> {
    const fullPath = join(this.basePath, key);
    const metadataPath = `${fullPath}.json`;
    
    try {
      await fs.unlink(fullPath);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw new Error(`Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    try {
      await fs.unlink(metadataPath);
    } catch {
      // Ignore metadata file cleanup errors
    }
  }

  async deleteFileByExternalId(externalId: string): Promise<void> {
    const fileInfo = await this.findFileByExternalId(externalId);
    if (!fileInfo) {
      throw new Error(`File with external_id "${externalId}" not found`);
    }
    
    await this.deleteFile(fileInfo.key);
  }

  async getFileUrl(key: string, _expiresIn?: number, _options?: FileUrlOptions): Promise<string> {
    // LocalStorage doesn't support content disposition control - URLs always depend on browser behavior
    return `${this.baseUrl}/${key}`;
  }

  async getFileUrlByExternalId(externalId: string, expiresIn?: number, options?: FileUrlOptions): Promise<string> {
    const fileInfo = await this.findFileByExternalId(externalId);
    if (!fileInfo) {
      throw new Error(`File with external_id "${externalId}" not found`);
    }

    return this.getFileUrl(fileInfo.key, expiresIn, options);
  }

  async getFileStream(key: string, _options?: FileStreamOptions): Promise<FileStreamResult> {
    const fullPath = join(this.basePath, key);

    // Check if file exists
    try {
      const stats = await fs.stat(fullPath);

      // Create a ReadableStream from the file
      const nodeStream = createReadStream(fullPath);

      // Convert Node.js Readable to Web ReadableStream
      const webStream = Readable.toWeb(nodeStream) as ReadableStream;

      // Get metadata
      const metadataPath = `${fullPath}.json`;
      let contentType = 'application/octet-stream';
      let lastModified: Date | undefined;
      let etag: string | undefined;

      try {
        const metadataContent = await fs.readFile(metadataPath, 'utf-8');
        const metadata = JSON.parse(metadataContent);
        contentType = metadata.contentType || contentType;
        if (metadata.lastModified) {
          lastModified = new Date(metadata.lastModified);
        }
        etag = metadata.etag;
      } catch {
        // Metadata file doesn't exist, use default content type
        lastModified = new Date(stats.mtime);
      }

      return {
        stream: webStream,
        contentType,
        contentLength: stats.size,
        isPartialContent: false,
        streamType: 'web' as const,
        acceptsRanges: false,
        lastModified,
        etag,
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`File not found: ${key}`);
      }
      throw error;
    }
  }

  async getFileStreamByExternalId(externalId: string, options?: FileStreamOptions): Promise<FileStreamResult> {
    const fileInfo = await this.findFileByExternalId(externalId);
    if (!fileInfo) {
      throw new Error(`File with external_id "${externalId}" not found`);
    }

    return this.getFileStream(fileInfo.key, options);
  }

  async fileExists(key: string): Promise<boolean> {
    const fullPath = join(this.basePath, key);
    
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  async fileExistsByExternalId(externalId: string): Promise<boolean> {
    const fileInfo = await this.findFileByExternalId(externalId);
    return fileInfo !== null;
  }

  async findFileByExternalId(externalId: string): Promise<StorageFileInfo | null> {
    try {
      const files = await this.getAllMetadataFiles();
      
      for (const metadataFile of files) {
        try {
          const metadataContent = await fs.readFile(metadataFile, 'utf-8');
          const metadata = JSON.parse(metadataContent);
          
          if (metadata.external_id === externalId) {
            const fileExists = await this.fileExists(metadata.key);
            if (!fileExists) {
              await fs.unlink(metadataFile);
              return null;
            }
            
            return {
              external_id: metadata.external_id,
              key: metadata.key,
              url: metadata.url,
              size: metadata.size,
              contentType: metadata.contentType,
              lastModified: new Date(metadata.lastModified),
              metadata: metadata.metadata,
              visibility: 'private', // Always private on disk
              publicUrl: metadata.visibility === 'public' ? metadata.url : undefined,
            };
          }
        } catch {
          // Skip invalid metadata files
          continue;
        }
      }
      
      return null;
    } catch {
      return null;
    }
  }

  async listFiles(options: ListFilesOptions = {}): Promise<ListFilesResult> {
    const startTime = Date.now();
    
    try {
      const metadataFiles = await this.getAllMetadataFiles();
      const allFiles: StorageFileInfo[] = [];
      
      // Load all file metadata
      for (const metadataFile of metadataFiles) {
        try {
          const metadataContent = await fs.readFile(metadataFile, 'utf-8');
          const metadata = JSON.parse(metadataContent);
          
          // Verify file still exists
          const fileExists = await this.fileExists(metadata.key);
          if (!fileExists) {
            await fs.unlink(metadataFile).catch(() => {}); // Clean up orphaned metadata
            continue;
          }
          
          const fileInfo: StorageFileInfo = {
            external_id: metadata.external_id,
            key: metadata.key,
            url: options.includeUrls !== false ? metadata.url : '',
            size: metadata.size,
            contentType: metadata.contentType,
            lastModified: new Date(metadata.lastModified),
            metadata: options.includeMetadata !== false ? metadata.metadata : undefined,
            visibility: 'private', // Always private on disk
            publicUrl: metadata.visibility === 'public' ? metadata.url : undefined,
          };
          
          allFiles.push(fileInfo);
        } catch {
          // Skip invalid metadata files
          continue;
        }
      }
      
      // Apply filters
      let filteredFiles = this.applyFilters(allFiles, options);
      
      // Apply sorting
      if (options.sortBy) {
        filteredFiles = this.applySorting(filteredFiles, options.sortBy, options.sortOrder || 'asc');
      }
      
      // Apply pagination
      const offset = options.offset || 0;
      const limit = Math.min(options.limit || 100, 1000); // Cap at 1000
      const totalCount = filteredFiles.length;
      const paginatedFiles = filteredFiles.slice(offset, offset + limit);
      const hasMore = offset + limit < totalCount;
      
      return {
        files: paginatedFiles,
        totalCount,
        hasMore,
        nextOffset: hasMore ? offset + limit : undefined,
        searchTime: Date.now() - startTime,
      };
    } catch (error) {
      throw new Error(`Failed to list files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async searchFiles(options: SearchFilesOptions): Promise<SearchFilesResult> {
    const startTime = Date.now();
    
    try {
      const metadataFiles = await this.getAllMetadataFiles();
      const allFiles: StorageFileInfo[] = [];
      
      // Load all file metadata
      for (const metadataFile of metadataFiles) {
        try {
          const metadataContent = await fs.readFile(metadataFile, 'utf-8');
          const metadata = JSON.parse(metadataContent);
          
          // Verify file still exists
          const fileExists = await this.fileExists(metadata.key);
          if (!fileExists) {
            await fs.unlink(metadataFile).catch(() => {}); // Clean up orphaned metadata
            continue;
          }
          
          const fileInfo: StorageFileInfo = {
            external_id: metadata.external_id,
            key: metadata.key,
            url: options.includeUrls !== false ? metadata.url : '',
            size: metadata.size,
            contentType: metadata.contentType,
            lastModified: new Date(metadata.lastModified),
            metadata: options.includeMetadata !== false ? metadata.metadata : undefined,
            visibility: 'private', // Always private on disk
            publicUrl: metadata.visibility === 'public' ? metadata.url : undefined,
          };
          
          allFiles.push(fileInfo);
        } catch {
          continue;
        }
      }
      
      // Apply search filters
      let searchResults = this.applySearchFilters(allFiles, options);
      
      // Apply additional filters from ListFilesOptions
      searchResults = this.applyFilters(searchResults, options);
      
      // Apply sorting (search doesn't have relevance scoring for LocalStorage)
      if (options.sortBy) {
        searchResults = this.applySorting(searchResults, options.sortBy, options.sortOrder || 'asc');
      }
      
      // Apply pagination
      const offset = options.offset || 0;
      const limit = Math.min(options.limit || 100, 1000);
      const totalCount = searchResults.length;
      const paginatedFiles = searchResults.slice(offset, offset + limit);
      const hasMore = offset + limit < totalCount;
      
      return {
        files: paginatedFiles,
        totalCount,
        hasMore,
        nextOffset: hasMore ? offset + limit : undefined,
        query: options.query,
        searchFields: options.searchFields,
        searchTime: Date.now() - startTime,
      };
    } catch (error) {
      throw new Error(`Failed to search files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private applyFilters(files: StorageFileInfo[], options: ListFilesOptions): StorageFileInfo[] {
    return files.filter(file => {
      // Key prefix filter (most efficient)
      if (options.prefix && !file.key.startsWith(options.prefix)) {
        return false;
      }
      
      // Key pattern filter
      if (options.keyPattern && !this.matchesPattern(file.key, options.keyPattern)) {
        return false;
      }
      
      // External ID filters
      if (options.externalIdPrefix && !file.external_id.startsWith(options.externalIdPrefix)) {
        return false;
      }
      
      if (options.externalIdPattern && !this.matchesPattern(file.external_id, options.externalIdPattern)) {
        return false;
      }
      
      if (options.externalIds && !options.externalIds.includes(file.external_id)) {
        return false;
      }
      
      // Content type filters
      if (options.contentType && file.contentType !== options.contentType) {
        return false;
      }
      
      if (options.contentTypePrefix && !file.contentType.startsWith(options.contentTypePrefix)) {
        return false;
      }
      
      // Filename filters
      if (options.filename) {
        const filename = this.extractFilenameFromKey(file.key);
        if (!filename.toLowerCase().includes(options.filename.toLowerCase())) {
          return false;
        }
      }
      
      if (options.filenamePattern) {
        const filename = this.extractFilenameFromKey(file.key);
        if (!this.matchesPattern(filename, options.filenamePattern)) {
          return false;
        }
      }
      
      // Size filters
      if (options.minSize && file.size < options.minSize) {
        return false;
      }
      
      if (options.maxSize && file.size > options.maxSize) {
        return false;
      }
      
      // Date filters
      if (options.createdAfter && file.lastModified && file.lastModified < options.createdAfter) {
        return false;
      }
      
      if (options.createdBefore && file.lastModified && file.lastModified > options.createdBefore) {
        return false;
      }
      
      if (options.modifiedAfter && file.lastModified && file.lastModified < options.modifiedAfter) {
        return false;
      }
      
      if (options.modifiedBefore && file.lastModified && file.lastModified > options.modifiedBefore) {
        return false;
      }
      
      // Metadata filters
      if (options.metadata && file.metadata) {
        for (const [key, value] of Object.entries(options.metadata)) {
          if (file.metadata[key] !== value) {
            return false;
          }
        }
      }
      
      if (options.hasMetadata && file.metadata) {
        for (const key of options.hasMetadata) {
          if (!(key in file.metadata)) {
            return false;
          }
        }
      }
      
      return true;
    });
  }

  private applySearchFilters(files: StorageFileInfo[], options: SearchFilesOptions): StorageFileInfo[] {
    if (!options.query) {
      return files;
    }
    
    const query = options.caseSensitive ? options.query : options.query.toLowerCase();
    const searchFields = options.searchFields || ['external_id', 'filename', 'metadata', 'contentType'];
    
    return files.filter(file => {
      for (const field of searchFields) {
        let searchText = '';
        
        switch (field) {
          case 'external_id':
            searchText = file.external_id;
            break;
          case 'filename':
            searchText = this.extractFilenameFromKey(file.key);
            break;
          case 'contentType':
            searchText = file.contentType;
            break;
          case 'key':
            searchText = file.key;
            break;
          case 'metadata':
            if (file.metadata) {
              searchText = JSON.stringify(file.metadata);
            }
            break;
        }
        
        if (!options.caseSensitive) {
          searchText = searchText.toLowerCase();
        }
        
        const matches = options.exactMatch 
          ? searchText === query
          : searchText.includes(query);
          
        if (matches) {
          return true;
        }
      }
      
      return false;
    });
  }

  private applySorting(files: StorageFileInfo[], sortBy: string, sortOrder: 'asc' | 'desc'): StorageFileInfo[] {
    return [...files].sort((a, b) => {
      let valueA: any;
      let valueB: any;
      
      switch (sortBy) {
        case 'key':
          valueA = a.key;
          valueB = b.key;
          break;
        case 'external_id':
          valueA = a.external_id;
          valueB = b.external_id;
          break;
        case 'filename':
          valueA = this.extractFilenameFromKey(a.key);
          valueB = this.extractFilenameFromKey(b.key);
          break;
        case 'size':
          valueA = a.size;
          valueB = b.size;
          break;
        case 'lastModified':
          valueA = a.lastModified?.getTime() || 0;
          valueB = b.lastModified?.getTime() || 0;
          break;
        case 'contentType':
          valueA = a.contentType;
          valueB = b.contentType;
          break;
        default:
          return 0;
      }
      
      if (typeof valueA === 'string' && typeof valueB === 'string') {
        const comparison = valueA.localeCompare(valueB);
        return sortOrder === 'asc' ? comparison : -comparison;
      } else {
        const comparison = valueA < valueB ? -1 : valueA > valueB ? 1 : 0;
        return sortOrder === 'asc' ? comparison : -comparison;
      }
    });
  }

  private matchesPattern(str: string, pattern: string): boolean {
    // Simple glob pattern matching (supports * and ?)
    const regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape regex special characters
      .replace(/\*/g, '.*') // Replace * with .*
      .replace(/\?/g, '.'); // Replace ? with .
    
    return new RegExp(`^${regexPattern}$`, 'i').test(str);
  }

  private extractFilenameFromKey(key: string): string {
    return key.split('/').pop() || key;
  }

  private async getAllMetadataFiles(): Promise<string[]> {
    const metadataFiles: string[] = [];
    
    const scanDirectory = async (dir: string): Promise<void> => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = join(dir, entry.name);
          
          if (entry.isDirectory()) {
            await scanDirectory(fullPath);
          } else if (entry.name.endsWith('.json') && !entry.name.startsWith('.')) {
            metadataFiles.push(fullPath);
          }
        }
      } catch {
        // Skip directories that can't be read
      }
    };
    
    await scanDirectory(this.basePath);
    return metadataFiles;
  }

  private getContentTypeFromFilename(filename: string): string {
    const extension = extname(filename).toLowerCase().slice(1);
    
    const mimeTypes: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'svg': 'image/svg+xml',
      'pdf': 'application/pdf',
      'txt': 'text/plain',
      'html': 'text/html',
      'css': 'text/css',
      'js': 'application/javascript',
      'json': 'application/json',
      'xml': 'application/xml',
      'zip': 'application/zip',
      'mp4': 'video/mp4',
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
    };

    return mimeTypes[extension] || 'application/octet-stream';
  }

  private generateKeyFromExternalId(externalId: string, filename?: string): string {
    const timestamp = Date.now();
    const extension = filename ? extname(filename) : '';
    return `files/${externalId}-${timestamp}${extension}`;
  }

  // File visibility management
  async setFileVisibility(key: string, visibility: 'public' | 'private'): Promise<FileVisibilityResult> {
    // Check if file exists first
    const exists = await this.fileExists(key);
    if (!exists) {
      return {
        success: false,
        requestedVisibility: visibility,
        actualVisibility: 'private',
        message: `File with key ${key} not found`,
      };
    }

    // Update metadata to track visibility preference
    const fullPath = join(this.basePath, key);
    const metadataPath = `${fullPath}.json`;
    
    try {
      const metadataContent = await fs.readFile(metadataPath, 'utf-8');
      const metadata = JSON.parse(metadataContent);
      
      metadata.visibility = visibility;
      metadata.publicUrl = visibility === 'public' ? `${this.baseUrl}/${key}` : undefined;
      
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
      
      return {
        success: true,
        requestedVisibility: visibility,
        actualVisibility: visibility, // Reflect the actual visibility state from metadata
        publicUrl: visibility === 'public' ? `${this.baseUrl}/${key}` : undefined,
        message: visibility === 'public' 
          ? 'File marked as public. Access controlled by web server endpoint routing.'
          : 'File marked as private. Access requires authentication through web server.',
        providerSpecific: {
          diskStorage: true,
          webServerControlled: true,
        },
      };
    } catch (error) {
      return {
        success: false,
        requestedVisibility: visibility,
        actualVisibility: 'private',
        message: `Failed to update file visibility metadata: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
    // Check if file exists first
    const exists = await this.fileExists(key);
    if (!exists) {
      throw new Error(`File with key ${key} not found`);
    }

    const fullPath = join(this.basePath, key);
    const metadataPath = `${fullPath}.json`;
    
    try {
      const metadataContent = await fs.readFile(metadataPath, 'utf-8');
      const metadata = JSON.parse(metadataContent);
      
      const isPublic = metadata.visibility === 'public';
      
      return {
        visibility: isPublic ? 'public' : 'private', // Reflect the actual metadata state
        publicUrl: isPublic ? `${this.baseUrl}/${key}` : undefined,
        canMakePublic: true,
        canMakePrivate: true,
        supportsTemporaryAccess: false,
        message: isPublic 
          ? 'File marked as public in metadata. Access controlled by web server endpoint.'
          : 'File is private. Web server will require authentication to access.',
      };
    } catch (_error) {
      // If metadata file doesn't exist or is corrupted, assume private
      return {
        visibility: 'private',
        canMakePublic: true,
        canMakePrivate: true,
        supportsTemporaryAccess: false,
        message: 'File is private. No visibility metadata found - web server will require authentication.',
      };
    }
  }

  async getFileVisibilityByExternalId(externalId: string): Promise<FileVisibilityStatus> {
    const fileInfo = await this.findFileByExternalId(externalId);
    if (!fileInfo) {
      throw new Error(`File with external_id ${externalId} not found`);
    }
    
    return this.getFileVisibility(fileInfo.key);
  }

  async isAvailable(): Promise<boolean> {
    return true; // Local storage has no optional dependencies
  }
}