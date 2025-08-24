import { S3CompatibleProvider } from './s3-compatible';
import { S3Config } from '../types';

export interface CloudflareR2Config {
  accessKeyId: string;
  secretAccessKey: string;
  accountId: string;
  bucket: string;
  publicDomain?: string;
}

export class CloudflareR2Provider extends S3CompatibleProvider {
  constructor(config: CloudflareR2Config) {
    const s3Config: S3Config = {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      region: 'auto', // R2 uses 'auto' for region
      bucket: config.bucket,
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      forcePathStyle: true,
      publicBaseUrl: config.publicDomain 
        ? `https://${config.publicDomain}`
        : `https://${config.bucket}.${config.accountId}.r2.dev`,
      useSSL: true,
      signatureVersion: 'v4',
      defaultACL: 'private',
    };
    
    super(s3Config);
  }
}