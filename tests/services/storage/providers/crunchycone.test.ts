import { CrunchyConeProvider, CrunchyConeConfig } from '../../../../src/services/storage/providers/crunchycone';
import { getCrunchyConeAPIKeyWithFallback, getCrunchyConeProjectID } from '../../../../src/auth';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock fs operations for temp file handling
jest.mock('fs', () => ({
  promises: {
    writeFile: jest.fn(() => Promise.resolve()),
    stat: jest.fn(() => Promise.resolve({ size: 100 })),
    unlink: jest.fn(() => Promise.resolve()),
  },
}));

// Mock os operations
jest.mock('os', () => ({
  tmpdir: () => '/tmp',
}));

// Mock path operations
jest.mock('path', () => ({
  join: (...args: string[]) => args.join('/'),
}));

// Mock auth utilities
jest.mock('../../../../src/auth', () => ({
  getCrunchyConeAPIKeyWithFallback: jest.fn(),
  getCrunchyConeAPIURL: jest.fn(() => 'https://api.crunchycone.com'),
  getCrunchyConeProjectID: jest.fn(),
}));

describe('CrunchyConeProvider', () => {
  let provider: CrunchyConeProvider;
  let config: CrunchyConeConfig;

  beforeEach(() => {
    config = {
      apiUrl: 'https://api.crunchycone.com',
      apiKey: 'test-api-key',
      projectId: 'test-project-id',
      userId: 'test-user-id',
      timeout: 5000,
    };
    provider = new CrunchyConeProvider(config);
    mockFetch.mockClear();
    
    // Reset auth mocks to default success values
    (getCrunchyConeAPIKeyWithFallback as jest.Mock).mockResolvedValue('test-api-key');
    (getCrunchyConeProjectID as jest.Mock).mockReturnValue('test-project-id');
    
    // Add default mock response with expected API structure
    mockFetch.mockImplementation(() => Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: () => Promise.resolve({ data: { files: [] } }),
    }));
  });

  describe('constructor', () => {
    it('should create provider with valid config', () => {
      expect(provider).toBeInstanceOf(CrunchyConeProvider);
    });

    it('should throw error if API key is missing during initialization', async () => {
      // Mock auth function to throw error for this test only
      const mockKeychain = getCrunchyConeAPIKeyWithFallback as jest.Mock;
      mockKeychain.mockReset();
      mockKeychain.mockRejectedValue(new Error('CrunchyCone API key not found'));
      
      const providerWithoutKey = new CrunchyConeProvider({ projectId: 'test' });
      
      // Trigger config initialization by calling an async method
      await expect(providerWithoutKey.fileExists('test'))
        .rejects.toThrow('CrunchyCone API key not found');
        
      // Restore default behavior
      mockKeychain.mockResolvedValue('test-api-key');
    });

    it('should throw error if project ID is missing during initialization', async () => {
      // Mock getCrunchyConeProjectID to return null for this test only
      const mockProjectID = getCrunchyConeProjectID as jest.Mock;
      mockProjectID.mockReset();
      mockProjectID.mockReturnValue(null);
      
      const providerWithoutProject = new CrunchyConeProvider({ apiKey: 'test-key' });
      
      // Trigger config initialization by calling an async method  
      await expect(providerWithoutProject.fileExists('test'))
        .rejects.toThrow('CrunchyCone project ID is required');
        
      // Restore default behavior
      mockProjectID.mockReturnValue('test-project-id');
    });
  });

  describe('setUserId', () => {
    it('should set user ID', () => {
      const newProvider = new CrunchyConeProvider({ ...config, userId: undefined });
      newProvider.setUserId('new-user-id');
      // Verify by trying to make a request (which will fail if userId not set)
      expect(() => newProvider.setUserId('new-user-id')).not.toThrow();
    });
  });

  describe('uploadFile', () => {
    const mockFileDescriptor = {
      file_id: 'test-file-id',
      upload_url: 'https://presigned-upload-url.com',
      expires_at: '2025-01-01T12:00:00Z',
    };

    const mockFileMetadata = {
      file_id: 'test-file-id',
      user_id: 'test-user-id',
      project_id: 'test-project-id',
      file_path: 'files/test-external-id-12345.txt',
      original_filename: 'test.txt',
      content_type: 'text/plain',
      expected_file_size: 11,
      actual_file_size: 11,
      storage_key: 'user-123/project-456/files/test-external-id-12345.txt',
      upload_status: 'completed' as const,
      external_id: 'test-external-id',
      metadata: { category: 'test' },
      created_at: '2025-01-01T10:00:00Z',
      updated_at: '2025-01-01T10:05:00Z',
      uploaded_at: '2025-01-01T10:05:00Z',
    };

    beforeEach(() => {
      mockFetch.mockClear();
    });

    it('should upload file from buffer', async () => {
      // Mock successful API responses
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: mockFileDescriptor }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 204,
          json: () => Promise.resolve({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: mockFileMetadata }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ 
            data: { 
              signedUrl: 'https://storage.example.com/signed-url-test-file-id', 
            }, 
          }),
        });

      const buffer = Buffer.from('Hello World');
      const options = {
        external_id: 'test-external-id',
        buffer,
        filename: 'test.txt',
        contentType: 'text/plain',
        metadata: { category: 'test' },
      };

      const result = await provider.uploadFile(options);

      expect(result).toEqual({
        external_id: 'test-external-id',
        key: 'user-123/project-456/files/test-external-id-12345.txt',
        url: 'https://storage.example.com/signed-url-test-file-id',
        size: 11,
        contentType: 'text/plain',
        metadata: { category: 'test' },
        visibility: 'private',
        publicUrl: undefined,
      });

      // Verify API calls
      expect(mockFetch).toHaveBeenCalledTimes(5);
      
      // 1. Create file descriptor
      const firstCall = mockFetch.mock.calls[0];
      expect(firstCall[0]).toBe('https://api.crunchycone.com/api/v1/storage/files');
      expect(firstCall[1].method).toBe('POST');
      expect(firstCall[1].headers).toEqual({
        'X-API-Key': 'test-api-key',
        'Content-Type': 'application/json',
      });
      
      const firstCallBody = JSON.parse(firstCall[1].body);
      expect(firstCallBody.project_id).toBe('test-project-id');
      expect(firstCallBody.file_path).toMatch(/^files\/test-external-id-\d+\.txt$/);
      expect(firstCallBody.original_filename).toBe('test.txt');
      expect(firstCallBody.content_type).toBe('text/plain');
      expect(firstCallBody.file_size).toBe(11);
      expect(firstCallBody.external_id).toBe('test-external-id');
      expect(firstCallBody.visibility).toBe('private'); // Visibility is now top-level
      expect(firstCallBody.metadata).toEqual({ category: 'test' }); // Metadata no longer contains visibility

      // 2. Upload to presigned URL
      expect(mockFetch).toHaveBeenNthCalledWith(2, 'https://presigned-upload-url.com', {
        method: 'PUT',
        body: buffer,
        headers: {
          'Content-Type': 'text/plain',
          'Content-Length': '11',
        },
      });

      // 3. Complete upload
      expect(mockFetch).toHaveBeenNthCalledWith(3, 'https://api.crunchycone.com/api/v1/storage/files/test-file-id/complete', {
        method: 'POST',
        headers: {
          'X-API-Key': 'test-api-key',
          'Content-Type': 'application/json',
        },
        signal: expect.any(AbortSignal),
        body: JSON.stringify({
          actual_file_size: 11,
        }),
      });

      // 4. Get file metadata
      expect(mockFetch).toHaveBeenNthCalledWith(4, 'https://api.crunchycone.com/api/v1/storage/files/test-file-id', {
        headers: {
          'X-API-Key': 'test-api-key',
          'Content-Type': 'application/json',
        },
        signal: expect.any(AbortSignal),
      });
    });

    it('should upload file from stream with size', async () => {
      // Mock successful API responses
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: mockFileDescriptor }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 204,
          json: () => Promise.resolve({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: mockFileMetadata }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ 
            data: { 
              signedUrl: 'https://storage.example.com/signed-url-test-file-id', 
            }, 
          }),
        });

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('Hello World'));
          controller.close();
        },
      });

      const options = {
        external_id: 'test-external-id',
        stream,
        size: 11,
        filename: 'test.txt',
        contentType: 'text/plain',
      };

      await provider.uploadFile(options);

      expect(mockFetch).toHaveBeenCalledTimes(5);
    });

    it('should throw error when no input source provided', async () => {
      const options = {
        external_id: 'test-external-id',
        filename: 'test.txt',
      };

      await expect(provider.uploadFile(options)).rejects.toThrow('Exactly one of filePath, stream, or buffer must be provided');
    });

    it('should throw error when multiple input sources provided', async () => {
      const options = {
        external_id: 'test-external-id',
        buffer: Buffer.from('test'),
        stream: new ReadableStream(),
        filename: 'test.txt',
      };

      await expect(provider.uploadFile(options)).rejects.toThrow('Exactly one of filePath, stream, or buffer must be provided');
    });

    it('should throw error when stream provided without size', async () => {
      const stream = new ReadableStream();
      const options = {
        external_id: 'test-external-id',
        stream,
        filename: 'test.txt',
      };

      await expect(provider.uploadFile(options)).rejects.toThrow('File size must be provided when uploading from stream');
    });

    it('should handle upload failure and throw error', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: mockFileDescriptor }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        });

      const options = {
        external_id: 'test-external-id',
        buffer: Buffer.from('Hello World'),
        filename: 'test.txt',
      };

      await expect(provider.uploadFile(options)).rejects.toThrow('Upload failed for file "test.txt"');
    });
  });

  describe('findFileByExternalId', () => {
    const mockFileMetadata = {
      file_id: 'test-file-id',
      user_id: 'test-user-id',
      project_id: 'test-project-id',
      file_path: 'files/test-external-id-12345.txt',
      original_filename: 'test.txt',
      content_type: 'text/plain',
      expected_file_size: 11,
      actual_file_size: 11,
      storage_key: 'user-123/project-456/files/test-external-id-12345.txt',
      upload_status: 'completed' as const,
      external_id: 'test-external-id',
      metadata: { category: 'test' },
      created_at: '2025-01-01T10:00:00Z',
      updated_at: '2025-01-01T10:05:00Z',
      uploaded_at: '2025-01-01T10:05:00Z',
    };

    it('should find file by external ID', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: mockFileMetadata }),
      });

      const result = await provider.findFileByExternalId('test-external-id');

      expect(result).toEqual({
        external_id: 'test-external-id',
        key: 'user-123/project-456/files/test-external-id-12345.txt',
        url: 'https://api.crunchycone.com/api/v1/storage/files/test-file-id/download',
        size: 11,
        contentType: 'text/plain',
        lastModified: new Date('2025-01-01T10:05:00Z'),
        metadata: { category: 'test' },
        visibility: 'private',
        publicUrl: undefined,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.crunchycone.com/api/v1/storage/files/by-external-id/test-external-id',
        {
          headers: {
            'X-API-Key': 'test-api-key',
            'Content-Type': 'application/json',
          },
          signal: expect.any(AbortSignal),
        },
      );
    });

    it('should return null when file not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Not Found'),
      });

      const result = await provider.findFileByExternalId('non-existent-id');

      expect(result).toBeNull();
    });

    it('should handle file without external_id by using file_id', async () => {
      const metadataWithoutExternalId = { ...mockFileMetadata, external_id: undefined };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: metadataWithoutExternalId }),
      });

      const result = await provider.findFileByExternalId('test-external-id');

      expect(result?.external_id).toBe('test-file-id'); // Should fall back to file_id
    });
  });

  describe('fileExistsByExternalId', () => {
    it('should return true when file exists', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: {
            file_id: 'test-file-id',
            external_id: 'test-external-id',
            upload_status: 'completed',
          },
        }),
      });

      const result = await provider.fileExistsByExternalId('test-external-id');

      expect(result).toBe(true);
    });

    it('should return false when file does not exist', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Not Found'),
      });

      const result = await provider.fileExistsByExternalId('non-existent-id');

      expect(result).toBe(false);
    });
  });

  describe('deleteFileByExternalId', () => {
    it('should delete file by external ID', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      await provider.deleteFileByExternalId('test-external-id');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.crunchycone.com/api/v1/storage/files/by-external-id/test-external-id',
        {
          method: 'DELETE',
          headers: {
            'X-API-Key': 'test-api-key',
            'Content-Type': 'application/json',
          },
          signal: expect.any(AbortSignal),
        },
      );
    });

    it('should handle URL encoding for external ID', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      await provider.deleteFileByExternalId('test-external-id with spaces');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.crunchycone.com/api/v1/storage/files/by-external-id/test-external-id%20with%20spaces',
        expect.any(Object),
      );
    });
  });

  describe('getFileUrlByExternalId', () => {
    it('should return download URL by external ID', async () => {
      // Mock the file metadata response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: {
            file_id: 'test-file-id',
            external_id: 'test-external-id',
            file_path: 'test/path',
            storage_key: 'files/test-external-id.txt',
            content_type: 'text/plain',
            actual_file_size: 100,
            upload_status: 'completed',
            metadata: {},
            uploaded_at: '2023-01-01T00:00:00Z',
          },
        }),
      });

      // Mock the signed URL response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: { signedUrl: 'https://signed-url.example.com/file.txt' },
        }),
      });

      // Mock the signed URL content test
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('test content'),
      });

      const result = await provider.getFileUrlByExternalId('test-external-id');

      expect(result).toBe('https://signed-url.example.com/file.txt');
    });

    it('should handle URL encoding for external ID', async () => {
      // Mock the file metadata response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: {
            file_id: 'test-file-id-2',
            external_id: 'test-external-id with spaces',
            file_path: 'test/path with spaces',
            storage_key: 'files/test-external-id-with-spaces.txt',
            content_type: 'text/plain',
            actual_file_size: 100,
            upload_status: 'completed',
            metadata: {},
            uploaded_at: '2023-01-01T00:00:00Z',
          },
        }),
      });

      // Mock the signed URL response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: { signedUrl: 'https://signed-url.example.com/file-with-spaces.txt' },
        }),
      });

      // Mock the signed URL content test
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('test content'),
      });

      const result = await provider.getFileUrlByExternalId('test-external-id with spaces');

      expect(result).toBe('https://signed-url.example.com/file-with-spaces.txt');
    });
  });

  describe('error handling', () => {
    it('should handle missing API response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}), // Missing 'data' wrapper
      });

      await expect(provider.findFileByExternalId('test-id')).rejects.toThrow('Cannot read properties of undefined');
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      });

      await expect(provider.findFileByExternalId('test-id')).rejects.toThrow('CrunchyCone API error (500 undefined) | URL: https://api.crunchycone.com/api/v1/storage/files/by-external-id/test-id | Method: GET | Response: Internal Server Error');
    });

    it('should handle request timeout', async () => {
      const providerWithShortTimeout = new CrunchyConeProvider({ ...config, timeout: 100 });
      
      mockFetch.mockImplementationOnce((url, options) => new Promise((resolve, reject) => {
        // Simulate abort signal handling
        if (options?.signal) {
          options.signal.addEventListener('abort', () => {
            const abortError = new Error('The operation was aborted.');
            abortError.name = 'AbortError';
            reject(abortError);
          });
        }
        setTimeout(() => resolve({
          ok: true,
          json: () => Promise.resolve({ data: {} }),
        }), 200);
      }));

      await expect(providerWithShortTimeout.findFileByExternalId('test-id')).rejects.toThrow('Request timeout after 100ms');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(provider.findFileByExternalId('test-id')).rejects.toThrow('Network error');
    });
  });

  describe('utility methods', () => {
    it('should generate default path correctly', async () => {
      const mockFileDescriptor = {
        file_id: 'test-file-id',
        upload_url: 'https://presigned-upload-url.com',
        expires_at: '2025-01-01T12:00:00Z',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: mockFileDescriptor }),
      });

      const options = {
        external_id: 'test-external-id',
        buffer: Buffer.from('test'),
        filename: 'document.pdf',
      };

      // We can't directly test the private method, but we can verify the behavior
      // by checking that the generated path includes the external ID and extension
      try {
        await provider.uploadFile(options);
      } catch {
        // Expected to fail due to incomplete mock setup
      }

      const createDescriptorCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(createDescriptorCall[1].body);
      
      expect(requestBody.file_path).toMatch(/^files\/test-external-id-\d+\.pdf$/);
    });

    it('should infer content type from filename', async () => {
      const mockFileDescriptor = {
        file_id: 'test-file-id',
        upload_url: 'https://presigned-upload-url.com',
        expires_at: '2025-01-01T12:00:00Z',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: mockFileDescriptor }),
      });

      const options = {
        external_id: 'test-external-id',
        buffer: Buffer.from('test'),
        filename: 'image.png',
        // No contentType provided
      };

      try {
        await provider.uploadFile(options);
      } catch {
        // Expected to fail due to incomplete mock setup
      }

      const createDescriptorCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(createDescriptorCall[1].body);
      
      expect(requestBody.content_type).toBe('image/png');
    });
  });

  describe('visibility management', () => {
    describe('setFileVisibility', () => {
      it('should set file visibility to public using API endpoint', async () => {
        // Mock finding the file by storage key
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            data: {
              files: [{
                file_id: 'test-file-id',
                storage_key: 'test-key',
                metadata: { existing: 'value' },
                file_path: 'test/path',
                content_type: 'text/plain',
                actual_file_size: 100,
                upload_status: 'completed',
              }],
            },
          }),
        });

        // Mock visibility API endpoint response
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            success: true,
            message: 'File visibility updated successfully',
            data: {
              file: {
                id: 'test-file-id',
                visibility: 'public',
                public_url: 'https://bucket.region.digitaloceanspaces.com/path/to/file.txt',
              },
            },
          }),
        });

        const result = await provider.setFileVisibility('test-key', 'public');

        expect(result.success).toBe(true);
        expect(result.requestedVisibility).toBe('public');
        expect(result.actualVisibility).toBe('public');
        expect(result.publicUrl).toBe('https://bucket.region.digitaloceanspaces.com/path/to/file.txt');
        expect(result.message).toBe('File visibility updated successfully');
        expect(result.providerSpecific).toMatchObject({
          fileId: 'test-file-id',
          updatedViaAPI: true,
        });

        // Verify the API was called with correct endpoint and data
        expect(mockFetch).toHaveBeenLastCalledWith(
          'https://api.crunchycone.com/api/v1/storage/files/test-file-id/visibility',
          {
            method: 'PATCH',
            signal: expect.any(AbortSignal),
            headers: {
              'X-API-Key': 'test-api-key',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ visibility: 'public' }),
          },
        );
      });

      it('should set file visibility to private using API endpoint', async () => {
        // Mock finding the file by storage key
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            data: {
              files: [{
                file_id: 'test-file-id',
                storage_key: 'test-key',
                metadata: { existing: 'value' },
                file_path: 'test/path',
                content_type: 'text/plain',
                actual_file_size: 100,
                upload_status: 'completed',
              }],
            },
          }),
        });

        // Mock visibility API endpoint response
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            success: true,
            message: 'File visibility updated successfully',
            data: {
              file: {
                id: 'test-file-id',
                visibility: 'private',
                public_url: null,
              },
            },
          }),
        });

        const result = await provider.setFileVisibility('test-key', 'private');

        expect(result.success).toBe(true);
        expect(result.requestedVisibility).toBe('private');
        expect(result.actualVisibility).toBe('private');
        expect(result.publicUrl).toBeNull();
        expect(result.message).toBe('File visibility updated successfully');
      });

      it('should handle file not found error', async () => {
        // Mock finding the file - empty result
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            data: {
              files: [],
            },
          }),
        });

        const result = await provider.setFileVisibility('nonexistent-key', 'public');

        expect(result.success).toBe(false);
        expect(result.requestedVisibility).toBe('public');
        expect(result.actualVisibility).toBe('private');
        expect(result.message).toBe('File with key nonexistent-key not found');
      });

      it('should handle API error during visibility update', async () => {
        // Mock finding the file successfully
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            data: {
              files: [{
                file_id: 'test-file-id',
                storage_key: 'test-key',
                metadata: {},
                file_path: 'test/path',
                content_type: 'text/plain',
                actual_file_size: 100,
                upload_status: 'completed',
              }],
            },
          }),
        });

        // Mock API error responses for all endpoints
        mockFetch
          .mockResolvedValueOnce({
            ok: false,
            status: 400,
            statusText: 'Bad Request',
            text: () => Promise.resolve('{"error": "Invalid visibility value"}'),
          })
          .mockResolvedValueOnce({
            ok: false,
            status: 400,
            statusText: 'Bad Request',
            text: () => Promise.resolve('{"error": "Invalid visibility value"}'),
          })
          .mockResolvedValueOnce({
            ok: false,
            status: 400,
            statusText: 'Bad Request',
            text: () => Promise.resolve('{"error": "Invalid visibility value"}'),
          });

        const result = await provider.setFileVisibility('test-key', 'public');

        expect(result.success).toBe(false);
        expect(result.requestedVisibility).toBe('public');
        expect(result.actualVisibility).toBe('private');
        expect(result.message).toContain('Failed to set file visibility');
      });
    });

    describe('setFileVisibilityByExternalId', () => {
      it('should set file visibility to public by external ID', async () => {
        // Mock visibility API endpoint response
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            success: true,
            message: 'File visibility updated successfully',
            data: {
              file: {
                id: 'test-file-id',
                visibility: 'public',
                public_url: 'https://bucket.region.digitaloceanspaces.com/path/to/file.txt',
              },
            },
          }),
        });

        const result = await provider.setFileVisibilityByExternalId('test-external-id', 'public');

        expect(result.success).toBe(true);
        expect(result.requestedVisibility).toBe('public');
        expect(result.actualVisibility).toBe('public');
        expect(result.publicUrl).toBe('https://bucket.region.digitaloceanspaces.com/path/to/file.txt');
        expect(result.message).toBe('File visibility updated successfully');
        expect(result.providerSpecific).toMatchObject({
          externalId: 'test-external-id',
          updatedViaAPI: true,
        });

        // Verify the API was called with correct endpoint
        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.crunchycone.com/api/v1/storage/files/by-external-id/test-external-id/visibility',
          {
            method: 'PATCH',
            signal: expect.any(AbortSignal),
            headers: {
              'X-API-Key': 'test-api-key',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ visibility: 'public' }),
          },
        );
      });

      it('should handle external ID not found error', async () => {
        // Mock 404 error responses for all endpoints
        mockFetch
          .mockResolvedValueOnce({
            ok: false,
            status: 404,
            statusText: 'Not Found',
            text: () => Promise.resolve('{"error": "File not found"}'),
          })
          .mockResolvedValueOnce({
            ok: false,
            status: 404,
            statusText: 'Not Found',
            text: () => Promise.resolve('{"error": "File not found"}'),
          })
          .mockResolvedValueOnce({
            ok: false,
            status: 404,
            statusText: 'Not Found',
            text: () => Promise.resolve('{"error": "File not found"}'),
          });

        const result = await provider.setFileVisibilityByExternalId('nonexistent-id', 'public');

        expect(result.success).toBe(false);
        expect(result.requestedVisibility).toBe('public');
        expect(result.actualVisibility).toBe('private');
        expect(result.message).toBe('File with external_id nonexistent-id not found');
      });
    });

    describe('updateFileVisibilityById', () => {
      it('should update file visibility directly by file ID', async () => {
        // Mock visibility API endpoint response
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            success: true,
            message: 'File visibility updated successfully',
            data: {
              file: {
                id: 'test-file-id',
                visibility: 'public',
                public_url: 'https://bucket.region.digitaloceanspaces.com/path/to/file.txt',
              },
            },
          }),
        });

        const result = await provider.updateFileVisibilityById('test-file-id', 'public');

        expect(result.success).toBe(true);
        expect(result.requestedVisibility).toBe('public');
        expect(result.actualVisibility).toBe('public');
        expect(result.publicUrl).toBe('https://bucket.region.digitaloceanspaces.com/path/to/file.txt');
        expect(result.message).toBe('File visibility updated successfully');
        expect(result.providerSpecific).toMatchObject({
          fileId: 'test-file-id',
          updatedViaAPI: true,
        });

        // Verify the API was called with correct endpoint
        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.crunchycone.com/api/v1/storage/files/test-file-id/visibility',
          {
            method: 'PATCH',
            signal: expect.any(AbortSignal),
            headers: {
              'X-API-Key': 'test-api-key',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ visibility: 'public' }),
          },
        );
      });

      it('should handle file ID not found error', async () => {
        // Mock 404 error responses for all endpoints
        mockFetch
          .mockResolvedValueOnce({
            ok: false,
            status: 404,
            statusText: 'Not Found',
            text: () => Promise.resolve('{"error": "File not found"}'),
          })
          .mockResolvedValueOnce({
            ok: false,
            status: 404,
            statusText: 'Not Found',
            text: () => Promise.resolve('{"error": "File not found"}'),
          })
          .mockResolvedValueOnce({
            ok: false,
            status: 404,
            statusText: 'Not Found',
            text: () => Promise.resolve('{"error": "File not found"}'),
          });

        const result = await provider.updateFileVisibilityById('nonexistent-file-id', 'public');

        expect(result.success).toBe(false);
        expect(result.requestedVisibility).toBe('public');
        expect(result.actualVisibility).toBe('private');
        expect(result.message).toBe('File with ID nonexistent-file-id not found');
      });
    });

    it('should get file visibility status for public file', async () => {
      // Mock finding the file
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: {
            files: [{
              file_id: 'test-file-id',
              storage_key: 'test-key',
              visibility: 'public',
              public_url: 'https://public.example.com/file.jpg',
              metadata: { category: 'image' },
            }],
          },
        }),
      });

      const result = await provider.getFileVisibility('test-key');

      expect(result.visibility).toBe('public');
      expect(result.canMakePublic).toBe(true);
      expect(result.canMakePrivate).toBe(true);
      expect(result.supportsTemporaryAccess).toBe(true);
      expect(result.message).toContain('File is public and has a public URL');
    });

    it('should get file visibility status for private file', async () => {
      // Mock finding the file
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: {
            files: [{
              file_id: 'test-file-id',
              storage_key: 'test-key',
              visibility: 'private',
              public_url: null,
              metadata: { category: 'document' },
            }],
          },
        }),
      });

      const result = await provider.getFileVisibility('test-key');

      expect(result.visibility).toBe('private');
      expect(result.canMakePublic).toBe(true);
      expect(result.canMakePrivate).toBe(true);
      expect(result.supportsTemporaryAccess).toBe(true);
      expect(result.message).toContain('File is private and requires authentication');
    });
  });

  describe('listFiles', () => {
    beforeEach(() => {
      provider = new CrunchyConeProvider({
        apiUrl: 'https://api.crunchycone.com',
        apiKey: 'test-api-key',
        projectId: 'test-project-id',
        userId: 'test-user-id',
      });
    });

    it('should return files with correct visibility from API response', async () => {
      // Mock the API response with mixed visibility files
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: {
            files: [
              {
                file_id: 'file-1',
                user_id: 'test-user-id',
                project_id: 'test-project-id',
                storage_key: 'path/to/public-file.jpg',
                file_path: 'path/to/public-file.jpg',
                original_filename: 'public-file.jpg',
                content_type: 'image/jpeg',
                expected_file_size: 12345,
                actual_file_size: 12345,
                upload_status: 'completed' as const,
                visibility: 'public' as const,
                public_url: 'https://public.crunchycone.com/file-1.jpg',
                metadata: { category: 'image' },
                created_at: '2023-01-01T00:00:00Z',
                updated_at: '2023-01-01T00:00:00Z',
                uploaded_at: '2023-01-01T00:00:00Z',
              },
              {
                file_id: 'file-2',
                user_id: 'test-user-id',
                project_id: 'test-project-id',
                storage_key: 'path/to/private-file.pdf',
                file_path: 'path/to/private-file.pdf',
                original_filename: 'private-file.pdf',
                content_type: 'application/pdf',
                expected_file_size: 67890,
                actual_file_size: 67890,
                upload_status: 'completed' as const,
                visibility: 'private' as const,
                public_url: null,
                metadata: { category: 'document' },
                created_at: '2023-01-01T00:00:00Z',
                updated_at: '2023-01-01T00:00:00Z',
                uploaded_at: '2023-01-01T00:00:00Z',
              },
            ],
            total_count: 2,
            has_more: false,
          },
        }),
      });

      const result = await provider.listFiles();

      expect(result.files).toHaveLength(2);
      
      // Files are sorted by key alphabetically, so private file comes first
      // Check private file (sorted first alphabetically)
      const privateFile = result.files[0];
      expect(privateFile.visibility).toBe('private');
      expect(privateFile.publicUrl).toBeUndefined();
      expect(privateFile.key).toBe('path/to/private-file.pdf');

      // Check public file (sorted second alphabetically)
      const publicFile = result.files[1];
      expect(publicFile.visibility).toBe('public');
      expect(publicFile.publicUrl).toBe('https://public.crunchycone.com/file-1.jpg');
      expect(publicFile.key).toBe('path/to/public-file.jpg');

      expect(result.totalCount).toBe(2);
      expect(result.hasMore).toBe(false);
    });
  });

  describe('Content Disposition Support', () => {
    beforeEach(() => {
      provider = new CrunchyConeProvider({
        apiUrl: 'https://api.crunchycone.com',
        apiKey: 'test-api-key',
        projectId: 'test-project-id',
        userId: 'test-user-id',
      });
    });

    it('should generate URL with attachment disposition by default', async () => {
      // Mock finding file by storage key
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: {
            files: [{
              file_id: 'test-file-id',
              storage_key: 'test-key',
              external_id: 'test-external-id',
              file_path: 'test/path',
              content_type: 'image/png',
              actual_file_size: 1024,
              upload_status: 'completed',
              metadata: {},
              uploaded_at: '2023-01-01T00:00:00Z',
            }],
          },
        }),
      });

      // Mock the signed URL response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: { signedUrl: 'https://signed-url.example.com/file.png?disposition=attachment' },
        }),
      });

      // Mock the signed URL content test
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('image content'),
      });

      const result = await provider.getFileUrl('test-key');

      expect(result).toBe('https://signed-url.example.com/file.png?disposition=attachment');
      
      // Verify the API was called with attachment disposition
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.crunchycone.com/api/v1/storage/files/test-file-id/download?returnSignedUrl=true&disposition=attachment',
        expect.any(Object),
      );
    });

    it('should generate URL with inline disposition when specified', async () => {
      // Mock finding file by storage key
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: {
            files: [{
              file_id: 'test-file-id',
              storage_key: 'test-key',
              external_id: 'test-external-id',
              file_path: 'test/path',
              content_type: 'image/png',
              actual_file_size: 1024,
              upload_status: 'completed',
              metadata: {},
              uploaded_at: '2023-01-01T00:00:00Z',
            }],
          },
        }),
      });

      // Mock the signed URL response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: { signedUrl: 'https://signed-url.example.com/file.png?disposition=inline' },
        }),
      });

      // Mock the signed URL content test
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('image content'),
      });

      const result = await provider.getFileUrl('test-key', 3600, { disposition: 'inline' });

      expect(result).toBe('https://signed-url.example.com/file.png?disposition=inline');
      
      // Verify the API was called with inline disposition
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.crunchycone.com/api/v1/storage/files/test-file-id/download?returnSignedUrl=true&disposition=inline',
        expect.any(Object),
      );
    });

    it('should generate URL with attachment disposition when explicitly specified', async () => {
      // Mock finding file by storage key
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: {
            files: [{
              file_id: 'test-file-id',
              storage_key: 'test-key',
              external_id: 'test-external-id',
              file_path: 'test/path',
              content_type: 'application/pdf',
              actual_file_size: 2048,
              upload_status: 'completed',
              metadata: {},
              uploaded_at: '2023-01-01T00:00:00Z',
            }],
          },
        }),
      });

      // Mock the signed URL response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: { signedUrl: 'https://signed-url.example.com/file.pdf?disposition=attachment' },
        }),
      });

      // Mock the signed URL content test
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('pdf content'),
      });

      const result = await provider.getFileUrl('test-key', 3600, { disposition: 'attachment' });

      expect(result).toBe('https://signed-url.example.com/file.pdf?disposition=attachment');
      
      // Verify the API was called with attachment disposition
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.crunchycone.com/api/v1/storage/files/test-file-id/download?returnSignedUrl=true&disposition=attachment',
        expect.any(Object),
      );
    });

    it('should support content disposition with getFileUrlByExternalId', async () => {
      // Mock the file metadata response by external ID
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: {
            file_id: 'test-file-id',
            external_id: 'test-external-id',
            file_path: 'test/path',
            storage_key: 'files/test-external-id.png',
            content_type: 'image/png',
            actual_file_size: 1024,
            upload_status: 'completed',
            metadata: {},
            uploaded_at: '2023-01-01T00:00:00Z',
          },
        }),
      });

      // Mock the signed URL response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: { signedUrl: 'https://signed-url.example.com/file.png?disposition=inline' },
        }),
      });

      // Mock the signed URL content test
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('image content'),
      });

      const result = await provider.getFileUrlByExternalId('test-external-id', 3600, { disposition: 'inline' });

      expect(result).toBe('https://signed-url.example.com/file.png?disposition=inline');
      
      // Verify the API was called with inline disposition
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.crunchycone.com/api/v1/storage/files/test-file-id/download?returnSignedUrl=true&disposition=inline',
        expect.any(Object),
      );
    });

    it('should handle invalid disposition values by defaulting to attachment', async () => {
      // Mock finding file by storage key
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: {
            files: [{
              file_id: 'test-file-id',
              storage_key: 'test-key',
              external_id: 'test-external-id',
              file_path: 'test/path',
              content_type: 'text/plain',
              actual_file_size: 500,
              upload_status: 'completed',
              metadata: {},
              uploaded_at: '2023-01-01T00:00:00Z',
            }],
          },
        }),
      });

      // Mock the signed URL response - should default to attachment
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: { signedUrl: 'https://signed-url.example.com/file.txt?disposition=attachment' },
        }),
      });

      // Mock the signed URL content test
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('text content'),
      });

      // Pass an invalid disposition value (TypeScript would prevent this, but testing runtime behavior)
      const result = await provider.getFileUrl('test-key', 3600, { disposition: 'invalid' as any });

      expect(result).toBe('https://signed-url.example.com/file.txt?disposition=attachment');
      
      // Verify the API was called with attachment disposition (default fallback)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.crunchycone.com/api/v1/storage/files/test-file-id/download?returnSignedUrl=true&disposition=attachment',
        expect.any(Object),
      );
    });
  });
});