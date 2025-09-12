import { StorageProvider, StorageUploadOptions, StorageUploadResult, StorageFileInfo, ListFilesOptions, ListFilesResult, SearchFilesOptions, SearchFilesResult, FileVisibilityResult, FileVisibilityStatus, FileStreamOptions, FileStreamResult, FileUrlOptions } from '../types';
import { getCrunchyConeAPIKeyWithFallback, getCrunchyConeAPIURL, getCrunchyConeProjectID } from '../../../auth';

export interface CrunchyConeConfig {
  apiUrl: string;              // API endpoint (e.g., https://api.crunchycone.com)
  apiKey: string;              // API key for authentication
  projectId: string;           // Project ID for file organization
  userId?: string;             // User ID (can be set later via setUserId)
  timeout?: number;            // Request timeout in milliseconds (default: 30000)
}

export interface CrunchyConeFileDescriptor {
  file_id: string;
  upload_url: string;
  expires_at: string;
}

export interface CrunchyConeFileMetadata {
  file_id: string;
  user_id: string;
  project_id: string;
  file_path: string;
  original_filename: string;
  content_type: string;
  expected_file_size: number;
  actual_file_size: number;
  storage_key: string;
  upload_status: 'pending' | 'uploading' | 'completed' | 'failed';
  external_id?: string;
  metadata: Record<string, string>;
  created_at: string;
  updated_at: string;
  uploaded_at?: string;
}

export class CrunchyConeProvider implements StorageProvider {
  private config!: CrunchyConeConfig;
  private userId?: string;
  private configPromise: Promise<void>;

  constructor(config?: Partial<CrunchyConeConfig>) {
    // Initialize config asynchronously
    this.configPromise = this.initializeConfig(config);
  }

  private async initializeConfig(config?: Partial<CrunchyConeConfig>): Promise<void> {
    let apiKey: string;
    let projectId: string;
    
    if (config?.apiKey) {
      apiKey = config.apiKey;
    } else {
      // Use the auth utility to get API key from env or keychain
      apiKey = await getCrunchyConeAPIKeyWithFallback();
    }

    const apiUrl = config?.apiUrl || getCrunchyConeAPIURL();
    
    if (config?.projectId) {
      projectId = config.projectId;
    } else {
      const envProjectId = getCrunchyConeProjectID();
      if (!envProjectId) {
        throw new Error('CrunchyCone project ID is required. Set CRUNCHYCONE_PROJECT_ID environment variable or pass projectId in config.');
      }
      projectId = envProjectId;
    }

    this.config = {
      apiUrl,
      apiKey,
      projectId,
      userId: config?.userId,
      timeout: config?.timeout || 30000,
    };
    
    this.userId = this.config.userId; // Optional - server will determine user from API key
  }

  private async ensureConfigured(): Promise<void> {
    await this.configPromise;
  }

  /**
   * Set the user ID for this provider instance
   */
  setUserId(userId: string): void {
    this.userId = userId;
  }

  private validateUserId(): void {
    // User ID is optional - the server will determine user context from API key
    // This method is kept for compatibility but no longer throws an error
  }

  private async makeRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
    await this.ensureConfigured();
    this.validateUserId();

    const url = `${this.config.apiUrl}${path}`;
    const timeout = this.config.timeout || 30000;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'X-API-Key': this.config.apiKey,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorDetails = '';
        let errorData: any = null;
        
        try {
          const responseText = await response.text();
          errorDetails = responseText;
          
          // Try to parse as JSON for structured error info
          try {
            errorData = JSON.parse(responseText);
          } catch {
            // Not JSON, use raw text
          }
        } catch {
          errorDetails = 'Could not read response body';
        }

        // Build comprehensive error message
        const errorParts = [
          `CrunchyCone API error (${response.status} ${response.statusText})`,
          `URL: ${url}`,
          `Method: ${options.method || 'GET'}`,
        ];

        // Add structured error info if available
        if (errorData && typeof errorData === 'object') {
          if (errorData.error) {
            errorParts.push(`Error: ${errorData.error}`);
          }
          if (errorData.message && errorData.message !== errorData.error) {
            errorParts.push(`Message: ${errorData.message}`);
          }
          if (errorData.details) {
            errorParts.push(`Details: ${JSON.stringify(errorData.details)}`);
          }
        } else if (errorDetails) {
          errorParts.push(`Response: ${errorDetails}`);
        }

        throw new Error(errorParts.join(' | '));
      }

      // Handle 204 No Content responses
      if (response.status === 204) {
        return {} as T;
      }

      return await response.json() as T;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      throw error;
    }
  }

  async uploadFile(options: StorageUploadOptions): Promise<StorageUploadResult> {
    await this.ensureConfigured();
    
    // Validate input - exactly one source should be provided
    const inputCount = [options.filePath, options.stream, options.buffer].filter(Boolean).length;
    if (inputCount !== 1) {
      throw new Error('Exactly one of filePath, stream, or buffer must be provided');
    }

    let fileSize: number;
    let fileData: Buffer | ReadableStream | NodeJS.ReadableStream;
    let contentType = options.contentType || 'application/octet-stream';

    // Handle different input types and determine file size
    if (options.buffer) {
      fileData = options.buffer;
      fileSize = options.buffer.length;
    } else if (options.filePath) {
      const fs = await import('fs');
      const stats = await fs.promises.stat(options.filePath);
      fileSize = stats.size;
      fileData = fs.createReadStream(options.filePath);
    } else if (options.stream) {
      if (!options.size) {
        throw new Error('File size must be provided when uploading from stream');
      }
      fileData = options.stream;
      fileSize = options.size;
    } else {
      throw new Error('No valid input source provided');
    }

    // Infer content type from filename if not provided
    if (!options.contentType && options.filename) {
      contentType = this.getContentTypeFromFilename(options.filename);
    }

    // Generate file path from key or use default pattern
    const filePath = options.key || this.generateDefaultPath(options.external_id, options.filename);

    // Step 1: Create file descriptor with visibility metadata
    const metadata = {
      ...options.metadata || {},
      visibility: options.public ? 'public' : 'private',
    };

    const descriptor = await this.createFileDescriptor({
      file_path: filePath,
      original_filename: options.filename || 'untitled',
      content_type: contentType,
      file_size: fileSize,
      external_id: options.external_id,
      metadata,
    });

    try {
      // Step 2: Upload file content to the presigned URL
      await this.uploadToPresignedUrl(descriptor.upload_url, fileData, contentType, fileSize);

      // Step 3: Complete the upload - REQUIRED BY API
      await this.completeFileUpload(descriptor.file_id, fileSize);

      // Step 4: Get the final file metadata to return complete info
      const fileMetadata = await this.getFileMetadata(descriptor.file_id);

      // Get the actual signed URL for direct file access
      const signedUrl = await this.getSignedUrlFromJson(
        `${this.config.apiUrl}/api/v1/storage/files/${fileMetadata.file_id}/download?returnSignedUrl=true`,
      );

      return {
        external_id: options.external_id,
        key: fileMetadata.storage_key || fileMetadata.file_path || fileMetadata.file_id,
        url: signedUrl, // Return the actual signed URL that gives file content
        size: fileMetadata.actual_file_size,
        contentType: fileMetadata.content_type,
        metadata: fileMetadata.metadata,
        visibility: 'private', // CrunchyCone manages visibility server-side
        publicUrl: options.public ? signedUrl : undefined, // Use same signed URL for public access
      };
    } catch (error) {
      // Enhanced error reporting with detailed context
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const fileName = options.filename || options.external_id || 'unknown';
      
      // Enhanced error reporting with context
      const contextualError = `Upload failed for file "${fileName}": ${errorMessage}`;
      
      // Add additional context if we have file info
      const contextParts = [];
      if (options.external_id) {
        contextParts.push(`external_id: ${options.external_id}`);
      }
      if (filePath) {
        contextParts.push(`file_path: ${filePath}`);
      }
      
      const finalError = contextParts.length > 0 
        ? `${contextualError} (${contextParts.join(', ')})` 
        : contextualError;
      
      // If upload fails, we could optionally clean up the file descriptor
      // For now, we'll let the API handle cleanup of failed uploads
      throw new Error(finalError);
    }
  }

  private async createFileDescriptor(data: {
    file_path: string;
    original_filename: string;
    content_type: string;
    file_size: number;
    external_id: string;
    metadata: Record<string, string>;
  }): Promise<CrunchyConeFileDescriptor> {
    const response = await this.makeRequest<{ data: CrunchyConeFileDescriptor }>('/api/v1/storage/files', {
      method: 'POST',
      body: JSON.stringify({
        project_id: this.config.projectId,
        ...data,
      }),
    });
    return response.data;
  }

  private async uploadToPresignedUrl(
    url: string,
    data: Buffer | ReadableStream | NodeJS.ReadableStream,
    contentType: string,
    contentLength: number,
  ): Promise<void> {
    let body: Buffer | ReadableStream;
    let actualBodySize = 0;

    if (Buffer.isBuffer(data)) {
      body = data;
      actualBodySize = data.length;
    } else if (data instanceof ReadableStream) {
      body = data;
      actualBodySize = contentLength; // Use provided content length for streams
    } else {
      // Node.js ReadableStream - convert to Buffer for fetch
      const chunks: Buffer[] = [];
      for await (const chunk of data as NodeJS.ReadableStream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      body = Buffer.concat(chunks);
      actualBodySize = body.length;
    }

    // Validate content length matches
    if (actualBodySize !== contentLength) {
      throw new Error(`Content-Length mismatch: expected ${contentLength}, got ${actualBodySize}`);
    }

    const response = await fetch(url, {
      method: 'PUT',
      body,
      headers: {
        'Content-Type': contentType,
        'Content-Length': contentLength.toString(),
      },
    });

    if (!response.ok) {
      // Get the response body for detailed error information
      let errorDetails = '';
      try {
        const responseText = await response.text();
        errorDetails = responseText ? ` - Response: ${responseText}` : '';
      } catch {
        errorDetails = ' - Could not read response body';
      }

      // Enhanced error message with key information
      const errorMessage = [
        'Upload to presigned URL failed:',
        `Status: ${response.status} ${response.statusText}`,
        `Content-Type: ${contentType}`,
        `Content-Length: ${contentLength}`,
        errorDetails,
      ].join(' ');

      throw new Error(errorMessage);
    }
  }

  private async completeFileUpload(fileId: string, actualFileSize: number): Promise<void> {
    // Use the /complete endpoint instead of /upload to avoid overwriting file content
    await this.makeRequest(`/api/v1/storage/files/${fileId}/complete`, {
      method: 'POST',
      body: JSON.stringify({
        actual_file_size: actualFileSize,
      }),
    });
  }

  async deleteFile(key: string): Promise<void> {
    // Find file by storage key first
    const fileInfo = await this.findFileByStorageKey(key);
    if (!fileInfo) {
      throw new Error(`File with storage key ${key} not found`);
    }
    
    await this.makeRequest(`/api/v1/storage/files/${fileInfo.file_id}`, {
      method: 'DELETE',
    });
  }

  async deleteFileByExternalId(externalId: string): Promise<void> {
    await this.makeRequest(`/api/v1/storage/files/by-external-id/${encodeURIComponent(externalId)}`, {
      method: 'DELETE',
    });
  }

  async getFileUrl(key: string, _expiresIn: number = 3600, options?: FileUrlOptions): Promise<string> {
    // Find file by storage key first
    const fileInfo = await this.findFileByStorageKey(key);
    if (!fileInfo) {
      throw new Error(`File with storage key ${key} not found`);
    }

    // Build download URL with content disposition support
    const disposition = (options?.disposition === 'inline') ? 'inline' : 'attachment';
    const downloadUrl = `${this.config.apiUrl}/api/v1/storage/files/${fileInfo.file_id}/download?returnSignedUrl=true&disposition=${disposition}`;
    return this.getSignedUrlFromJson(downloadUrl);
  }

  async getFileUrlByExternalId(externalId: string, _expiresIn: number = 3600, options?: FileUrlOptions): Promise<string> {
    // First get the file metadata to extract the file_id
    const response = await this.makeRequest<{ data: CrunchyConeFileMetadata }>(
      `/api/v1/storage/files/by-external-id/${encodeURIComponent(externalId)}`,
    );
    
    // Build download URL with content disposition support
    const disposition = (options?.disposition === 'inline') ? 'inline' : 'attachment';
    const downloadUrl = `${this.config.apiUrl}/api/v1/storage/files/${response.data.file_id}/download?returnSignedUrl=true&disposition=${disposition}`;
    return this.getSignedUrlFromJson(downloadUrl);
  }

  private async getSignedUrlFromJson(downloadUrl: string): Promise<string> {
    const timeout = this.config.timeout || 30000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(downloadUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'X-API-Key': this.config.apiKey,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      // Parse JSON response to get signed URL
      const jsonResponse = await response.json() as { 
        data?: { signedUrl?: string; returnUrl?: string }; 
        signedUrl?: string; 
        returnUrl?: string;
      };
      
      // Handle wrapped response format
      const data = jsonResponse.data || jsonResponse;
      
      // Check for signedUrl or returnUrl
      const signedUrl = data.signedUrl || data.returnUrl;
      
      if (!signedUrl || signedUrl === '') {
        throw new Error(`No valid signed URL found in API response. Got: ${signedUrl}`);
      }
      
      return signedUrl;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      throw error;
    }
  }


  async fileExists(key: string): Promise<boolean> {
    try {
      const fileInfo = await this.findFileByStorageKey(key);
      return fileInfo !== null && fileInfo.upload_status === 'completed';
    } catch (error) {
      // Let configuration errors bubble up
      if (error instanceof Error && (
        error.message.includes('CrunchyCone API key not found') ||
        error.message.includes('CrunchyCone project ID is required')
      )) {
        throw error;
      }
      return false;
    }
  }

  async fileExistsByExternalId(externalId: string): Promise<boolean> {
    try {
      const fileInfo = await this.findFileByExternalId(externalId);
      return fileInfo !== null;
    } catch {
      return false;
    }
  }

  async findFileByExternalId(externalId: string): Promise<StorageFileInfo | null> {
    try {
      const response = await this.makeRequest<{ data: CrunchyConeFileMetadata }>(
        `/api/v1/storage/files/by-external-id/${encodeURIComponent(externalId)}`,
      );

      return this.convertToStorageFileInfo(response.data);
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  private async findFileByStorageKey(storageKey: string): Promise<CrunchyConeFileMetadata | null> {
    try {
      // Since there's no direct endpoint for finding by storage key,
      // we'll need to list files and filter by storage_key
      // This is not efficient for large datasets, but works for the interface
      const response = await this.makeRequest<{ data: { files: CrunchyConeFileMetadata[] } }>('/api/v1/storage/files');
      
      // First try to find by storage_key
      let file = response.data.files.find(f => f.storage_key === storageKey);
      
      if (file) {
        return file;
      }

      // If not found by storage_key, try file_path as fallback
      // This is needed because CrunchyCone may return undefined storage_key but valid file_path
      file = response.data.files.find(f => f.file_path === storageKey);
      
      return file || null;
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  private async getFileMetadata(fileId: string): Promise<CrunchyConeFileMetadata> {
    const response = await this.makeRequest<{ data: CrunchyConeFileMetadata }>(`/api/v1/storage/files/${fileId}`);
    return response.data;
  }

  private convertToStorageFileInfo(metadata: CrunchyConeFileMetadata): StorageFileInfo {
    return {
      external_id: metadata.external_id || metadata.file_id,
      key: metadata.storage_key || metadata.file_path || metadata.file_id,
      url: `${this.config.apiUrl}/api/v1/storage/files/${metadata.file_id}/download`,
      size: metadata.actual_file_size,
      contentType: metadata.content_type,
      lastModified: metadata.uploaded_at ? new Date(metadata.uploaded_at) : new Date(metadata.updated_at),
      metadata: metadata.metadata,
      visibility: 'private', // CrunchyCone always uses authenticated access
      publicUrl: undefined, // CrunchyCone doesn't have native public URLs
    };
  }

  private generateDefaultPath(externalId: string, filename?: string): string {
    const timestamp = Date.now();
    const extension = filename ? filename.split('.').pop() : '';
    const ext = extension ? `.${extension}` : '';
    return `files/${externalId}-${timestamp}${ext}`;
  }

  private getContentTypeFromFilename(filename: string): string {
    const extension = filename.toLowerCase().split('.').pop();
    
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

    return mimeTypes[extension || ''] || 'application/octet-stream';
  }


  async listFiles(options: ListFilesOptions = {}): Promise<ListFilesResult> {
    await this.ensureConfigured();

    const {
      limit = 100,
      offset = 0,
      prefix,
      externalIdPrefix,
      contentType,
      minSize,
      maxSize,
      sortBy = 'key',
      sortOrder = 'asc',
    } = options;

    // Build query parameters for CrunchyCone API
    const queryParams = new URLSearchParams({
      project_id: this.config.projectId,
      limit: limit.toString(),
      offset: offset.toString(),
    });

    // Add filters based on available API parameters
    if (prefix) {
      queryParams.append('path_prefix', prefix);
    }

    if (externalIdPrefix) {
      queryParams.append('external_id', externalIdPrefix);
    }

    try {
      const response = await this.makeRequest<{
        data: {
          files: CrunchyConeFileMetadata[];
          total_count: number;
          has_more: boolean;
        };
      }>(`/api/v1/storage/files?${queryParams.toString()}`);

      let files = response.data.files.map(f => this.convertToStorageFileInfo(f));

      // Apply client-side filters that aren't supported by the API
      if (contentType) {
        files = files.filter(f => f.contentType === contentType);
      }

      if (minSize !== undefined) {
        files = files.filter(f => f.size >= minSize);
      }

      if (maxSize !== undefined) {
        files = files.filter(f => f.size <= maxSize);
      }

      // Apply sorting
      files.sort((a, b) => {
        let aValue: any, bValue: any;

        switch (sortBy) {
          case 'external_id':
            aValue = a.external_id || '';
            bValue = b.external_id || '';
            break;
          case 'filename':
            aValue = a.key.split('/').pop() || '';
            bValue = b.key.split('/').pop() || '';
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

      return {
        files,
        totalCount: response.data.total_count,
        hasMore: response.data.has_more,
        nextOffset: response.data.has_more ? offset + limit : undefined,
      };
    } catch (error) {
      throw new Error(`Failed to list files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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
      externalIdPrefix,
      contentType,
      minSize,
      maxSize,
      sortBy = 'key',
      sortOrder = 'asc',
    } = options;

    // Build query parameters for CrunchyCone API
    const queryParams = new URLSearchParams({
      project_id: this.config.projectId,
      limit: '1000', // Get more files for searching
      offset: '0',
    });

    // Add filters based on available API parameters
    if (externalIdPrefix) {
      queryParams.append('external_id', externalIdPrefix);
    }

    // Use filename search if available in the API
    if (query && searchFields.includes('filename')) {
      queryParams.append('filename_search', query);
      queryParams.append('search_type', exactMatch ? 'exact' : 'contains');
      queryParams.append('case_sensitive', caseSensitive.toString());
    }

    try {
      const response = await this.makeRequest<{
        data: {
          files: CrunchyConeFileMetadata[];
          total_count: number;
          has_more: boolean;
        };
      }>(`/api/v1/storage/files?${queryParams.toString()}`);

      let files = response.data.files.map(f => this.convertToStorageFileInfo(f));

      // Apply client-side search for non-filename fields
      if (query && (!searchFields.includes('filename') || searchFields.length > 1)) {
        const searchQuery = caseSensitive ? query : query.toLowerCase();
        
        files = files.filter(file => {
          for (const field of searchFields) {
            let fieldValue = '';

            switch (field) {
              case 'external_id':
                fieldValue = file.external_id || '';
                break;
              case 'filename':
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
                return true;
              }
            } else {
              if (fieldValue.includes(searchQuery)) {
                return true;
              }
            }
          }
          return false;
        });
      }

      // Apply additional client-side filters
      if (contentType) {
        files = files.filter(f => f.contentType === contentType);
      }

      if (minSize !== undefined) {
        files = files.filter(f => f.size >= minSize);
      }

      if (maxSize !== undefined) {
        files = files.filter(f => f.size <= maxSize);
      }

      // Apply sorting
      files.sort((a, b) => {
        let aValue: any, bValue: any;

        switch (sortBy) {
          case 'external_id':
            aValue = a.external_id || '';
            bValue = b.external_id || '';
            break;
          case 'filename':
            aValue = a.key.split('/').pop() || '';
            bValue = b.key.split('/').pop() || '';
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

      // Apply pagination to search results
      const totalCount = files.length;
      const paginatedFiles = files.slice(offset, offset + limit);
      const hasMore = offset + limit < totalCount;
      const searchTime = Date.now() - startTime;

      return {
        files: paginatedFiles,
        totalCount,
        hasMore,
        nextOffset: hasMore ? offset + limit : undefined,
        searchTime,
        query,
      };
    } catch (error) {
      throw new Error(`Failed to search files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // File visibility management
  async setFileVisibility(key: string, visibility: 'public' | 'private'): Promise<FileVisibilityResult> {
    try {
      // Wait for config to be initialized
      await this.configPromise;
      // Find the file by storage key first
      const fileMetadata = await this.findFileByStorageKey(key);
      if (!fileMetadata) {
        return {
          success: false,
          requestedVisibility: visibility,
          actualVisibility: 'private',
          message: `File with key ${key} not found`,
        };
      }



      // Try the correct endpoint first, with fallbacks
      const endpointsToTry = [
        `/api/v1/storage/files/${fileMetadata.file_id}/visibility`,
        `/api/v1/users/me/projects/${this.config.projectId}/files/${fileMetadata.file_id}/visibility`,
        `/api/v1/files/${fileMetadata.file_id}/visibility`,
      ];

      let response: any;
      let successfulEndpoint: string | null = null;
      let lastError: Error | null = null;

      for (const endpoint of endpointsToTry) {
        try {
          response = await this.makeRequest<{ 
            success?: boolean;
            message?: string;
            data?: {
              file: {
                id: string;
                visibility: 'public' | 'private';
                public_url?: string;
              };
            };
          }>(endpoint, {
            method: 'PATCH',
            body: JSON.stringify({ visibility }),
          });
          
          successfulEndpoint = endpoint;
          break;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          continue;
        }
      }

      if (!response && lastError) {
        throw lastError;
      }

      // Handle the new response format
      const success = response.success ?? !!response.data?.file;
      const message = response.message || 'File visibility updated successfully';
      const publicUrl = response.data?.file?.public_url;

      return {
        success,
        requestedVisibility: visibility,
        actualVisibility: success ? visibility : 'private',
        publicUrl,
        message,
        providerSpecific: {
          fileId: fileMetadata.file_id,
          updatedViaAPI: true,
          successfulEndpoint,
          rawResponse: response, // Include raw response for debugging
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      return {
        success: false,
        requestedVisibility: visibility,
        actualVisibility: 'private',
        message: `Failed to set file visibility: ${errorMessage}`,
        providerSpecific: {
          errorDetails: errorMessage,
        },
      };
    }
  }

  async setFileVisibilityByExternalId(externalId: string, visibility: 'public' | 'private'): Promise<FileVisibilityResult> {
    try {
      // Wait for config to be initialized
      await this.configPromise;

      // Try multiple endpoint variations to find the correct one for external ID
      const endpointsToTry = [
        `/api/v1/storage/files/by-external-id/${encodeURIComponent(externalId)}/visibility`,
        `/api/v1/users/me/projects/${this.config.projectId}/files/external/${encodeURIComponent(externalId)}/visibility`,
        `/api/v1/files/by-external-id/${encodeURIComponent(externalId)}/visibility`,
      ];

      let response: any;
      let successfulEndpoint: string | null = null;
      let lastError: Error | null = null;

      for (const endpoint of endpointsToTry) {
        try {
          response = await this.makeRequest<{ 
            success?: boolean;
            message?: string;
            data?: {
              file: {
                id: string;
                visibility: 'public' | 'private';
                public_url?: string;
              };
            };
          }>(endpoint, {
            method: 'PATCH',
            body: JSON.stringify({ visibility }),
          });
          
          successfulEndpoint = endpoint;
          break;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          continue;
        }
      }

      if (!response && lastError) {
        throw lastError;
      }

      // Handle the new response format
      const success = response.success ?? !!response.data?.file;
      const message = response.message || 'File visibility updated successfully';
      const publicUrl = response.data?.file?.public_url;

      return {
        success,
        requestedVisibility: visibility,
        actualVisibility: success ? visibility : 'private',
        publicUrl,
        message,
        providerSpecific: {
          externalId,
          updatedViaAPI: true,
          successfulEndpoint,
          rawResponse: response, // Include raw response for debugging
        },
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return {
          success: false,
          requestedVisibility: visibility,
          actualVisibility: 'private',
          message: `File with external_id ${externalId} not found`,
        };
      }
      
      return {
        success: false,
        requestedVisibility: visibility,
        actualVisibility: 'private',
        message: `Failed to set file visibility: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async getFileVisibility(key: string): Promise<FileVisibilityStatus> {
    try {
      // Find the file by storage key
      const fileMetadata = await this.findFileByStorageKey(key);
      if (!fileMetadata) {
        throw new Error(`File with key ${key} not found`);
      }

      // Check visibility preference from metadata
      const visibilityPreference = fileMetadata.metadata?.visibility || 'private';
      
      return {
        visibility: 'private', // CrunchyCone always uses authenticated access
        canMakePublic: false, // No native public URL support
        canMakePrivate: true,
        supportsTemporaryAccess: true, // Signed URLs provide temporary access
        message: visibilityPreference === 'public' 
          ? 'File preference is public, but CrunchyCone uses authenticated access for all files. Access via signed URLs.'
          : 'File is private and requires authentication. Access via signed URLs.',
      };
    } catch (error) {
      throw new Error(`Failed to get file visibility: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getFileVisibilityByExternalId(externalId: string): Promise<FileVisibilityStatus> {
    try {
      // Get file metadata by external ID
      const response = await this.makeRequest<{ data: CrunchyConeFileMetadata }>(
        `/api/v1/storage/files/by-external-id/${encodeURIComponent(externalId)}`,
      );

      // Check visibility preference from metadata
      const visibilityPreference = response.data.metadata?.visibility || 'private';
      
      return {
        visibility: 'private', // CrunchyCone always uses authenticated access
        canMakePublic: false, // No native public URL support
        canMakePrivate: true,
        supportsTemporaryAccess: true, // Signed URLs provide temporary access
        message: visibilityPreference === 'public' 
          ? 'File preference is public, but CrunchyCone uses authenticated access for all files. Access via signed URLs.'
          : 'File is private and requires authentication. Access via signed URLs.',
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        throw new Error(`File with external_id ${externalId} not found`);
      }
      
      throw new Error(`Failed to get file visibility: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // File streaming operations
  async getFileStream(key: string, options: FileStreamOptions = {}): Promise<FileStreamResult> {
    // Find the file by storage key first
    const fileMetadata = await this.findFileByStorageKey(key);
    if (!fileMetadata) {
      throw new Error(`File with key ${key} not found`);
    }

    return this.createFileStream(fileMetadata.file_id, fileMetadata, options);
  }

  async getFileStreamByExternalId(externalId: string, options: FileStreamOptions = {}): Promise<FileStreamResult> {
    // Get file metadata by external ID
    const response = await this.makeRequest<{ data: CrunchyConeFileMetadata }>(
      `/api/v1/storage/files/by-external-id/${encodeURIComponent(externalId)}`,
    );

    return this.createFileStream(response.data.file_id, response.data, options);
  }

  private async createFileStream(
    fileId: string, 
    fileMetadata: CrunchyConeFileMetadata, 
    options: FileStreamOptions,
  ): Promise<FileStreamResult> {
    const {
      start,
      end,
      responseType = 'node',
      signal,
      timeout = this.config.timeout || 30000,
      includeMetadata: _includeMetadata = true,
    } = options;

    // Get signed URL for streaming
    const downloadUrl = `${this.config.apiUrl}/api/v1/storage/files/${fileId}/download?returnSignedUrl=true`;
    const signedUrl = await this.getSignedUrlFromJsonForStream(downloadUrl);

    // Prepare headers for range requests
    const headers: Record<string, string> = {};
    if (start !== undefined || end !== undefined) {
      const rangeStart = start ?? 0;
      const rangeEnd = end ?? '';
      headers['Range'] = `bytes=${rangeStart}-${rangeEnd}`;
    }

    // Create abort controller for timeout and cancellation
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    // Use provided signal or our timeout signal
    if (signal) {
      signal.addEventListener('abort', () => controller.abort());
    }

    try {
      const response = await fetch(signedUrl, {
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Failed to stream file: ${response.status} ${response.statusText}`);
      }

      // Parse response headers
      const contentType = response.headers.get('content-type') || fileMetadata.content_type || 'application/octet-stream';
      const contentLength = response.headers.get('content-length') ? 
        parseInt(response.headers.get('content-length')!) : 
        fileMetadata.actual_file_size;
      const lastModified = response.headers.get('last-modified') ? 
        new Date(response.headers.get('last-modified')!) : 
        new Date(fileMetadata.uploaded_at || fileMetadata.updated_at);
      const etag = response.headers.get('etag') || fileMetadata.file_id;
      const acceptsRanges = response.headers.get('accept-ranges') === 'bytes';
      const isPartialContent = response.status === 206;

      // Parse range information if partial content
      let range: { start: number; end: number; total: number } | undefined;
      if (isPartialContent) {
        const contentRange = response.headers.get('content-range');
        if (contentRange) {
          const match = contentRange.match(/bytes (\d+)-(\d+)\/(\d+)/);
          if (match) {
            range = {
              start: parseInt(match[1]),
              end: parseInt(match[2]),
              total: parseInt(match[3]),
            };
          }
        }
      }

      // Get the stream in the requested format
      let stream: NodeJS.ReadableStream | ReadableStream;
      if (responseType === 'web') {
        stream = response.body!;
      } else {
        // Convert Web ReadableStream to Node.js Readable
        const { Readable } = await import('stream');
        stream = Readable.fromWeb(response.body as any);
      }

      return {
        stream,
        contentType,
        contentLength,
        lastModified,
        etag,
        acceptsRanges,
        isPartialContent,
        range,
        streamType: responseType,
        providerSpecific: {
          signedUrl,
          cacheControl: response.headers.get('cache-control') || undefined,
          fileId: fileMetadata.file_id,
          externalId: fileMetadata.external_id,
        },
        cleanup: async () => {
          // Clean up any resources if needed
          controller.abort();
        },
      };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`File stream request timeout after ${timeout}ms`);
      }
      throw new Error(`Failed to create file stream: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async getSignedUrlFromJsonForStream(downloadUrl: string): Promise<string> {
    const timeout = this.config.timeout || 30000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(downloadUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'X-API-Key': this.config.apiKey,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const jsonResponse = await response.json() as { 
        data?: { signedUrl?: string; returnUrl?: string }; 
        signedUrl?: string; 
        returnUrl?: string;
      };
      
      const data = jsonResponse.data || jsonResponse;
      const signedUrl = data.signedUrl || data.returnUrl;
      
      if (!signedUrl || signedUrl === '') {
        throw new Error('No valid signed URL found in API response');
      }

      return signedUrl;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      throw error;
    }
  }

  private async updateFileMetadata(fileId: string, metadata: Record<string, string>): Promise<void> {
    await this.makeRequest(`/api/v1/storage/files/${fileId}/metadata`, {
      method: 'PUT',
      body: JSON.stringify({ metadata }),
    });
  }

  /**
   * Update file visibility directly using file ID (more efficient when you have the file ID)
   * This method directly calls the CrunchyCone visibility API
   */
  async updateFileVisibilityById(fileId: string, visibility: 'public' | 'private'): Promise<FileVisibilityResult> {
    try {
      // Wait for config to be initialized
      await this.configPromise;
      // Log debug information for troubleshooting

      // Try the correct endpoint first, with fallbacks
      const endpointsToTry = [
        `/api/v1/storage/files/${fileId}/visibility`,
        `/api/v1/users/me/projects/${this.config.projectId}/files/${fileId}/visibility`,
        `/api/v1/files/${fileId}/visibility`,
      ];

      let response: any;
      let successfulEndpoint: string | null = null;
      let lastError: Error | null = null;

      for (const endpoint of endpointsToTry) {
        try {
          response = await this.makeRequest<{ 
            success?: boolean;
            message?: string;
            data?: {
              file: {
                id: string;
                visibility: 'public' | 'private';
                public_url?: string;
              };
            };
          }>(endpoint, {
            method: 'PATCH',
            body: JSON.stringify({ visibility }),
          });
          
          successfulEndpoint = endpoint;
          break;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          continue;
        }
      }

      if (!response && lastError) {
        throw lastError;
      }

      // Handle the new response format
      const success = response.success ?? !!response.data?.file;
      const message = response.message || 'File visibility updated successfully';
      const publicUrl = response.data?.file?.public_url;

      return {
        success,
        requestedVisibility: visibility,
        actualVisibility: success ? visibility : 'private',
        publicUrl,
        message,
        providerSpecific: {
          fileId,
          updatedViaAPI: true,
          successfulEndpoint,
          rawResponse: response, // Include raw response for debugging
        },
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return {
          success: false,
          requestedVisibility: visibility,
          actualVisibility: 'private',
          message: `File with ID ${fileId} not found`,
        };
      }
      
      return {
        success: false,
        requestedVisibility: visibility,
        actualVisibility: 'private',
        message: `Failed to set file visibility: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async isAvailable(): Promise<boolean> {
    return true; // CrunchyCone provider has no optional dependencies
  }
}