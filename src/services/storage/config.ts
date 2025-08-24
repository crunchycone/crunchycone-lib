import { setStorageProvider } from './storage';
import { LocalStorageProvider } from './providers/localstorage';
import { S3CompatibleProvider } from './providers/s3-compatible';
import { AWSS3Provider } from './providers/aws-s3';
import { DigitalOceanSpacesProvider } from './providers/digitalocean';
import { WasabiProvider } from './providers/wasabi';
import { BackblazeB2Provider } from './providers/backblaze';
import { CloudflareR2Provider } from './providers/r2';
import { CrunchyConeProvider } from './providers/crunchycone';
import { StorageProviderType } from './types';

export function initializeStorageProvider(): void {
  const provider = (process.env.CRUNCHYCONE_STORAGE_PROVIDER || 'localstorage') as StorageProviderType;

  switch (provider.toLowerCase()) {
    case 'localstorage':
      // Set default environment variables if not provided
      if (!process.env.CRUNCHYCONE_LOCALSTORAGE_PATH) {
        process.env.CRUNCHYCONE_LOCALSTORAGE_PATH = './uploads';
      }
      if (!process.env.CRUNCHYCONE_LOCALSTORAGE_BASE_URL) {
        process.env.CRUNCHYCONE_LOCALSTORAGE_BASE_URL = '/uploads';
      }
      setStorageProvider(new LocalStorageProvider());
      break;

    case 'aws':
    case 's3':
      setStorageProvider(createAWSS3Provider());
      break;

    case 'digitalocean':
      setStorageProvider(createDigitalOceanProvider());
      break;

    case 'wasabi':
      setStorageProvider(createWasabiProvider());
      break;

    case 'backblaze':
      setStorageProvider(createBackblazeProvider());
      break;

    case 'r2':
      setStorageProvider(createCloudflareR2Provider());
      break;

    case 's3-custom':
      setStorageProvider(createCustomS3Provider());
      break;

    case 'crunchycone':
      setStorageProvider(createCrunchyConeProvider());
      break;

    default:
      console.warn(`Unknown storage provider: ${provider}. Falling back to localstorage.`);
      // Set default environment variables if not provided
      if (!process.env.CRUNCHYCONE_LOCALSTORAGE_PATH) {
        process.env.CRUNCHYCONE_LOCALSTORAGE_PATH = './uploads';
      }
      if (!process.env.CRUNCHYCONE_LOCALSTORAGE_BASE_URL) {
        process.env.CRUNCHYCONE_LOCALSTORAGE_BASE_URL = '/uploads';
      }
      setStorageProvider(new LocalStorageProvider());
      break;
  }
}

function createAWSS3Provider(): AWSS3Provider {
  const requiredEnvVars = [
    'CRUNCHYCONE_AWS_ACCESS_KEY_ID',
    'CRUNCHYCONE_AWS_SECRET_ACCESS_KEY',
    'CRUNCHYCONE_AWS_REGION',
    'CRUNCHYCONE_S3_BUCKET',
  ];

  validateRequiredEnvVars(requiredEnvVars);

  return new AWSS3Provider({
    accessKeyId: process.env.CRUNCHYCONE_AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CRUNCHYCONE_AWS_SECRET_ACCESS_KEY!,
    region: process.env.CRUNCHYCONE_AWS_REGION!,
    bucket: process.env.CRUNCHYCONE_S3_BUCKET!,
    cloudFrontDomain: process.env.CRUNCHYCONE_CLOUDFRONT_DOMAIN,
  });
}

function createDigitalOceanProvider(): DigitalOceanSpacesProvider {
  const requiredEnvVars = [
    'CRUNCHYCONE_DIGITALOCEAN_SPACES_KEY',
    'CRUNCHYCONE_DIGITALOCEAN_SPACES_SECRET',
    'CRUNCHYCONE_DIGITALOCEAN_SPACES_REGION',
    'CRUNCHYCONE_DIGITALOCEAN_SPACES_BUCKET',
  ];

  validateRequiredEnvVars(requiredEnvVars);

  return new DigitalOceanSpacesProvider({
    accessKeyId: process.env.CRUNCHYCONE_DIGITALOCEAN_SPACES_KEY!,
    secretAccessKey: process.env.CRUNCHYCONE_DIGITALOCEAN_SPACES_SECRET!,
    region: process.env.CRUNCHYCONE_DIGITALOCEAN_SPACES_REGION!,
    bucket: process.env.CRUNCHYCONE_DIGITALOCEAN_SPACES_BUCKET!,
    cdnEndpoint: process.env.CRUNCHYCONE_DIGITALOCEAN_CDN_ENDPOINT,
  });
}

function createWasabiProvider(): WasabiProvider {
  const requiredEnvVars = [
    'CRUNCHYCONE_WASABI_ACCESS_KEY',
    'CRUNCHYCONE_WASABI_SECRET_KEY',
    'CRUNCHYCONE_WASABI_REGION',
    'CRUNCHYCONE_WASABI_BUCKET',
  ];

  validateRequiredEnvVars(requiredEnvVars);

  return new WasabiProvider({
    accessKeyId: process.env.CRUNCHYCONE_WASABI_ACCESS_KEY!,
    secretAccessKey: process.env.CRUNCHYCONE_WASABI_SECRET_KEY!,
    region: process.env.CRUNCHYCONE_WASABI_REGION!,
    bucket: process.env.CRUNCHYCONE_WASABI_BUCKET!,
  });
}

function createBackblazeProvider(): BackblazeB2Provider {
  const requiredEnvVars = [
    'CRUNCHYCONE_BACKBLAZE_KEY_ID',
    'CRUNCHYCONE_BACKBLAZE_APPLICATION_KEY',
    'CRUNCHYCONE_BACKBLAZE_REGION',
    'CRUNCHYCONE_BACKBLAZE_BUCKET',
  ];

  validateRequiredEnvVars(requiredEnvVars);

  return new BackblazeB2Provider({
    keyId: process.env.CRUNCHYCONE_BACKBLAZE_KEY_ID!,
    applicationKey: process.env.CRUNCHYCONE_BACKBLAZE_APPLICATION_KEY!,
    region: process.env.CRUNCHYCONE_BACKBLAZE_REGION!,
    bucket: process.env.CRUNCHYCONE_BACKBLAZE_BUCKET!,
  });
}

function createCloudflareR2Provider(): CloudflareR2Provider {
  const requiredEnvVars = [
    'CRUNCHYCONE_R2_ACCESS_KEY_ID',
    'CRUNCHYCONE_R2_SECRET_ACCESS_KEY',
    'CRUNCHYCONE_R2_ACCOUNT_ID',
    'CRUNCHYCONE_R2_BUCKET',
  ];

  validateRequiredEnvVars(requiredEnvVars);

  return new CloudflareR2Provider({
    accessKeyId: process.env.CRUNCHYCONE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CRUNCHYCONE_R2_SECRET_ACCESS_KEY!,
    accountId: process.env.CRUNCHYCONE_R2_ACCOUNT_ID!,
    bucket: process.env.CRUNCHYCONE_R2_BUCKET!,
    publicDomain: process.env.CRUNCHYCONE_R2_PUBLIC_DOMAIN,
  });
}

function createCustomS3Provider(): S3CompatibleProvider {
  const requiredEnvVars = [
    'CRUNCHYCONE_S3_ACCESS_KEY_ID',
    'CRUNCHYCONE_S3_SECRET_ACCESS_KEY',
    'CRUNCHYCONE_S3_REGION',
    'CRUNCHYCONE_S3_BUCKET',
  ];

  validateRequiredEnvVars(requiredEnvVars);

  return new S3CompatibleProvider({
    accessKeyId: process.env.CRUNCHYCONE_S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CRUNCHYCONE_S3_SECRET_ACCESS_KEY!,
    region: process.env.CRUNCHYCONE_S3_REGION!,
    bucket: process.env.CRUNCHYCONE_S3_BUCKET!,
    endpoint: process.env.CRUNCHYCONE_S3_ENDPOINT,
    forcePathStyle: process.env.CRUNCHYCONE_S3_FORCE_PATH_STYLE === 'true',
    publicBaseUrl: process.env.CRUNCHYCONE_S3_PUBLIC_BASE_URL,
    cdnUrl: process.env.CRUNCHYCONE_S3_CDN_URL,
    useSSL: process.env.CRUNCHYCONE_S3_USE_SSL !== 'false',
    signatureVersion: (process.env.CRUNCHYCONE_S3_SIGNATURE_VERSION as 'v2' | 'v4') || 'v4',
    defaultACL: process.env.CRUNCHYCONE_S3_DEFAULT_ACL,
    serverSideEncryption: process.env.CRUNCHYCONE_S3_SERVER_SIDE_ENCRYPTION,
  });
}

function createCrunchyConeProvider(): CrunchyConeProvider {
  const requiredEnvVars = [
    'CRUNCHYCONE_API_URL',
    'CRUNCHYCONE_API_KEY',
    'CRUNCHYCONE_PROJECT_ID',
  ];

  validateRequiredEnvVars(requiredEnvVars);

  return new CrunchyConeProvider({
    apiUrl: process.env.CRUNCHYCONE_API_URL!,
    apiKey: process.env.CRUNCHYCONE_API_KEY!,
    projectId: process.env.CRUNCHYCONE_PROJECT_ID!,
    // User ID is inferred from the API key
    timeout: process.env.CRUNCHYCONE_TIMEOUT ? parseInt(process.env.CRUNCHYCONE_TIMEOUT) : undefined,
  });
}

function validateRequiredEnvVars(envVars: string[]): void {
  const missing = envVars.filter(envVar => !process.env[envVar]);
  
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables for storage provider: ${missing.join(', ')}`,
    );
  }
}