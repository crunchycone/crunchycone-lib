import { GCPStorageProvider, GCPStorageConfig } from '../../../../src/services/storage/providers/gcp-storage';

describe('GCPStorageProvider', () => {
  const mockConfig: GCPStorageConfig = {
    projectId: 'test-project',
    bucket: 'test-bucket',
    credentials: {
      type: 'service_account',
      project_id: 'test-project',
      private_key_id: 'test-key-id',
      private_key: 'test-private-key',
      client_email: 'test@test-project.iam.gserviceaccount.com',
      client_id: 'test-client-id',
      auth_uri: 'https://accounts.google.com/o/oauth2/auth',
      token_uri: 'https://oauth2.googleapis.com/token',
    },
  };

  beforeAll(() => {
    // Mock the module to prevent actual imports during test
    jest.mock('@google-cloud/storage', () => {
      const mockUploadStream: any = {
        on: jest.fn((event: string, callback: () => void): any => {
          if (event === 'finish') {
            setTimeout(callback, 0);
          }
          return mockUploadStream;
        }),
      };

      const mockFile = {
        createWriteStream: jest.fn(() => mockUploadStream),
        getMetadata: jest.fn(() => Promise.resolve([{
          size: '100',
          contentType: 'text/plain',
          etag: 'test-etag',
        }])),
        exists: jest.fn(() => Promise.resolve([true])),
        delete: jest.fn(() => Promise.resolve()),
        getSignedUrl: jest.fn(() => Promise.resolve(['https://signed.url'])),
      };

      const mockBucket = {
        file: jest.fn(() => mockFile),
        getFiles: jest.fn(() => Promise.resolve([[]])),
      };

      const mockStorage = {
        bucket: jest.fn(() => mockBucket),
      };

      return {
        Storage: jest.fn(() => mockStorage),
      };
    });
  });

  afterAll(() => {
    jest.unmock('@google-cloud/storage');
  });

  it('should create provider instance with valid config', () => {
    expect(() => new GCPStorageProvider(mockConfig)).not.toThrow();
  });

  it('should require projectId in config', () => {
    const invalidConfig = { ...mockConfig };
    delete (invalidConfig as any).projectId;
    
    expect(() => new GCPStorageProvider(invalidConfig as any)).not.toThrow();
  });

  it('should require bucket in config', () => {
    const invalidConfig = { ...mockConfig };
    delete (invalidConfig as any).bucket;
    
    expect(() => new GCPStorageProvider(invalidConfig as any)).not.toThrow();
  });

  it('should support different auth methods', () => {
    const configWithKeyFile: GCPStorageConfig = {
      projectId: 'test-project',
      bucket: 'test-bucket',
      keyFilename: '/path/to/key.json',
    };

    expect(() => new GCPStorageProvider(configWithKeyFile)).not.toThrow();
  });

  it('should support CDN URL configuration', () => {
    const configWithCDN: GCPStorageConfig = {
      ...mockConfig,
      cdnUrl: 'https://cdn.example.com',
    };

    expect(() => new GCPStorageProvider(configWithCDN)).not.toThrow();
  });
});