import { LocalStorageProvider as LocalStorageDirectoryProvider } from '../../../../src/services/storage/providers/localstorage';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';

describe('LocalStorageDirectoryProvider', () => {
  let provider: LocalStorageDirectoryProvider;
  let testDir: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    originalEnv = { ...process.env };
    
    testDir = join(tmpdir(), `localstorage-test-${randomBytes(8).toString('hex')}`);
    process.env.CRUNCHYCONE_LOCALSTORAGE_PATH = testDir;
    process.env.CRUNCHYCONE_LOCALSTORAGE_BASE_URL = '/test-storage';
    
    await fs.mkdir(testDir, { recursive: true });
    provider = new LocalStorageDirectoryProvider();
  });

  afterEach(async () => {
    process.env = originalEnv;
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (_error) {
      // Ignore cleanup errors
    }
  });

  describe('Constructor', () => {
    test('should throw error when LOCALSTORAGE_PATH environment variable is missing', () => {
      delete process.env.CRUNCHYCONE_LOCALSTORAGE_PATH;
      expect(() => new LocalStorageDirectoryProvider()).toThrow('CRUNCHYCONE_LOCALSTORAGE_PATH environment variable is required but not configured');
    });

    test('should create provider when LOCALSTORAGE_PATH is set', () => {
      expect(() => new LocalStorageDirectoryProvider()).not.toThrow();
    });

    test('should use default base URL when LOCALSTORAGE_BASE_URL is not set', () => {
      delete process.env.CRUNCHYCONE_LOCALSTORAGE_BASE_URL;
      expect(() => new LocalStorageDirectoryProvider()).not.toThrow();
    });
  });

  describe('uploadFile', () => {
    test('should upload file from buffer', async () => {
      const buffer = Buffer.from('test file content');
      const options = {
        external_id: 'test-file-1',
        buffer,
        filename: 'test.txt',
        contentType: 'text/plain',
      };

      const result = await provider.uploadFile(options);

      expect(result.external_id).toBe('test-file-1');
      expect(result.size).toBe(buffer.length);
      expect(result.contentType).toBe('text/plain');
      expect(result.url).toMatch(/^\/test-storage\/files\/test-file-1-\d+\.txt$/);

      // Verify file exists
      const fileExists = await provider.fileExists(result.key);
      expect(fileExists).toBe(true);

      // Verify metadata file exists
      const metadataPath = join(testDir, `${result.key}.json`);
      const metadataExists = await fs.access(metadataPath).then(() => true).catch(() => false);
      expect(metadataExists).toBe(true);

      // Verify metadata content
      const metadataContent = await fs.readFile(metadataPath, 'utf-8');
      const metadata = JSON.parse(metadataContent);
      expect(metadata.external_id).toBe('test-file-1');
      expect(metadata.key).toBe(result.key);
      expect(metadata.contentType).toBe('text/plain');
      expect(metadata.size).toBe(buffer.length);
    });

    test('should upload file from file path', async () => {
      const sourceFile = join(testDir, 'source.txt');
      const content = 'source file content';
      await fs.writeFile(sourceFile, content);

      const options = {
        external_id: 'test-file-2',
        filePath: sourceFile,
        filename: 'uploaded.txt',
      };

      const result = await provider.uploadFile(options);

      expect(result.external_id).toBe('test-file-2');
      expect(result.size).toBe(content.length);
      expect(result.contentType).toBe('text/plain');

      // Verify file content
      const uploadedContent = await fs.readFile(join(testDir, result.key), 'utf-8');
      expect(uploadedContent).toBe(content);
    });

    test('should upload file from stream', async () => {
      const { Readable } = await import('stream');
      const content = 'stream content';
      const stream = Readable.from([content]);

      const options = {
        external_id: 'test-file-3',
        stream,
        filename: 'stream.txt',
      };

      const result = await provider.uploadFile(options);

      expect(result.external_id).toBe('test-file-3');
      expect(result.contentType).toBe('text/plain');

      // Verify file content
      const uploadedContent = await fs.readFile(join(testDir, result.key), 'utf-8');
      expect(uploadedContent).toBe(content);
    });

    test('should generate key when not provided', async () => {
      const buffer = Buffer.from('test');
      const options = {
        external_id: 'test-file-4',
        buffer,
        filename: 'test.txt',
      };

      const result = await provider.uploadFile(options);
      expect(result.key).toMatch(/^files\/test-file-4-\d+\.txt$/);
    });

    test('should use provided key', async () => {
      const buffer = Buffer.from('test');
      const options = {
        external_id: 'test-file-5',
        key: 'custom/path/file.txt',
        buffer,
      };

      const result = await provider.uploadFile(options);
      expect(result.key).toBe('custom/path/file.txt');
    });

    test('should infer content type from filename', async () => {
      const buffer = Buffer.from('test');
      const options = {
        external_id: 'test-file-6',
        buffer,
        filename: 'test.pdf',
      };

      const result = await provider.uploadFile(options);
      expect(result.contentType).toBe('application/pdf');
    });

    test('should throw error when no input source provided', async () => {
      const options = {
        external_id: 'test-file-7',
      };

      await expect(provider.uploadFile(options)).rejects.toThrow('Exactly one of filePath, stream, or buffer must be provided');
    });

    test('should throw error when multiple input sources provided', async () => {
      const options = {
        external_id: 'test-file-8',
        buffer: Buffer.from('test'),
        filePath: '/some/path',
      };

      await expect(provider.uploadFile(options)).rejects.toThrow('Exactly one of filePath, stream, or buffer must be provided');
    });

    test('should clean up on upload failure', async () => {
      const mockWriteFile = jest.spyOn(fs, 'writeFile').mockRejectedValueOnce(new Error('Write failed'));

      const buffer = Buffer.from('test');
      const options = {
        external_id: 'test-file-9',
        buffer,
      };

      await expect(provider.uploadFile(options)).rejects.toThrow('Failed to upload file: Write failed');

      mockWriteFile.mockRestore();
    });
  });

  describe('deleteFile', () => {
    test('should delete file and metadata', async () => {
      const buffer = Buffer.from('test');
      const options = {
        external_id: 'delete-test-1',
        buffer,
      };

      const result = await provider.uploadFile(options);
      
      // Verify file exists
      expect(await provider.fileExists(result.key)).toBe(true);

      await provider.deleteFile(result.key);

      // Verify file and metadata are deleted
      expect(await provider.fileExists(result.key)).toBe(false);
      const metadataPath = join(testDir, `${result.key}.json`);
      const metadataExists = await fs.access(metadataPath).then(() => true).catch(() => false);
      expect(metadataExists).toBe(false);
    });

    test('should not throw when deleting non-existent file', async () => {
      await expect(provider.deleteFile('non-existent.txt')).resolves.not.toThrow();
    });
  });

  describe('deleteFileByExternalId', () => {
    test('should delete file by external ID', async () => {
      const buffer = Buffer.from('test');
      const options = {
        external_id: 'delete-test-2',
        buffer,
      };

      await provider.uploadFile(options);
      
      expect(await provider.fileExistsByExternalId('delete-test-2')).toBe(true);

      await provider.deleteFileByExternalId('delete-test-2');

      expect(await provider.fileExistsByExternalId('delete-test-2')).toBe(false);
    });

    test('should throw error when external ID not found', async () => {
      await expect(provider.deleteFileByExternalId('non-existent')).rejects.toThrow('File with external_id "non-existent" not found');
    });
  });

  describe('getFileUrl', () => {
    test('should return correct URL', async () => {
      const url = await provider.getFileUrl('test/file.txt');
      expect(url).toBe('/test-storage/test/file.txt');
    });

    test('should ignore expiresIn parameter', async () => {
      const url = await provider.getFileUrl('test/file.txt', 3600);
      expect(url).toBe('/test-storage/test/file.txt');
    });
  });

  describe('getFileUrlByExternalId', () => {
    test('should return URL for existing file', async () => {
      const buffer = Buffer.from('test');
      const options = {
        external_id: 'url-test-1',
        buffer,
      };

      const result = await provider.uploadFile(options);
      const url = await provider.getFileUrlByExternalId('url-test-1');
      
      expect(url).toBe(result.url);
    });

    test('should throw error when external ID not found', async () => {
      await expect(provider.getFileUrlByExternalId('non-existent')).rejects.toThrow('File with external_id "non-existent" not found');
    });
  });

  describe('fileExists', () => {
    test('should return true for existing file', async () => {
      const buffer = Buffer.from('test');
      const options = {
        external_id: 'exists-test-1',
        buffer,
      };

      const result = await provider.uploadFile(options);
      expect(await provider.fileExists(result.key)).toBe(true);
    });

    test('should return false for non-existent file', async () => {
      expect(await provider.fileExists('non-existent.txt')).toBe(false);
    });
  });

  describe('fileExistsByExternalId', () => {
    test('should return true for existing file', async () => {
      const buffer = Buffer.from('test');
      const options = {
        external_id: 'exists-test-2',
        buffer,
      };

      await provider.uploadFile(options);
      expect(await provider.fileExistsByExternalId('exists-test-2')).toBe(true);
    });

    test('should return false for non-existent file', async () => {
      expect(await provider.fileExistsByExternalId('non-existent')).toBe(false);
    });
  });

  describe('findFileByExternalId', () => {
    test('should return file info for existing file', async () => {
      const buffer = Buffer.from('test content');
      const options = {
        external_id: 'find-test-1',
        buffer,
        filename: 'test.txt',
        contentType: 'text/plain',
        metadata: { custom: 'value' },
      };

      const uploadResult = await provider.uploadFile(options);
      const fileInfo = await provider.findFileByExternalId('find-test-1');

      expect(fileInfo).not.toBeNull();
      expect(fileInfo!.external_id).toBe('find-test-1');
      expect(fileInfo!.key).toBe(uploadResult.key);
      expect(fileInfo!.url).toBe(uploadResult.url);
      expect(fileInfo!.size).toBe(buffer.length);
      expect(fileInfo!.contentType).toBe('text/plain');
      expect(fileInfo!.metadata).toEqual({ custom: 'value' });
      expect(fileInfo!.lastModified).toBeInstanceOf(Date);
    });

    test('should return null for non-existent file', async () => {
      const fileInfo = await provider.findFileByExternalId('non-existent');
      expect(fileInfo).toBeNull();
    });

    test('should clean up metadata when file is missing', async () => {
      const buffer = Buffer.from('test');
      const options = {
        external_id: 'cleanup-test-1',
        buffer,
      };

      const uploadResult = await provider.uploadFile(options);
      
      // Delete file but leave metadata
      await fs.unlink(join(testDir, uploadResult.key));
      
      const fileInfo = await provider.findFileByExternalId('cleanup-test-1');
      expect(fileInfo).toBeNull();

      // Verify metadata was cleaned up
      const metadataPath = join(testDir, `${uploadResult.key}.json`);
      const metadataExists = await fs.access(metadataPath).then(() => true).catch(() => false);
      expect(metadataExists).toBe(false);
    });

    test('should handle invalid metadata files gracefully', async () => {
      // Create invalid metadata file
      const invalidMetadataPath = join(testDir, 'invalid.json');
      await fs.writeFile(invalidMetadataPath, 'invalid json');

      const fileInfo = await provider.findFileByExternalId('any-id');
      expect(fileInfo).toBeNull();
    });
  });

  describe('content type detection', () => {
    const testCases = [
      { filename: 'test.jpg', expectedType: 'image/jpeg' },
      { filename: 'test.jpeg', expectedType: 'image/jpeg' },
      { filename: 'test.png', expectedType: 'image/png' },
      { filename: 'test.gif', expectedType: 'image/gif' },
      { filename: 'test.pdf', expectedType: 'application/pdf' },
      { filename: 'test.txt', expectedType: 'text/plain' },
      { filename: 'test.json', expectedType: 'application/json' },
      { filename: 'test.unknown', expectedType: 'application/octet-stream' },
    ];

    testCases.forEach(({ filename, expectedType }) => {
      test(`should detect ${expectedType} for ${filename}`, async () => {
        const buffer = Buffer.from('test');
        const options = {
          external_id: `type-test-${filename}`,
          buffer,
          filename,
        };

        const result = await provider.uploadFile(options);
        expect(result.contentType).toBe(expectedType);
      });
    });
  });

  describe('directory structure', () => {
    test('should create nested directories', async () => {
      const buffer = Buffer.from('test');
      const options = {
        external_id: 'nested-test-1',
        key: 'deep/nested/path/file.txt',
        buffer,
      };

      const result = await provider.uploadFile(options);
      expect(await provider.fileExists(result.key)).toBe(true);

      // Verify directory structure was created
      const dirPath = join(testDir, 'deep/nested/path');
      const dirExists = await fs.access(dirPath).then(() => true).catch(() => false);
      expect(dirExists).toBe(true);
    });
  });

  describe('multiple files with same external_id', () => {
    test('should handle metadata scanning with multiple files', async () => {
      // Upload multiple files
      for (let i = 0; i < 3; i++) {
        const buffer = Buffer.from(`test content ${i}`);
        const options = {
          external_id: `multi-test-${i}`,
          buffer,
          filename: `test-${i}.txt`,
        };
        await provider.uploadFile(options);
      }

      // Verify each can be found
      for (let i = 0; i < 3; i++) {
        const fileInfo = await provider.findFileByExternalId(`multi-test-${i}`);
        expect(fileInfo).not.toBeNull();
        expect(fileInfo!.external_id).toBe(`multi-test-${i}`);
      }
    });
  });
});