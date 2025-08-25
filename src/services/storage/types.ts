export interface StorageProvider {
  uploadFile(options: StorageUploadOptions): Promise<StorageUploadResult>;
  deleteFile(key: string): Promise<void>;
  deleteFileByExternalId(externalId: string): Promise<void>;
  /**
   * Get a URL that can be used to directly download the file content.
   * The returned URL should work with a simple fetch() or browser request without additional authentication.
   */
  getFileUrl(key: string, expiresIn?: number): Promise<string>;
  /**
   * Get a URL that can be used to directly download the file content by external ID.
   * The returned URL should work with a simple fetch() or browser request without additional authentication.
   */
  getFileUrlByExternalId(externalId: string, expiresIn?: number): Promise<string>;
  fileExists(key: string): Promise<boolean>;
  fileExistsByExternalId(externalId: string): Promise<boolean>;
  findFileByExternalId(externalId: string): Promise<StorageFileInfo | null>;
  listFiles(options?: ListFilesOptions): Promise<ListFilesResult>;
  searchFiles(options: SearchFilesOptions): Promise<SearchFilesResult>;
  
  // File visibility management
  setFileVisibility(key: string, visibility: 'public' | 'private'): Promise<FileVisibilityResult>;
  setFileVisibilityByExternalId(externalId: string, visibility: 'public' | 'private'): Promise<FileVisibilityResult>;
  getFileVisibility(key: string): Promise<FileVisibilityStatus>;
  getFileVisibilityByExternalId(externalId: string): Promise<FileVisibilityStatus>;
  
  // Optional bulk operations (providers can throw "not implemented")
  setMultipleFileVisibility?(keys: string[], visibility: 'public' | 'private'): Promise<FileVisibilityResult[]>;
  
  // File streaming operations (optional - not all providers implement)
  getFileStream?(key: string, options?: FileStreamOptions): Promise<FileStreamResult>;
  getFileStreamByExternalId?(externalId: string, options?: FileStreamOptions): Promise<FileStreamResult>;
}

export interface StorageUploadOptions {
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

export interface StorageUploadResult {
  external_id: string;
  key: string;
  url: string;
  size: number;
  contentType: string;
  etag?: string;
  metadata?: Record<string, string>;
  visibility: 'public' | 'private' | 'temporary-public';
  publicUrl?: string; // Direct public URL if available and file is public
  publicUrlExpiresAt?: Date; // For temporary access (Azure SAS)
}

export interface StorageFileInfo {
  external_id: string;
  key: string;
  url: string;
  size: number;
  contentType: string;
  lastModified?: Date;
  etag?: string;
  metadata?: Record<string, string>;
  visibility?: 'public' | 'private' | 'temporary-public';
  publicUrl?: string;
  publicUrlExpiresAt?: Date;
}

export interface S3Config {
  // Authentication
  accessKeyId: string;
  secretAccessKey: string;
  
  // Endpoint configuration
  region: string;
  endpoint?: string;           // Custom endpoint URL
  forcePathStyle?: boolean;    // For non-AWS S3 services
  
  // Bucket settings
  bucket: string;
  
  // URLs and CDN
  publicBaseUrl?: string;      // Custom public URL base
  cdnUrl?: string;            // CDN endpoint
  
  // SSL/TLS
  useSSL?: boolean;           // Default: true
  
  // Advanced options
  signatureVersion?: string;   // v2 or v4
  s3BucketEndpoint?: boolean; // For virtual hosted-style
  
  // Upload defaults
  defaultACL?: string;        // 'public-read', 'private', etc.
  serverSideEncryption?: string; // AES256, aws:kms
}

export interface FileValidationOptions {
  maxSize?: number;
  minSize?: number;
  allowedTypes?: string[];
  allowedExtensions?: string[];
  blockDangerousFiles?: boolean;
}

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

export type StorageProviderType = 
  | 'localstorage'
  | 'aws'
  | 's3'
  | 'digitalocean'
  | 'wasabi'
  | 'backblaze'
  | 'r2'
  | 's3-custom'
  | 'gcp'
  | 'azure'
  | 'crunchycone';

export interface ListFilesOptions {
  // Pagination
  limit?: number;                    // Number of files to return (default: 100, max: 1000)
  offset?: number;                   // For offset-based pagination
  continuationToken?: string;        // For cursor-based pagination (provider-specific)
  
  // Filtering by storage key/path
  prefix?: string;                   // Storage key prefix filter (most efficient)
  keyPattern?: string;              // Storage key pattern/glob (e.g., "*.jpg")
  
  // Filtering by external_id
  externalIdPrefix?: string;        // External ID prefix filter
  externalIdPattern?: string;       // External ID pattern/glob
  externalIds?: string[];           // Specific external IDs to include
  
  // Content filtering
  contentType?: string;             // Exact MIME type match
  contentTypePrefix?: string;       // MIME type prefix (e.g., "image/")
  filename?: string;                // Filename contains (case-insensitive)
  filenamePattern?: string;         // Filename glob pattern (e.g., "*.pdf")
  
  // Size filtering
  minSize?: number;                 // Minimum file size in bytes
  maxSize?: number;                 // Maximum file size in bytes
  
  // Date filtering
  createdAfter?: Date;              // Files created after this date
  createdBefore?: Date;             // Files created before this date
  modifiedAfter?: Date;             // Files modified after this date
  modifiedBefore?: Date;            // Files modified before this date
  
  // Metadata filtering
  metadata?: Record<string, string>; // Key-value pairs that must match
  hasMetadata?: string[];           // Files that have these metadata keys
  
  // Sorting (best effort - not all providers support all options)
  sortBy?: 'key' | 'external_id' | 'filename' | 'size' | 'lastModified' | 'contentType';
  sortOrder?: 'asc' | 'desc';       // Default: 'asc'
  
  // Performance options
  includeMetadata?: boolean;        // Whether to fetch full metadata (may be slower)
  includeUrls?: boolean;           // Whether to generate URLs (may be slower)
}

export interface ListFilesResult {
  files: StorageFileInfo[];
  
  // Pagination info
  totalCount?: number;              // Total files matching filter (if available/efficient)
  hasMore: boolean;                 // Whether there are more results
  continuationToken?: string;       // Token for next page (cursor-based)
  nextOffset?: number;              // Offset for next page (offset-based)
  
  // Performance info
  truncated?: boolean;              // If true, some files may not be included due to provider limits
  searchTime?: number;              // Time taken in milliseconds (for debugging)
}

export interface SearchFilesOptions extends Omit<ListFilesOptions, 'prefix' | 'keyPattern'> {
  // Text search across multiple fields
  query?: string;                   // Full-text search query
  
  // Which fields to search in (when query is provided)
  searchFields?: ('external_id' | 'filename' | 'metadata' | 'contentType' | 'key')[];
  
  // Search behavior
  caseSensitive?: boolean;          // Default: false
  exactMatch?: boolean;             // Default: false (use contains matching)
  
  // Advanced search options
  includeDeleted?: boolean;         // Include soft-deleted files (if supported)
  onlyPublic?: boolean;            // Only return public files
  onlyPrivate?: boolean;           // Only return private files
}

export interface SearchFilesResult extends ListFilesResult {
  // Search-specific metadata
  query?: string;                   // The query that was executed
  searchFields?: string[];          // Fields that were searched
  relevanceScoring?: boolean;       // Whether results are ordered by relevance
}

// Enhanced file info for list/search results
export interface StorageFileInfoExtended extends StorageFileInfo {
  // Additional fields that may be available during list/search
  isPublic?: boolean;               // Whether file is publicly accessible
  bucket?: string;                  // Bucket/container name
  storageClass?: string;           // Storage class (if applicable)
  tags?: Record<string, string>;   // Provider-specific tags
  
  // Search-specific fields
  relevanceScore?: number;          // Relevance score (0-1) if search was performed
  matchedFields?: string[];         // Which fields matched the search query
}

// File visibility management types
export interface FileVisibilityResult {
  success: boolean;
  requestedVisibility: 'public' | 'private';
  actualVisibility: 'public' | 'private' | 'temporary-public';
  publicUrl?: string; // Available when actualVisibility is 'public' or 'temporary-public'
  publicUrlExpiresAt?: Date; // For temporary access like Azure SAS
  message?: string; // Explanation of what was done or why it failed
  providerSpecific?: {
    // Provider can add specific details
    sasToken?: string; // Azure
    aclApplied?: boolean; // GCS/S3
    expirationExtensible?: boolean; // Whether expiry can be extended
    [key: string]: any; // Allow other provider-specific fields
  };
}

export interface FileVisibilityStatus {
  visibility: 'public' | 'private' | 'temporary-public';
  publicUrl?: string;
  publicUrlExpiresAt?: Date;
  canMakePublic: boolean; // Whether this provider/file supports making public
  canMakePrivate: boolean; // Whether this provider/file supports making private
  supportsTemporaryAccess: boolean; // Whether provider supports temporary public access
  message?: string; // Additional information about current status
}

// File streaming types
export interface FileStreamOptions {
  // Range request support for partial content
  start?: number;                   // Byte offset to start streaming from
  end?: number;                     // Byte offset to end streaming at
  
  // Stream type preference
  responseType?: 'node' | 'web';    // Type of stream to return (default: 'node')
  
  // Request control
  signal?: AbortSignal;             // For request cancellation
  timeout?: number;                 // Request timeout in milliseconds
  
  // Headers and metadata
  includeMetadata?: boolean;        // Whether to include file metadata (default: true)
}

export interface FileStreamResult {
  // The actual stream
  stream: NodeJS.ReadableStream | ReadableStream;
  
  // Content information
  contentType: string;
  contentLength?: number;           // Total file size, undefined for unknown/chunked
  lastModified?: Date;
  etag?: string;
  
  // Range request information
  acceptsRanges?: boolean;          // Whether the source supports range requests
  isPartialContent: boolean;        // Whether this is partial content (206 response)
  range?: {
    start: number;
    end: number;
    total: number;                  // Total file size
  };
  
  // Stream metadata
  streamType: 'node' | 'web';       // Type of stream returned
  
  // Provider-specific information
  providerSpecific?: {
    signedUrl?: string;             // The underlying URL (for debugging)
    cacheControl?: string;          // Cache control headers
    [key: string]: any;
  };
  
  // Utility methods
  cleanup?: () => Promise<void>;    // Optional cleanup function to call when done
}