import { S3CompatibleProvider } from './s3-compatible';
import { S3Config } from '../types';

export interface BackblazeB2Config {
  keyId: string;
  applicationKey: string;
  region: string;
  bucket: string;
}

export class BackblazeB2Provider extends S3CompatibleProvider {
  constructor(config: BackblazeB2Config) {
    const s3Config: S3Config = {
      accessKeyId: config.keyId,
      secretAccessKey: config.applicationKey,
      region: config.region,
      bucket: config.bucket,
      endpoint: `https://s3.${config.region}.backblazeb2.com`,
      forcePathStyle: true,
      publicBaseUrl: `https://s3.${config.region}.backblazeb2.com/${config.bucket}`,
      useSSL: true,
      signatureVersion: 'v4',
      defaultACL: 'private',
    };
    
    super(s3Config);
  }
}