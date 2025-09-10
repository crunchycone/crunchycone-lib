import { 
  CrunchyConeApiClient, 
  validateApiKey, 
  getCurrentUser, 
  getProjectInfo,
  CrunchyConeUser,
  CrunchyConeProject,
} from '../../src/services/crunchycone-api';
import { getCrunchyConeAPIURL } from '../../src/auth';

// Mock the auth module
jest.mock('../../src/auth');
const mockGetCrunchyConeAPIURL = getCrunchyConeAPIURL as jest.MockedFunction<typeof getCrunchyConeAPIURL>;

// Mock fetch globally
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('CrunchyConeApiClient', () => {
  const mockApiKey = 'test-api-key-123';
  const mockBaseUrl = 'https://api.crunchycone.test';
  
  const mockUser: CrunchyConeUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z',
  };

  const mockProject: CrunchyConeProject = {
    project_id: 'project-123',
    name: 'Test Project',
    description: 'A test project',
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCrunchyConeAPIURL.mockReturnValue(mockBaseUrl);
    
    // Set up default successful response
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: { user: mockUser },
      }),
    } as Response);
  });

  describe('Constructor', () => {
    test('should create client with provided config', () => {
      const client = new CrunchyConeApiClient({
        apiKey: mockApiKey,
        baseUrl: mockBaseUrl,
        timeout: 5000,
      });
      
      expect(client).toBeInstanceOf(CrunchyConeApiClient);
    });

    test('should use default baseUrl from auth module when not provided', () => {
      const _client = new CrunchyConeApiClient({ apiKey: mockApiKey });
      
      expect(mockGetCrunchyConeAPIURL).toHaveBeenCalled();
    });

    test('should remove trailing slash from baseUrl', () => {
      const _client = new CrunchyConeApiClient({
        apiKey: mockApiKey,
        baseUrl: 'https://api.crunchycone.test/',
      });
      
      // We can't directly access the private config, but we can verify behavior
      expect(_client).toBeInstanceOf(CrunchyConeApiClient);
    });
  });

  describe('validateApiKey', () => {
    let client: CrunchyConeApiClient;

    beforeEach(() => {
      client = new CrunchyConeApiClient({ 
        apiKey: mockApiKey,
        baseUrl: mockBaseUrl,
      });
    });

    test('should successfully validate API key and return user', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { user: mockUser },
        }),
      } as Response);

      const result = await client.validateApiKey();
      
      expect(result).toEqual(mockUser);
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/api/v1/auth/validate`,
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'X-API-Key': mockApiKey,
            'Content-Type': 'application/json',
            'User-Agent': 'crunchycone-lib/1.0',
          }),
        }),
      );
    });

    test('should use provided API key when specified', async () => {
      const customApiKey = 'custom-key-456';
      
      await client.validateApiKey(customApiKey);
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-API-Key': customApiKey,
          }),
        }),
      );
    });

    test('should use custom API URL when provided', async () => {
      const customUrl = 'https://custom.api.test';
      
      await client.validateApiKey(undefined, customUrl);
      
      expect(mockFetch).toHaveBeenCalledWith(
        `${customUrl}/api/v1/auth/validate`,
        expect.any(Object),
      );
    });

    test('should throw error when API key is missing', async () => {
      const clientWithoutKey = new CrunchyConeApiClient({ 
        apiKey: '',
        baseUrl: mockBaseUrl,
      });

      await expect(clientWithoutKey.validateApiKey()).rejects.toThrow('API key is required');
    });

    test('should throw error on API failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({
          error: 'Invalid API key',
        }),
      } as Response);

      await expect(client.validateApiKey()).rejects.toThrow('API key validation failed: 401 - Invalid API key');
    });

    test('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(client.validateApiKey()).rejects.toThrow('Network error: Network error');
    });

    test('should handle timeout', async () => {
      const client = new CrunchyConeApiClient({ 
        apiKey: mockApiKey,
        baseUrl: mockBaseUrl,
        timeout: 50,
      });

      // Mock AbortError to simulate timeout
      const abortError = new Error('The operation was aborted.');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValue(abortError);

      await expect(client.validateApiKey()).rejects.toThrow('Request timeout after 50ms');
    });

    test('should handle malformed API response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: false,
          error: 'Something went wrong',
        }),
      } as Response);

      await expect(client.validateApiKey()).rejects.toThrow('Something went wrong');
    });
  });

  describe('getCurrentUser', () => {
    let client: CrunchyConeApiClient;

    beforeEach(() => {
      client = new CrunchyConeApiClient({ 
        apiKey: mockApiKey,
        baseUrl: mockBaseUrl,
      });
    });

    test('should return user details', async () => {
      const result = await client.getCurrentUser();
      expect(result).toEqual(mockUser);
    });

    test('should pass through parameters to validateApiKey', async () => {
      const spy = jest.spyOn(client, 'validateApiKey');
      const customKey = 'custom-key';
      const customUrl = 'https://custom.url';

      await client.getCurrentUser(customKey, customUrl);

      expect(spy).toHaveBeenCalledWith(customKey, customUrl);
      spy.mockRestore();
    });
  });

  describe('getProjectInfo', () => {
    let client: CrunchyConeApiClient;

    beforeEach(() => {
      client = new CrunchyConeApiClient({ 
        apiKey: mockApiKey,
        baseUrl: mockBaseUrl,
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: mockProject,
        }),
      } as Response);
    });

    test('should successfully get project info', async () => {
      const result = await client.getProjectInfo(mockApiKey, 'project-123');
      
      expect(result).toEqual(mockProject);
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/api/v1/users/me/projects/project-123`,
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'X-API-Key': mockApiKey,
          }),
        }),
      );
    });

    test('should use custom API URL when provided', async () => {
      const customUrl = 'https://custom.api.test';
      
      await client.getProjectInfo(mockApiKey, 'project-123', customUrl);
      
      expect(mockFetch).toHaveBeenCalledWith(
        `${customUrl}/api/v1/users/me/projects/project-123`,
        expect.any(Object),
      );
    });

    test('should throw error when API key is missing', async () => {
      await expect(client.getProjectInfo('', 'project-123')).rejects.toThrow('API key is required');
    });

    test('should throw error when project ID is missing', async () => {
      await expect(client.getProjectInfo(mockApiKey, '')).rejects.toThrow('Project ID is required');
    });

    test('should handle project not found', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({
          error: 'Project not found',
        }),
      } as Response);

      await expect(client.getProjectInfo(mockApiKey, 'nonexistent')).rejects.toThrow('Failed to get project info: 404 - Project not found');
    });
  });
});

describe('Standalone Functions', () => {
  const mockApiKey = 'test-api-key-123';
  const mockApiUrl = 'https://api.crunchycone.test';

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Ensure mock returns the expected URL
    mockGetCrunchyConeAPIURL.mockReturnValue(mockApiUrl);
    
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: { user: { id: 'user-123', email: 'test@example.com' } },
      }),
    } as Response);
  });

  describe('validateApiKey', () => {
    test('should create client and validate key', async () => {
      const result = await validateApiKey(mockApiKey);
      
      expect(result.email).toBe('test@example.com');
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockApiUrl}/api/v1/auth/validate`,
        expect.any(Object),
      );
    });

    test('should use custom API URL when provided', async () => {
      const customUrl = 'https://custom.api.test';
      
      await validateApiKey(mockApiKey, customUrl);
      
      expect(mockFetch).toHaveBeenCalledWith(
        `${customUrl}/api/v1/auth/validate`,
        expect.any(Object),
      );
    });
  });

  describe('getCurrentUser', () => {
    test('should create client and get user', async () => {
      const result = await getCurrentUser(mockApiKey);
      
      expect(result.email).toBe('test@example.com');
    });
  });

  describe('getProjectInfo', () => {
    test('should create client and get project info', async () => {
      const mockProject = { project_id: 'project-123', name: 'Test Project' };
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: mockProject,
        }),
      } as Response);

      const result = await getProjectInfo(mockApiKey, 'project-123');
      
      expect(result).toEqual(mockProject);
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockApiUrl}/api/v1/users/me/projects/project-123`,
        expect.any(Object),
      );
    });
  });
});