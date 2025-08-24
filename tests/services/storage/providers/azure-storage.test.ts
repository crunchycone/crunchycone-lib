import { AzureStorageProvider, AzureStorageConfig } from '../../../../src/services/storage/providers/azure-storage';

describe('AzureStorageProvider', () => {
  const mockConfig: AzureStorageConfig = {
    accountName: 'testaccount',
    accountKey: 'test-account-key',
    containerName: 'test-container',
  };

  beforeAll(() => {
    // Mock the module to prevent actual imports during test
    jest.mock('@azure/storage-blob', () => {
      const mockBlockBlobClient = {
        upload: jest.fn(() => Promise.resolve({ etag: 'test-etag' })),
        uploadStream: jest.fn(() => Promise.resolve({ etag: 'test-etag' })),
        delete: jest.fn(() => Promise.resolve()),
        getProperties: jest.fn(() => Promise.resolve({
          contentLength: 100,
          contentType: 'text/plain',
        })),
        url: 'https://testaccount.blob.core.windows.net/test-container/test-key',
      };

      const mockContainerClient = {
        getBlockBlobClient: jest.fn(() => mockBlockBlobClient),
        listBlobsFlat: jest.fn(() => []),
      };

      const mockBlobServiceClient = {
        getContainerClient: jest.fn(() => mockContainerClient),
      };

      return {
        BlobServiceClient: class MockBlobServiceClient {
          constructor() {
            return mockBlobServiceClient;
          }
          static fromConnectionString() {
            return mockBlobServiceClient;
          }
        },
        StorageSharedKeyCredential: class MockStorageSharedKeyCredential {
          constructor(_accountName: string, _accountKey: string) {
            return {};
          }
        },
      };
    });
  });

  afterAll(() => {
    jest.unmock('@azure/storage-blob');
  });

  it('should create provider instance with valid config', () => {
    expect(() => new AzureStorageProvider(mockConfig)).not.toThrow();
  });

  it('should support connection string auth', () => {
    const configWithConnectionString: AzureStorageConfig = {
      accountName: 'testaccount',
      connectionString: 'DefaultEndpointsProtocol=https;AccountName=testaccount;AccountKey=test-key',
      containerName: 'test-container',
    };

    expect(() => new AzureStorageProvider(configWithConnectionString)).not.toThrow();
  });

  it('should support SAS token auth', () => {
    const configWithSAS: AzureStorageConfig = {
      accountName: 'testaccount',
      sasToken: '?sv=2021-06-08&ss=b&srt=sco&sp=rwdlacupx&se=2023-01-01T00:00:00Z&st=2022-01-01T00:00:00Z&spr=https&sig=test',
      containerName: 'test-container',
    };

    expect(() => new AzureStorageProvider(configWithSAS)).not.toThrow();
  });

  it('should support CDN URL configuration', () => {
    const configWithCDN: AzureStorageConfig = {
      ...mockConfig,
      cdnUrl: 'https://cdn.example.com',
    };

    expect(() => new AzureStorageProvider(configWithCDN)).not.toThrow();
  });

  it('should require accountName in config', () => {
    const invalidConfig = { ...mockConfig };
    delete (invalidConfig as any).accountName;
    
    expect(() => new AzureStorageProvider(invalidConfig as any)).not.toThrow();
  });

  it('should require containerName in config', () => {
    const invalidConfig = { ...mockConfig };
    delete (invalidConfig as any).containerName;
    
    expect(() => new AzureStorageProvider(invalidConfig as any)).not.toThrow();
  });
});