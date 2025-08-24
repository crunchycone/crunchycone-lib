import { S3CompatibleProvider } from './s3-compatible';
import { S3Config } from '../types';

export interface DigitalOceanSpacesConfig {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;        // nyc1, nyc3, ams3, sgp1, sfo2, fra1
  bucket: string;        // Space name
  cdnEndpoint?: string;  // Optional CDN endpoint
}

export class DigitalOceanSpacesProvider extends S3CompatibleProvider {
  constructor(config: DigitalOceanSpacesConfig) {
    const s3Config: S3Config = {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      region: 'us-east-1', // AWS SDK requires a valid AWS region for DigitalOcean Spaces
      bucket: config.bucket,
      endpoint: `https://${config.region}.digitaloceanspaces.com`,
      forcePathStyle: false, // DO Spaces uses virtual hosted-style
      publicBaseUrl: `https://${config.bucket}.${config.region}.digitaloceanspaces.com`,
      cdnUrl: config.cdnEndpoint,
      useSSL: true,
      signatureVersion: 'v4',
      defaultACL: 'private',
    };
    
    super(s3Config);
  }
}