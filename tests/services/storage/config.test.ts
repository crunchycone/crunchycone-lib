import { initializeStorageProvider, getStorageProvider, setStorageProvider } from '../../../src/services/storage';
import { LocalStorageProvider } from '../../../src/services/storage/providers/localstorage';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';
import { promises as fs } from 'fs';

describe('Storage Configuration with LocalStorage Provider', () => {
  let testDir: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    originalEnv = { ...process.env };
    testDir = join(tmpdir(), `storage-config-test-${randomBytes(8).toString('hex')}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    process.env = originalEnv;
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (_error) {
      // Ignore cleanup errors
    }
  });

  describe('initializeStorageProvider with localstorage', () => {
    test('should initialize localStorage provider when CRUNCHYCONE_STORAGE_PROVIDER is localstorage', () => {
      process.env.CRUNCHYCONE_STORAGE_PROVIDER = 'localstorage';
      process.env.CRUNCHYCONE_LOCALSTORAGE_PATH = testDir;
      process.env.CRUNCHYCONE_LOCALSTORAGE_BASE_URL = '/test-storage';

      expect(() => initializeStorageProvider()).not.toThrow();
      
      const provider = getStorageProvider();
      expect(provider).toBeInstanceOf(LocalStorageProvider);
    });

    test('should use defaults when localStorage provider is selected but CRUNCHYCONE_LOCALSTORAGE_PATH is missing', () => {
      process.env.CRUNCHYCONE_STORAGE_PROVIDER = 'localstorage';
      delete process.env.CRUNCHYCONE_LOCALSTORAGE_PATH;
      delete process.env.CRUNCHYCONE_LOCALSTORAGE_BASE_URL;

      expect(() => initializeStorageProvider()).not.toThrow();
      
      const provider = getStorageProvider();
      expect(provider).toBeInstanceOf(LocalStorageProvider);
    });

    test('should fall back to localStorage provider for unknown provider types', () => {
      process.env.CRUNCHYCONE_STORAGE_PROVIDER = 'unknown-provider';
      delete process.env.CRUNCHYCONE_LOCALSTORAGE_PATH;
      delete process.env.CRUNCHYCONE_LOCALSTORAGE_BASE_URL;
      
      // Mock console.warn to avoid noise in test output
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      
      expect(() => initializeStorageProvider()).not.toThrow();
      
      const provider = getStorageProvider();
      expect(provider).toBeInstanceOf(LocalStorageProvider);
      expect(consoleSpy).toHaveBeenCalledWith('Unknown storage provider: unknown-provider. Falling back to localstorage.');
      
      consoleSpy.mockRestore();
    });

    test('should use default localStorage provider when no CRUNCHYCONE_STORAGE_PROVIDER is set', () => {
      delete process.env.CRUNCHYCONE_STORAGE_PROVIDER;
      delete process.env.CRUNCHYCONE_LOCALSTORAGE_PATH;
      delete process.env.CRUNCHYCONE_LOCALSTORAGE_BASE_URL;
      
      expect(() => initializeStorageProvider()).not.toThrow();
      
      const provider = getStorageProvider();
      expect(provider).toBeInstanceOf(LocalStorageProvider);
    });
  });

  describe('localStorage provider integration', () => {
    beforeEach(() => {
      process.env.CRUNCHYCONE_STORAGE_PROVIDER = 'localstorage';
      process.env.CRUNCHYCONE_LOCALSTORAGE_PATH = testDir;
      process.env.CRUNCHYCONE_LOCALSTORAGE_BASE_URL = '/integration-test';
      initializeStorageProvider();
    });

    test('should upload and retrieve file through storage interface', async () => {
      const { uploadFile, findFileByExternalId, fileExistsByExternalId, deleteFileByExternalId } = await import('../../../src/services/storage');
      
      const buffer = Buffer.from('integration test content');
      const options = {
        external_id: 'integration-test-1',
        buffer,
        filename: 'integration.txt',
        contentType: 'text/plain',
        metadata: { test: 'integration' },
      };

      // Upload file
      const uploadResult = await uploadFile(options);
      expect(uploadResult.external_id).toBe('integration-test-1');
      expect(uploadResult.size).toBe(buffer.length);
      expect(uploadResult.url).toMatch(/^\/integration-test\/files\/integration-test-1-\d+\.txt$/);

      // Check file exists
      const exists = await fileExistsByExternalId('integration-test-1');
      expect(exists).toBe(true);

      // Find file
      const fileInfo = await findFileByExternalId('integration-test-1');
      expect(fileInfo).not.toBeNull();
      expect(fileInfo!.external_id).toBe('integration-test-1');
      expect(fileInfo!.metadata).toEqual({ test: 'integration' });

      // Delete file
      await deleteFileByExternalId('integration-test-1');
      
      // Verify deletion
      const existsAfterDelete = await fileExistsByExternalId('integration-test-1');
      expect(existsAfterDelete).toBe(false);
    });

    test('should handle file URLs correctly', async () => {
      const { uploadFile, getFileUrlByExternalId } = await import('../../../src/services/storage');
      
      const buffer = Buffer.from('url test');
      const options = {
        external_id: 'url-integration-test',
        buffer,
        filename: 'url-test.txt',
      };

      const uploadResult = await uploadFile(options);
      const url = await getFileUrlByExternalId('url-integration-test');
      
      expect(url).toBe(uploadResult.url);
      expect(url).toMatch(/^\/integration-test\/files\/url-integration-test-\d+\.txt$/);
    });

    test('should throw error when storage provider not initialized', () => {
      // Reset provider
      setStorageProvider(null as any);
      
      const { getStorageProvider } = require('../../../src/services/storage');
      expect(() => getStorageProvider()).toThrow('Storage provider not initialized. Call initializeStorageProvider() first.');
    });
  });

  describe('environment variable handling', () => {
    test('should use CRUNCHYCONE_LOCALSTORAGE_BASE_URL when provided', () => {
      process.env.CRUNCHYCONE_STORAGE_PROVIDER = 'localstorage';
      process.env.CRUNCHYCONE_LOCALSTORAGE_PATH = testDir;
      process.env.CRUNCHYCONE_LOCALSTORAGE_BASE_URL = '/custom-base-url';

      initializeStorageProvider();
      const provider = getStorageProvider() as LocalStorageProvider;
      
      expect(provider.getFileUrl('test.txt')).resolves.toBe('/custom-base-url/test.txt');
    });

    test('should use default base URL when CRUNCHYCONE_LOCALSTORAGE_BASE_URL not provided', () => {
      process.env.CRUNCHYCONE_STORAGE_PROVIDER = 'localstorage';
      process.env.CRUNCHYCONE_LOCALSTORAGE_PATH = testDir;
      delete process.env.CRUNCHYCONE_LOCALSTORAGE_BASE_URL;

      initializeStorageProvider();
      const provider = getStorageProvider() as LocalStorageProvider;
      
      expect(provider.getFileUrl('test.txt')).resolves.toBe('/uploads/test.txt');
    });

    test('should handle base URL with trailing slash', () => {
      process.env.CRUNCHYCONE_STORAGE_PROVIDER = 'localstorage';
      process.env.CRUNCHYCONE_LOCALSTORAGE_PATH = testDir;
      process.env.CRUNCHYCONE_LOCALSTORAGE_BASE_URL = '/custom-url/';

      initializeStorageProvider();
      const provider = getStorageProvider() as LocalStorageProvider;
      
      expect(provider.getFileUrl('test.txt')).resolves.toBe('/custom-url/test.txt');
    });
  });
});