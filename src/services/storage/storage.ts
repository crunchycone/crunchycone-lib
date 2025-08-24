import { 
  StorageProvider, 
  StorageUploadOptions, 
  StorageUploadResult, 
  StorageFileInfo,
  ListFilesOptions,
  ListFilesResult,
  SearchFilesOptions,
  SearchFilesResult,
} from './types';

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