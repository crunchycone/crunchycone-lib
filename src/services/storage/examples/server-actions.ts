/**
 * Example Next.js Server Actions for file upload using the storage system
 * 
 * Usage in your Next.js app:
 * 1. Copy these functions to your app/actions/ directory
 * 2. Add 'use server' directive at the top
 * 3. Import and use in your components
 * 4. Customize validation and error handling as needed
 */

// NOTE: Remove this comment and add 'use server' directive when using in Next.js
// 'use server';

import { uploadFile, validateFile, generateExternalId, getCommonValidationOptions } from '../index';
// import { auth } from '@/lib/auth/auth-config'; // Your auth implementation
// import { revalidatePath } from 'next/cache';

interface UploadResult {
  success?: boolean;
  error?: string;
  file?: {
    external_id: string;
    key: string;
    url: string;
    size: number;
    contentType: string;
  };
}

/**
 * Basic file upload action
 */
export async function uploadFileAction(formData: FormData): Promise<UploadResult> {
  try {
    // Get the uploaded file
    const file = formData.get('file') as File;
    if (!file || file.size === 0) {
      return { error: 'No file provided' };
    }

    // Get user session (implement your auth logic)
    // const session = await auth();
    // if (!session?.user) {
    //   return { error: 'Unauthorized' };
    // }

    // For demo purposes, use a placeholder user ID
    const _userId = 'demo-user'; // Replace with: session.user.id

    // Validate file using common validation options
    const validation = validateFile(file, getCommonValidationOptions().images);
    if (!validation.valid) {
      return { error: validation.error };
    }

    // Generate external ID for easy lookups
    const externalId = generateExternalId();

    // Upload using stream (preferred method for Next.js)
    const result = await uploadFile({
      stream: file.stream(),
      external_id: externalId,
      filename: file.name,
      contentType: file.type,
      size: file.size,
      public: false,
    });

    // Revalidate any relevant paths
    // revalidatePath('/profile');

    return {
      success: true,
      file: {
        external_id: result.external_id,
        key: result.key,
        url: result.url,
        size: result.size,
        contentType: result.contentType,
      },
    };

  } catch (error) {
    console.error('Upload error:', error);
    return { error: 'Upload failed' };
  }
}

/**
 * Upload with custom validation
 */
export async function uploadImageAction(formData: FormData): Promise<UploadResult> {
  try {
    const file = formData.get('file') as File;
    if (!file || file.size === 0) {
      return { error: 'No file provided' };
    }

    // Custom validation for images
    const validation = validateFile(file, {
      maxSize: 5 * 1024 * 1024, // 5MB
      allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
      allowedExtensions: ['jpg', 'jpeg', 'png', 'webp'],
      blockDangerousFiles: true,
    });

    if (!validation.valid) {
      return { error: validation.error };
    }

    const _userId = 'demo-user'; // Replace with actual user ID
    const externalId = generateExternalId();

    const result = await uploadFile({
      stream: file.stream(),
      external_id: externalId,
      filename: file.name,
      contentType: file.type,
      size: file.size,
      public: true, // Make images public
      metadata: {
        uploadedBy: _userId,
        originalName: file.name,
      },
    });

    return {
      success: true,
      file: {
        external_id: result.external_id,
        key: result.key,
        url: result.url,
        size: result.size,
        contentType: result.contentType,
      },
    };

  } catch (error) {
    console.error('Image upload error:', error);
    return { error: 'Image upload failed' };
  }
}

/**
 * Upload document with processing
 */
export async function uploadDocumentAction(formData: FormData): Promise<UploadResult> {
  try {
    const file = formData.get('file') as File;
    if (!file || file.size === 0) {
      return { error: 'No file provided' };
    }

    // Validate document
    const validation = validateFile(file, getCommonValidationOptions().documents);
    if (!validation.valid) {
      return { error: validation.error };
    }

    const _userId = 'demo-user'; // Replace with actual user ID
    
    // For documents, we might want to process the buffer
    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Here you could add document processing logic
    // e.g., virus scanning, text extraction, etc.
    
    const externalId = generateExternalId();

    const result = await uploadFile({
      buffer,
      external_id: externalId,
      filename: file.name,
      contentType: file.type,
      size: buffer.length,
      public: false, // Keep documents private
      metadata: {
        uploadedBy: _userId,
        documentType: 'user-upload',
        processed: 'true',
      },
    });

    return {
      success: true,
      file: {
        external_id: result.external_id,
        key: result.key,
        url: result.url,
        size: result.size,
        contentType: result.contentType,
      },
    };

  } catch (error) {
    console.error('Document upload error:', error);
    return { error: 'Document upload failed' };
  }
}

/**
 * Upload large file with temporary storage
 */
export async function uploadLargeFileAction(formData: FormData): Promise<UploadResult> {
  const tempFiles: string[] = [];

  try {
    const file = formData.get('file') as File;
    if (!file || file.size === 0) {
      return { error: 'No file provided' };
    }

    // Validate large file
    const validation = validateFile(file, {
      maxSize: 100 * 1024 * 1024, // 100MB
      blockDangerousFiles: true,
    });

    if (!validation.valid) {
      return { error: validation.error };
    }

    const _userId = 'demo-user'; // Replace with actual user ID
    
    // For very large files, you might want to save to temp location first
    const { tmpdir } = await import('os');
    const { join } = await import('path');
    const { writeFile, unlink } = await import('fs/promises');
    
    const tempPath = join(tmpdir(), `upload-${Date.now()}-${file.name}`);
    tempFiles.push(tempPath);
    
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(tempPath, buffer);

    const externalId = generateExternalId();

    const result = await uploadFile({
      filePath: tempPath,
      external_id: externalId,
      filename: file.name,
      contentType: file.type,
      size: file.size,
      public: false,
    });

    // Clean up temp file
    await unlink(tempPath);

    return {
      success: true,
      file: {
        external_id: result.external_id,
        key: result.key,
        url: result.url,
        size: result.size,
        contentType: result.contentType,
      },
    };

  } catch (error) {
    // Clean up temp files on error
    for (const tempFile of tempFiles) {
      try {
        const { unlink } = await import('fs/promises');
        await unlink(tempFile);
      } catch {
        // Ignore cleanup errors
      }
    }

    console.error('Large file upload error:', error);
    return { error: 'Large file upload failed' };
  }
}

/**
 * Multiple file upload action
 */
export async function uploadMultipleFilesAction(formData: FormData): Promise<{
  success?: boolean;
  error?: string;
  files?: Array<{
    external_id: string;
    key: string;
    url: string;
    size: number;
    contentType: string;
    filename: string;
  }>;
  failed?: Array<{
    filename: string;
    error: string;
  }>;
}> {
  try {
    const files = formData.getAll('files') as File[];
    if (!files || files.length === 0) {
      return { error: 'No files provided' };
    }

    const _userId = 'demo-user'; // Replace with actual user ID
    const uploadedFiles: Array<{
      external_id: string;
      key: string;
      url: string;
      size: number;
      contentType: string;
      filename: string;
    }> = [];
    const failedFiles: Array<{
      filename: string;
      error: string;
    }> = [];

    // Process files concurrently (be careful with rate limits)
    const results = await Promise.allSettled(
      files.map(async (file) => {
        // Validate each file
        const validation = validateFile(file, getCommonValidationOptions().images);
        if (!validation.valid) {
          throw new Error(validation.error || 'Validation failed');
        }

        const externalId = generateExternalId();

        const result = await uploadFile({
          stream: file.stream(),
          external_id: externalId,
          filename: file.name,
          contentType: file.type,
          size: file.size,
          public: true,
        });

        return {
          external_id: result.external_id,
          key: result.key,
          url: result.url,
          size: result.size,
          contentType: result.contentType,
          filename: file.name,
        };
      }),
    );

    // Process results
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        uploadedFiles.push(result.value);
      } else {
        failedFiles.push({
          filename: files[index].name,
          error: result.reason?.message || 'Upload failed',
        });
      }
    });

    return {
      success: true,
      files: uploadedFiles,
      failed: failedFiles.length > 0 ? failedFiles : undefined,
    };

  } catch (error) {
    console.error('Multiple upload error:', error);
    return { error: 'Multiple file upload failed' };
  }
}