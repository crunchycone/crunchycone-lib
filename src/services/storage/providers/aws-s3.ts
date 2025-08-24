import { S3CompatibleProvider } from './s3-compatible';
import { S3Config } from '../types';

export interface AWSS3Config {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  bucket: string;
  cloudFrontDomain?: string;
}

export class AWSS3Provider extends S3CompatibleProvider {
  constructor(config: AWSS3Config) {
    const s3Config: S3Config = {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      region: config.region,
      bucket: config.bucket,
      forcePathStyle: false, // AWS S3 uses virtual hosted-style
      publicBaseUrl: `https://${config.bucket}.s3.${config.region}.amazonaws.com`,
      cdnUrl: config.cloudFrontDomain ? `https://${config.cloudFrontDomain}` : undefined,
      useSSL: true,
      signatureVersion: 'v4',
      defaultACL: 'private',
      serverSideEncryption: 'AES256',
    };
    
    super(s3Config);
  }
}