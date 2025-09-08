// Dynamic imports for optional AWS SDK dependencies
import { StorageProvider, StorageUploadOptions, StorageUploadResult, StorageFileInfo, S3Config, ListFilesOptions, ListFilesResult, SearchFilesOptions, SearchFilesResult, FileVisibilityResult, FileVisibilityStatus } from '../types';
import { createReadStream } from 'fs';
import { Readable } from 'stream';

export class S3CompatibleProvider implements StorageProvider {
  private client: any; // S3Client - will be initialized lazily
  private config: S3Config;
  private awsSDK: any; // Will hold dynamically imported AWS SDK modules

  constructor(config: S3Config) {
    this.config = config;
  }

  private async initializeClient() {
    if (this.client) {
      return { client: this.client, sdk: this.awsSDK };
    }

    try {
      // Dynamic imports for AWS SDK
      const s3Package = '@aws-sdk/client-s3'.split('').join('');
      const presignerPackage = '@aws-sdk/s3-request-presigner'.split('').join('');
      const [s3Module, presignerModule] = await Promise.all([
        import(s3Package),
        import(presignerPackage),
      ]);

      this.awsSDK = {
        S3Client: s3Module.S3Client,
        PutObjectCommand: s3Module.PutObjectCommand,
        DeleteObjectCommand: s3Module.DeleteObjectCommand,
        HeadObjectCommand: s3Module.HeadObjectCommand,
        GetObjectCommand: s3Module.GetObjectCommand,
        ListObjectsV2Command: s3Module.ListObjectsV2Command,
        PutObjectAclCommand: s3Module.PutObjectAclCommand,
        GetObjectAclCommand: s3Module.GetObjectAclCommand,
        getSignedUrl: presignerModule.getSignedUrl,
        ObjectCannedACL: s3Module.ObjectCannedACL,
        ServerSideEncryption: s3Module.ServerSideEncryption,
      };
      
      this.client = new this.awsSDK.S3Client({
        region: this.config.region,
        endpoint: this.config.endpoint,
        forcePathStyle: this.config.forcePathStyle ?? true,
        credentials: {
          accessKeyId: this.config.accessKeyId,
          secretAccessKey: this.config.secretAccessKey,
        },
      });

      return { client: this.client, sdk: this.awsSDK };
    } catch (error) {
      if ((error as any).code === 'MODULE_NOT_FOUND') {
        throw new Error(
          'AWS SDK not found. Please install it with:\n' +
          'npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner\n' +
          'or\n' +
          'yarn add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner',
        );
      }
      throw error;
    }
  }

  async uploadFile(options: StorageUploadOptions): Promise<StorageUploadResult> {
    const { client, sdk } = await this.initializeClient();
    const bucket = options.bucket ?? this.config.bucket;
    
    // Validate input - exactly one source should be provided
    const inputCount = [options.filePath, options.stream, options.buffer].filter(Boolean).length;
    if (inputCount !== 1) {
      throw new Error('Exactly one of filePath, stream, or buffer must be provided');
    }

    // Generate key if not provided
    const key = options.key || this.generateKeyFromExternalId(options.external_id, options.filename);

    let body: Buffer | Uint8Array | string | Readable;
    let contentLength: number | undefined;
    let contentType = options.contentType || 'application/octet-stream';

    // Handle different input types
    if (options.buffer) {
      body = options.buffer;
      contentLength = options.buffer.length;
    } else if (options.filePath) {
      body = createReadStream(options.filePath);
      contentLength = options.size;
    } else if (options.stream) {
      if (options.stream instanceof ReadableStream) {
        // Convert Web ReadableStream to Node.js Readable
        body = Readable.fromWeb(options.stream as any);
      } else {
        body = options.stream as Readable;
      }
      contentLength = options.size;
    } else {
      throw new Error('No valid input source provided');
    }

    // Infer content type from filename if not provided
    if (!options.contentType && options.filename) {
      contentType = this.getContentTypeFromFilename(options.filename);
    }

    // Add external_id to metadata
    const metadata = {
      ...options.metadata,
      external_id: options.external_id,
    };

    const command = new sdk.PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      ContentLength: contentLength,
      ACL: this.config.defaultACL as any,
      ServerSideEncryption: this.config.serverSideEncryption as any,
      Metadata: metadata,
    });

    try {
      const result = await client.send(command);
      
      // Generate public URL
      const url = await this.generatePublicUrl(key, options.public);

      return {
        external_id: options.external_id,
        key,
        url,
        size: contentLength || 0,
        contentType,
        etag: result.ETag,
        metadata: options.metadata,
        visibility: options.public ? 'public' : 'private',
        publicUrl: options.public ? this.getPublicUrl(key) : undefined,
      };
    } catch (error) {
      throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteFile(key: string): Promise<void> {
    const { client, sdk } = await this.initializeClient();
    const command = new sdk.DeleteObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
    });

    try {
      await client.send(command);
    } catch (error) {
      throw new Error(`Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getFileUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const { client, sdk } = await this.initializeClient();
    const command = new sdk.GetObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
    });

    try {
      return await sdk.getSignedUrl(client, command, { expiresIn });
    } catch (error) {
      throw new Error(`Failed to generate file URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async fileExists(key: string): Promise<boolean> {
    const { client, sdk } = await this.initializeClient();
    const command = new sdk.HeadObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
    });

    try {
      await client.send(command);
      return true;
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw new Error(`Failed to check file existence: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteFileByExternalId(externalId: string): Promise<void> {
    const fileInfo = await this.findFileByExternalId(externalId);
    if (!fileInfo) {
      throw new Error(`File with external_id ${externalId} not found`);
    }
    await this.deleteFile(fileInfo.key);
  }

  async getFileUrlByExternalId(externalId: string, expiresIn?: number): Promise<string> {
    const fileInfo = await this.findFileByExternalId(externalId);
    if (!fileInfo) {
      throw new Error(`File with external_id ${externalId} not found`);
    }
    return this.getFileUrl(fileInfo.key, expiresIn);
  }

  async fileExistsByExternalId(externalId: string): Promise<boolean> {
    const fileInfo = await this.findFileByExternalId(externalId);
    return !!fileInfo;
  }

  async findFileByExternalId(externalId: string): Promise<StorageFileInfo | null> {
    const { client, sdk } = await this.initializeClient();
    try {
      // List all objects in the bucket and check their metadata
      let continuationToken: string | undefined;
      
      do {
        const listCommand = new sdk.ListObjectsV2Command({
          Bucket: this.config.bucket,
          ContinuationToken: continuationToken,
        });

        const listResult = await client.send(listCommand);
        
        if (listResult.Contents) {
          for (const object of listResult.Contents) {
            if (!object.Key) continue;
            
            try {
              // Get metadata for each object
              const headCommand = new sdk.HeadObjectCommand({
                Bucket: this.config.bucket,
                Key: object.Key,
              });
              
              const headResult = await client.send(headCommand);
              
              // Check if this object has the matching external_id in metadata
              // Note: Some S3-compatible services convert underscores to hyphens in metadata keys
              const externalIdInMetadata = headResult.Metadata?.['external-id'] || headResult.Metadata?.['external_id'];
              if (externalIdInMetadata === externalId) {
                const url = await this.generatePublicUrl(object.Key);
                
                return {
                  external_id: externalId,
                  key: object.Key,
                  url,
                  size: headResult.ContentLength || 0,
                  contentType: headResult.ContentType || 'application/octet-stream',
                  lastModified: headResult.LastModified,
                  etag: headResult.ETag,
                  metadata: headResult.Metadata,
                };
              }
            } catch (_headError: any) {
              // Skip objects that can't be accessed (permissions, etc.)
              continue;
            }
          }
        }
        
        continuationToken = listResult.NextContinuationToken;
      } while (continuationToken);
      
      // File not found
      return null;
    } catch (error: any) {
      throw new Error(`Failed to find file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async generatePublicUrl(key: string, _isPublic?: boolean): Promise<string> {
    // If CDN URL is configured, use it
    if (this.config.cdnUrl) {
      return `${this.config.cdnUrl}/${key}`;
    }

    // If custom public base URL is configured, use it
    if (this.config.publicBaseUrl) {
      return `${this.config.publicBaseUrl}/${key}`;
    }

    // Generate default URL based on configuration
    if (this.config.endpoint) {
      // Custom endpoint (non-AWS)
      if (this.config.forcePathStyle) {
        return `${this.config.endpoint}/${this.config.bucket}/${key}`;
      } else {
        // Virtual hosted-style
        const endpointWithoutProtocol = this.config.endpoint.replace(/^https?:\/\//, '');
        const protocol = this.config.useSSL !== false ? 'https' : 'http';
        return `${protocol}://${this.config.bucket}.${endpointWithoutProtocol}/${key}`;
      }
    } else {
      // AWS S3 default
      if (this.config.forcePathStyle) {
        return `https://s3.${this.config.region}.amazonaws.com/${this.config.bucket}/${key}`;
      } else {
        return `https://${this.config.bucket}.s3.${this.config.region}.amazonaws.com/${key}`;
      }
    }
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

  private generateKeyFromExternalId(externalId: string, filename?: string): string {
    const timestamp = Date.now();
    const extension = filename ? filename.split('.').pop() : '';
    const ext = extension ? `.${extension}` : '';
    return `files/${externalId}-${timestamp}${ext}`;
  }

  async listFiles(_options?: ListFilesOptions): Promise<ListFilesResult> {
    throw new Error('listFiles not yet implemented for S3CompatibleProvider');
  }

  async searchFiles(_options: SearchFilesOptions): Promise<SearchFilesResult> {
    throw new Error('searchFiles not yet implemented for S3CompatibleProvider');
  }

  // File visibility management
  async setFileVisibility(key: string, visibility: 'public' | 'private'): Promise<FileVisibilityResult> {
    const { client, sdk } = await this.initializeClient();
    try {
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

      const acl = visibility === 'public' ? 'public-read' : 'private';
      
      const command = new sdk.PutObjectAclCommand({
        Bucket: this.config.bucket,
        Key: key,
        ACL: acl,
      });

      await client.send(command);

      if (visibility === 'public') {
        const publicUrl = this.getPublicUrl(key);
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
        return {
          success: true,
          requestedVisibility: 'private',
          actualVisibility: 'private',
          message: 'File is now private and requires authentication.',
        };
      }
    } catch (error) {
      // Handle cases where ACLs are disabled (modern AWS S3)
      if ((error as any).Code === 'InvalidRequest' || (error as any).message?.includes('ACL')) {
        return {
          success: false,
          requestedVisibility: visibility,
          actualVisibility: 'private',
          message: 'ACLs are disabled on this bucket. Use bucket policies for access control instead.',
        };
      }
      
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
    const { client, sdk } = await this.initializeClient();
    try {
      // Check if file exists
      const exists = await this.fileExists(key);
      if (!exists) {
        throw new Error(`File with key ${key} not found`);
      }

      // Try to get object ACL
      try {
        const command = new sdk.GetObjectAclCommand({
          Bucket: this.config.bucket,
          Key: key,
        });

        const response = await client.send(command);
        
        // Check if AllUsers or AuthenticatedUsers has read permission
        const hasPublicAccess = response.Grants?.some((grant: any) => 
          (grant.Grantee?.URI === 'http://acs.amazonaws.com/groups/global/AllUsers' ||
           grant.Grantee?.URI === 'http://acs.amazonaws.com/groups/global/AuthenticatedUsers') &&
          grant.Permission === 'READ',
        );

        if (hasPublicAccess) {
          const publicUrl = this.getPublicUrl(key);
          return {
            visibility: 'public',
            publicUrl,
            canMakePublic: true,
            canMakePrivate: true,
            supportsTemporaryAccess: true,
            message: 'File is publicly accessible via direct URL.',
          };
        }
      } catch (error) {
        // If ACL check fails, assume private (might be ACLs disabled)
        if ((error as any).Code === 'InvalidRequest') {
          return {
            visibility: 'private',
            canMakePublic: false,
            canMakePrivate: false,
            supportsTemporaryAccess: true,
            message: 'ACLs are disabled on this bucket. File visibility managed by bucket policies.',
          };
        }
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

  private getPublicUrl(key: string): string {
    if (this.config.publicBaseUrl) {
      return `${this.config.publicBaseUrl}/${key}`;
    } else if (this.config.cdnUrl) {
      return `${this.config.cdnUrl}/${key}`;
    } else if (this.config.endpoint) {
      // Custom endpoint (like DigitalOcean Spaces)
      const endpointUrl = this.config.endpoint.replace(/^https?:\/\//, '');
      return `https://${this.config.bucket}.${endpointUrl}/${key}`;
    } else {
      // Default AWS S3 URL
      return `https://${this.config.bucket}.s3.${this.config.region}.amazonaws.com/${key}`;
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const awsPackage = '@aws-sdk/client-s3'.split('').join('');
      await import(awsPackage);
      return true;
    } catch {
      return false;
    }
  }
}