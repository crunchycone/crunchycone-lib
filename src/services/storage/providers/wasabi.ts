import { S3CompatibleProvider } from './s3-compatible';
import { S3Config } from '../types';

export interface WasabiConfig {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  bucket: string;
}

export class WasabiProvider extends S3CompatibleProvider {
  constructor(config: WasabiConfig) {
    const s3Config: S3Config = {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      region: config.region,
      bucket: config.bucket,
      endpoint: `https://s3.${config.region}.wasabisys.com`,
      forcePathStyle: true,
      publicBaseUrl: `https://s3.${config.region}.wasabisys.com/${config.bucket}`,
      useSSL: true,
      signatureVersion: 'v4',
      defaultACL: 'private',
    };
    
    super(s3Config);
  }
}