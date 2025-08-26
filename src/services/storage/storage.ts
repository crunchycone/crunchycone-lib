import { 
  StorageProvider, 
  StorageProviderType,
  StorageUploadOptions, 
  StorageUploadResult, 
  StorageFileInfo,
  ListFilesOptions,
  ListFilesResult,
  SearchFilesOptions,
  SearchFilesResult,
} from './types';

// Cache for provider availability to avoid repeated import attempts
const availabilityCache = new Map<StorageProviderType, { available: boolean; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

let storageProvider: StorageProvider | null = null;

export function setStorageProvider(provider: StorageProvider): void {
  storageProvider = provider;
}

export function getStorageProvider(): StorageProvider {
  if (!storageProvider) {
    throw new Error('Storage provider not initialized. Call initializeStorageProvider() first.');
  }
  return storageProvider;
}

export async function uploadFile(options: StorageUploadOptions): Promise<StorageUploadResult> {
  const provider = getStorageProvider();
  return provider.uploadFile(options);
}

export async function deleteFile(key: string): Promise<void> {
  const provider = getStorageProvider();
  return provider.deleteFile(key);
}

export async function deleteFileByExternalId(externalId: string): Promise<void> {
  const provider = getStorageProvider();
  return provider.deleteFileByExternalId(externalId);
}

export async function getFileUrl(key: string, expiresIn?: number): Promise<string> {
  const provider = getStorageProvider();
  return provider.getFileUrl(key, expiresIn);
}

export async function getFileUrlByExternalId(externalId: string, expiresIn?: number): Promise<string> {
  const provider = getStorageProvider();
  return provider.getFileUrlByExternalId(externalId, expiresIn);
}

export async function fileExists(key: string): Promise<boolean> {
  const provider = getStorageProvider();
  return provider.fileExists(key);
}

export async function fileExistsByExternalId(externalId: string): Promise<boolean> {
  const provider = getStorageProvider();
  return provider.fileExistsByExternalId(externalId);
}

export async function findFileByExternalId(externalId: string): Promise<StorageFileInfo | null> {
  const provider = getStorageProvider();
  return provider.findFileByExternalId(externalId);
}

export async function listFiles(options?: ListFilesOptions): Promise<ListFilesResult> {
  const provider = getStorageProvider();
  return provider.listFiles(options);
}

export async function searchFiles(options: SearchFilesOptions): Promise<SearchFilesResult> {
  const provider = getStorageProvider();
  return provider.searchFiles(options);
}

/**
 * Check if a specific storage provider is available (has required dependencies)
 */
export async function isStorageProviderAvailable(providerType: StorageProviderType): Promise<boolean> {
  // Check cache first
  const cached = availabilityCache.get(providerType);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.available;
  }

  let available: boolean;

  switch (providerType) {
    case 'localstorage':
    case 'crunchycone':
      // These providers have no optional dependencies
      available = true;
      break;

    case 'aws':
    case 's3':
    case 'digitalocean':
    case 'wasabi':
    case 'backblaze':
    case 'r2':
    case 's3-custom':
      try {
        const awsPackage = '@aws-sdk/client-s3'.split('').join('');
        await import(awsPackage);
        available = true;
      } catch {
        available = false;
      }
      break;

    case 'gcp':
      try {
        const gcpPackage = '@google-cloud/storage'.split('').join('');
        await import(gcpPackage);
        available = true;
      } catch {
        available = false;
      }
      break;

    case 'azure':
      try {
        const azurePackage = '@azure/storage-blob'.split('').join('');
        await import(azurePackage);
        available = true;
      } catch {
        available = false;
      }
      break;

    default:
      available = false;
  }

  // Cache the result
  availabilityCache.set(providerType, { available, timestamp: Date.now() });
  
  return available;
}

/**
 * Get list of all available storage provider types
 */
export async function getAvailableStorageProviders(): Promise<StorageProviderType[]> {
  const allProviders: StorageProviderType[] = [
    'localstorage', 'crunchycone', 'aws', 's3', 'digitalocean', 
    'wasabi', 'backblaze', 'r2', 's3-custom', 'gcp', 'azure'
  ];
  const availableProviders: StorageProviderType[] = [];

  for (const provider of allProviders) {
    if (await isStorageProviderAvailable(provider)) {
      availableProviders.push(provider);
    }
  }

  return availableProviders;
}