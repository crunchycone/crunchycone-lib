import { FileValidationOptions, FileValidationResult } from './types';
import { extname } from 'path';

export function validateFile(
  file: File | { name: string; size: number; type: string },
  options: FileValidationOptions = {},
): FileValidationResult {
  const {
    maxSize = 10 * 1024 * 1024, // 10MB default
    minSize = 0,
    allowedTypes = [],
    allowedExtensions = [],
    blockDangerousFiles = true,
  } = options;

  // Size validation
  if (file.size < minSize) {
    return {
      valid: false,
      error: `File size (${formatBytes(file.size)}) is below minimum allowed size (${formatBytes(minSize)})`,
    };
  }

  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File size (${formatBytes(file.size)}) exceeds maximum allowed size (${formatBytes(maxSize)})`,
    };
  }

  // Type validation
  if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `File type "${file.type}" is not allowed. Allowed types: ${allowedTypes.join(', ')}`,
    };
  }

  // Extension validation
  if (allowedExtensions.length > 0) {
    const extension = getFileExtension(file.name);
    if (!allowedExtensions.includes(extension)) {
      return {
        valid: false,
        error: `File extension "${extension}" is not allowed. Allowed extensions: ${allowedExtensions.join(', ')}`,
      };
    }
  }

  // Security validation - check for dangerous files
  if (blockDangerousFiles) {
    const securityCheck = checkFileSecurityRisk(file.name, file.type);
    if (!securityCheck.safe) {
      return {
        valid: false,
        error: securityCheck.reason || 'File type is considered dangerous',
      };
    }
  }

  return { valid: true };
}

export function getFileExtension(filename: string): string {
  return extname(filename).toLowerCase().slice(1);
}

export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function checkFileSecurityRisk(filename: string, mimeType: string): { safe: boolean; reason?: string } {
  const extension = getFileExtension(filename);
  
  // List of dangerous file extensions
  const dangerousExtensions = [
    // Executable files
    'exe', 'bat', 'cmd', 'com', 'pif', 'scr', 'vbs', 'vbe', 'ws', 'wsf', 'wsh',
    // Script files
    'js', 'jse', 'jar', 'msi', 'dll', 'scf', 'lnk', 'inf', 'reg',
    // Document with macros
    'docm', 'xlsm', 'pptm', 'potm', 'ppam', 'xlam', 'xltm',
    // Archives that could contain executables
    'zip', 'rar', '7z', 'tar', 'gz', 'bz2',
  ];

  // List of dangerous MIME types
  const dangerousMimeTypes = [
    'application/x-msdownload',
    'application/x-executable',
    'application/x-dosexec',
    'application/x-winexe',
    'application/octet-stream', // Too generic, could be anything
  ];

  // Check for dangerous extensions
  if (dangerousExtensions.includes(extension)) {
    return {
      safe: false,
      reason: `File extension ".${extension}" is potentially dangerous and not allowed`,
    };
  }

  // Check for dangerous MIME types
  if (dangerousMimeTypes.includes(mimeType)) {
    return {
      safe: false,
      reason: `MIME type "${mimeType}" is potentially dangerous and not allowed`,
    };
  }

  // Check for double extensions (e.g., file.txt.exe)
  const parts = filename.split('.');
  if (parts.length > 2) {
    const secondToLastExt = parts[parts.length - 2].toLowerCase();
    if (dangerousExtensions.includes(secondToLastExt)) {
      return {
        safe: false,
        reason: 'Files with double extensions are not allowed for security reasons',
      };
    }
  }

  // Check for suspicious filenames
  const suspiciousPatterns = [
    /^\./, // Hidden files starting with dot
    /\.(php|asp|aspx|jsp|cgi|pl)$/i, // Server-side scripts
    /\.(htaccess|htpasswd)$/i, // Apache config files
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(filename)) {
      return {
        safe: false,
        reason: 'Filename matches a suspicious pattern and is not allowed',
      };
    }
  }

  return { safe: true };
}

export function getCommonValidationOptions(): Record<string, FileValidationOptions> {
  return {
    // Images only
    images: {
      maxSize: 5 * 1024 * 1024, // 5MB
      allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      allowedExtensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
      blockDangerousFiles: true,
    },

    // Documents
    documents: {
      maxSize: 10 * 1024 * 1024, // 10MB
      allowedTypes: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
      ],
      allowedExtensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt'],
      blockDangerousFiles: true,
    },

    // Videos
    videos: {
      maxSize: 100 * 1024 * 1024, // 100MB
      allowedTypes: ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo'],
      allowedExtensions: ['mp4', 'mpeg', 'mpg', 'mov', 'avi'],
      blockDangerousFiles: true,
    },

    // Audio files
    audio: {
      maxSize: 20 * 1024 * 1024, // 20MB
      allowedTypes: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4'],
      allowedExtensions: ['mp3', 'wav', 'ogg', 'm4a'],
      blockDangerousFiles: true,
    },

    // Strict security (very limited)
    strict: {
      maxSize: 2 * 1024 * 1024, // 2MB
      allowedTypes: ['image/jpeg', 'image/png', 'application/pdf', 'text/plain'],
      allowedExtensions: ['jpg', 'jpeg', 'png', 'pdf', 'txt'],
      blockDangerousFiles: true,
    },

    // Permissive (be careful with this)
    permissive: {
      maxSize: 50 * 1024 * 1024, // 50MB
      blockDangerousFiles: true, // Still block dangerous files
    },
  };
}