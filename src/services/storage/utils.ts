import { randomBytes } from 'crypto';
import { extname, basename } from 'path';

export function generateUploadKey(
  userId: string,
  filename: string,
  prefix: string = 'uploads',
): string {
  const timestamp = Date.now();
  const randomId = randomBytes(8).toString('hex');
  const extension = extname(filename);
  const baseName = basename(filename, extension);
  
  // Sanitize filename
  const sanitizedBaseName = sanitizeFilename(baseName);
  
  return `${prefix}/${userId}/${timestamp}-${randomId}-${sanitizedBaseName}${extension}`;
}

export function generateExternalId(): string {
  const timestamp = Date.now();
  const randomId = randomBytes(12).toString('hex');
  return `ext_${timestamp}_${randomId}`;
}

export function generateKeyFromExternalId(
  externalId: string,
  filename?: string,
  prefix: string = 'files',
): string {
  const timestamp = Date.now();
  const extension = filename ? extname(filename) : '';
  return `${prefix}/${externalId}-${timestamp}${extension}`;
}

export function generateRandomKey(
  extension: string,
  prefix: string = 'uploads',
): string {
  const timestamp = Date.now();
  const randomId = randomBytes(12).toString('hex');
  
  // Ensure extension starts with dot
  const ext = extension.startsWith('.') ? extension : `.${extension}`;
  
  return `${prefix}/${timestamp}-${randomId}${ext}`;
}

export function sanitizeFilename(filename: string): string {
  return filename
    // Remove or replace dangerous characters
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    // Remove multiple consecutive underscores
    .replace(/_+/g, '_')
    // Remove leading/trailing underscores and dots
    .replace(/^[_.]+|[_.]+$/g, '')
    // Limit length
    .slice(0, 50);
}

export function generatePresignedKey(
  key: string,
  operation: 'upload' | 'download' = 'upload',
): string {
  const timestamp = Date.now();
  const randomId = randomBytes(4).toString('hex');
  
  return `${operation}/${timestamp}-${randomId}/${key}`;
}

export function parseStorageKey(key: string): {
  prefix?: string;
  userId?: string;
  timestamp?: number;
  randomId?: string;
  filename?: string;
  extension?: string;
} {
  const parts = key.split('/');
  const filename = parts[parts.length - 1];
  const extension = extname(filename);
  const baseName = basename(filename, extension);
  
  // Try to parse structured key format
  if (parts.length >= 3) {
    const filenameParts = baseName.split('-');
    if (filenameParts.length >= 3) {
      const timestamp = parseInt(filenameParts[0]);
      const randomId = filenameParts[1];
      const originalName = filenameParts.slice(2).join('-');
      
      return {
        prefix: parts.slice(0, -2).join('/'),
        userId: parts[parts.length - 2],
        timestamp: isNaN(timestamp) ? undefined : timestamp,
        randomId,
        filename: originalName + extension,
        extension: extension.slice(1), // Remove dot
      };
    }
  }
  
  return {
    filename,
    extension: extension.slice(1),
  };
}

export function getFileTypeCategory(contentType: string): string {
  if (contentType.startsWith('image/')) return 'image';
  if (contentType.startsWith('video/')) return 'video';
  if (contentType.startsWith('audio/')) return 'audio';
  if (contentType.startsWith('text/')) return 'text';
  if (contentType === 'application/pdf') return 'document';
  if (contentType.includes('document') || contentType.includes('spreadsheet')) return 'document';
  if (contentType.includes('zip') || contentType.includes('archive')) return 'archive';
  
  return 'other';
}

export function createDirectoryPath(
  userId: string,
  category: string,
  date: Date = new Date(),
): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  
  return `uploads/${category}/${userId}/${year}/${month}`;
}

export function isImageFile(contentType: string): boolean {
  return contentType.startsWith('image/');
}

export function isVideoFile(contentType: string): boolean {
  return contentType.startsWith('video/');
}

export function isAudioFile(contentType: string): boolean {
  return contentType.startsWith('audio/');
}

export function isDocumentFile(contentType: string): boolean {
  const documentTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument',
    'application/vnd.ms-excel',
    'text/plain',
    'text/csv',
  ];
  
  return documentTypes.some(type => contentType.includes(type));
}

export function validateFileSize(size: number, maxSize: number): boolean {
  return size <= maxSize;
}

export function validateFileType(contentType: string, allowedTypes: string[]): boolean {
  return allowedTypes.includes(contentType);
}

export function createThumbnailKey(originalKey: string, size: string = 'thumb'): string {
  const extension = extname(originalKey);
  const basePath = originalKey.slice(0, -extension.length);
  
  return `${basePath}_${size}${extension}`;
}

export function createBackupKey(originalKey: string): string {
  const timestamp = Date.now();
  const extension = extname(originalKey);
  const basePath = originalKey.slice(0, -extension.length);
  
  return `backups/${basePath}_backup_${timestamp}${extension}`;
}

export function extractMetadataFromKey(key: string): Record<string, string> {
  const parsed = parseStorageKey(key);
  const metadata: Record<string, string> = {};
  
  if (parsed.userId) metadata.userId = parsed.userId;
  if (parsed.timestamp) metadata.uploadTimestamp = parsed.timestamp.toString();
  if (parsed.filename) metadata.originalFilename = parsed.filename;
  if (parsed.extension) metadata.fileExtension = parsed.extension;
  
  return metadata;
}

export class StorageError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public originalError?: Error,
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

export function handleStorageError(error: unknown, operation: string): never {
  if (error instanceof StorageError) {
    throw error;
  }
  
  if (error instanceof Error) {
    throw new StorageError(
      `${operation} failed: ${error.message}`,
      'STORAGE_OPERATION_FAILED',
      500,
      error,
    );
  }
  
  throw new StorageError(
    `${operation} failed: Unknown error`,
    'STORAGE_UNKNOWN_ERROR',
    500,
  );
}