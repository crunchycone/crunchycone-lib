// Examples of how other providers could implement the streaming interface

import { FileStreamOptions, FileStreamResult } from '../src/services/storage/types';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { Readable } from 'stream';

// ============================================================================
// LOCAL STORAGE PROVIDER IMPLEMENTATION
// ============================================================================

class LocalStorageProviderWithStreaming {
  private basePath: string;
  private baseUrl: string;

  constructor() {
    this.basePath = process.env.CRUNCHYCONE_LOCALSTORAGE_PATH!;
    this.baseUrl = process.env.CRUNCHYCONE_LOCALSTORAGE_BASE_URL || '/uploads';
  }

  async getFileStream(key: string, options: FileStreamOptions = {}): Promise<FileStreamResult> {
    const {
      start,
      end,
      responseType = 'node',
      signal,
    } = options;

    const filePath = `${this.basePath}/${key}`;
    
    try {
      const stats = await stat(filePath);
      const contentLength = stats.size;
      
      // Handle range requests
      const rangeStart = start ?? 0;
      const rangeEnd = end ?? contentLength - 1;
      const isPartialContent = start !== undefined || end !== undefined;
      
      // Create the appropriate stream
      let stream: NodeJS.ReadableStream | ReadableStream;
      
      if (responseType === 'web') {
        // Create Web ReadableStream for browser compatibility
        const nodeStream = createReadStream(filePath, { 
          start: rangeStart, 
          end: rangeEnd 
        });
        stream = Readable.toWeb(nodeStream) as ReadableStream;
      } else {
        // Create Node.js ReadableStream
        stream = createReadStream(filePath, { 
          start: rangeStart, 
          end: rangeEnd 
        });
      }

      return {
        stream,
        contentType: this.getContentTypeFromPath(key),
        contentLength: isPartialContent ? (rangeEnd - rangeStart + 1) : contentLength,
        lastModified: stats.mtime,
        acceptsRanges: true,
        isPartialContent,
        range: isPartialContent ? {
          start: rangeStart,
          end: rangeEnd,
          total: contentLength
        } : undefined,
        streamType: responseType,
        providerSpecific: {
          filePath,
          localProvider: true,
        }
      };
    } catch (error) {
      throw new Error(`Failed to stream local file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private getContentTypeFromPath(filePath: string): string {
    // Implementation similar to existing method
    return 'application/octet-stream';
  }
}

// ============================================================================
// S3-COMPATIBLE PROVIDER IMPLEMENTATION
// ============================================================================

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

class S3CompatibleProviderWithStreaming {
  private client: S3Client;
  private bucket: string;

  constructor(client: S3Client, bucket: string) {
    this.client = client;
    this.bucket = bucket;
  }

  async getFileStream(key: string, options: FileStreamOptions = {}): Promise<FileStreamResult> {
    const {
      start,
      end,
      responseType = 'node',
      signal,
    } = options;

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Range: (start !== undefined || end !== undefined) ? 
        `bytes=${start ?? 0}-${end ?? ''}` : undefined,
    });

    try {
      const response = await this.client.send(command);
      
      if (!response.Body) {
        throw new Error('No response body from S3');
      }

      // Convert S3 response body to appropriate stream type
      let stream: NodeJS.ReadableStream | ReadableStream;
      
      if (responseType === 'web') {
        // Convert to Web ReadableStream
        stream = Readable.toWeb(response.Body as NodeJS.ReadableStream) as ReadableStream;
      } else {
        stream = response.Body as NodeJS.ReadableStream;
      }

      const isPartialContent = response.ContentRange !== undefined;
      let range: { start: number; end: number; total: number } | undefined;

      if (isPartialContent && response.ContentRange) {
        const match = response.ContentRange.match(/bytes (\d+)-(\d+)\/(\d+)/);
        if (match) {
          range = {
            start: parseInt(match[1]),
            end: parseInt(match[2]),
            total: parseInt(match[3]),
          };
        }
      }

      return {
        stream,
        contentType: response.ContentType || 'application/octet-stream',
        contentLength: response.ContentLength,
        lastModified: response.LastModified,
        etag: response.ETag,
        acceptsRanges: response.AcceptRanges === 'bytes',
        isPartialContent,
        range,
        streamType: responseType,
        providerSpecific: {
          s3Metadata: response.Metadata,
          s3StorageClass: response.StorageClass,
          s3ServerSideEncryption: response.ServerSideEncryption,
        }
      };
    } catch (error) {
      throw new Error(`Failed to stream S3 file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// ============================================================================
// GCP STORAGE PROVIDER IMPLEMENTATION
// ============================================================================

class GCPStorageProviderWithStreaming {
  private bucket: any; // GCP Storage bucket instance
  
  constructor(bucket: any) {
    this.bucket = bucket;
  }

  async getFileStream(key: string, options: FileStreamOptions = {}): Promise<FileStreamResult> {
    const {
      start,
      end,
      responseType = 'node',
    } = options;

    try {
      const file = this.bucket.file(key);
      const [metadata] = await file.getMetadata();
      
      // Create download stream with range if specified
      const downloadOptions: any = {};
      if (start !== undefined || end !== undefined) {
        downloadOptions.start = start ?? 0;
        downloadOptions.end = end;
      }

      const nodeStream = file.createReadStream(downloadOptions);
      
      let stream: NodeJS.ReadableStream | ReadableStream;
      if (responseType === 'web') {
        stream = Readable.toWeb(nodeStream) as ReadableStream;
      } else {
        stream = nodeStream;
      }

      const isPartialContent = start !== undefined || end !== undefined;
      const contentLength = isPartialContent ? 
        (end ?? parseInt(metadata.size)) - (start ?? 0) + 1 : 
        parseInt(metadata.size);

      return {
        stream,
        contentType: metadata.contentType || 'application/octet-stream',
        contentLength,
        lastModified: new Date(metadata.timeCreated),
        etag: metadata.etag,
        acceptsRanges: true, // GCS supports range requests
        isPartialContent,
        range: isPartialContent ? {
          start: start ?? 0,
          end: end ?? parseInt(metadata.size) - 1,
          total: parseInt(metadata.size)
        } : undefined,
        streamType: responseType,
        providerSpecific: {
          gcpGeneration: metadata.generation,
          gcpStorageClass: metadata.storageClass,
        }
      };
    } catch (error) {
      throw new Error(`Failed to stream GCP file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// ============================================================================
// AZURE STORAGE PROVIDER IMPLEMENTATION
// ============================================================================

import { BlobServiceClient } from '@azure/storage-blob';

class AzureStorageProviderWithStreaming {
  private blobServiceClient: BlobServiceClient;
  private containerName: string;

  constructor(blobServiceClient: BlobServiceClient, containerName: string) {
    this.blobServiceClient = blobServiceClient;
    this.containerName = containerName;
  }

  async getFileStream(key: string, options: FileStreamOptions = {}): Promise<FileStreamResult> {
    const {
      start,
      end,
      responseType = 'node',
    } = options;

    try {
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      const blobClient = containerClient.getBlobClient(key);
      
      // Download with range if specified
      const downloadOptions: any = {};
      if (start !== undefined || end !== undefined) {
        downloadOptions.range = {
          offset: start ?? 0,
          count: end !== undefined ? end - (start ?? 0) + 1 : undefined
        };
      }

      const downloadResponse = await blobClient.download(
        downloadOptions.range?.offset,
        downloadOptions.range?.count
      );

      if (!downloadResponse.readableStreamBody) {
        throw new Error('No response body from Azure');
      }

      let stream: NodeJS.ReadableStream | ReadableStream;
      if (responseType === 'web') {
        stream = Readable.toWeb(downloadResponse.readableStreamBody) as ReadableStream;
      } else {
        stream = downloadResponse.readableStreamBody;
      }

      const isPartialContent = downloadResponse.contentRange !== undefined;
      let range: { start: number; end: number; total: number } | undefined;

      if (isPartialContent && downloadResponse.contentRange) {
        const match = downloadResponse.contentRange.match(/bytes (\d+)-(\d+)\/(\d+)/);
        if (match) {
          range = {
            start: parseInt(match[1]),
            end: parseInt(match[2]),
            total: parseInt(match[3]),
          };
        }
      }

      return {
        stream,
        contentType: downloadResponse.contentType || 'application/octet-stream',
        contentLength: downloadResponse.contentLength,
        lastModified: downloadResponse.lastModified,
        etag: downloadResponse.etag,
        acceptsRanges: downloadResponse.acceptRanges === 'bytes',
        isPartialContent,
        range,
        streamType: responseType,
        providerSpecific: {
          azureBlobType: downloadResponse.blobType,
          azureAccessTier: downloadResponse.accessTier,
          azureServerEncrypted: downloadResponse.isServerEncrypted,
        }
      };
    } catch (error) {
      throw new Error(`Failed to stream Azure file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export {
  LocalStorageProviderWithStreaming,
  S3CompatibleProviderWithStreaming,
  GCPStorageProviderWithStreaming,
  AzureStorageProviderWithStreaming,
};