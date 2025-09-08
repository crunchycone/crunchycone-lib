/**
 * Tests for Remote Environment Provider
 * Tests CrunchyCone API integration with mocked API calls
 */

import { RemoteEnvironmentProvider } from '../../../src/services/environment/providers/remote-provider';
import { CrunchyConeApiClient } from '../../../src/services/crunchycone-api';

// Mock the auth module
jest.mock('../../../src/auth', () => ({
  getCrunchyConeAPIKeyWithFallback: jest.fn(),
  getCrunchyConeProjectID: jest.fn(),
}));

// Mock the API client
jest.mock('../../../src/services/crunchycone-api');

const mockGetCrunchyConeAPIKeyWithFallback = require('../../../src/auth').getCrunchyConeAPIKeyWithFallback as jest.MockedFunction<any>;
const mockGetCrunchyConeProjectID = require('../../../src/auth').getCrunchyConeProjectID as jest.MockedFunction<any>;
const MockedCrunchyConeApiClient = CrunchyConeApiClient as jest.MockedClass<typeof CrunchyConeApiClient>;

describe('RemoteEnvironmentProvider', () => {
  let mockApiClient: jest.Mocked<CrunchyConeApiClient>;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    
    // Setup mock API client
    mockApiClient = {
      getEnvironmentVariables: jest.fn(),
      updateEnvironmentVariables: jest.fn(),
      getSecretNames: jest.fn(),
      updateSecrets: jest.fn(),
      deleteSecret: jest.fn(),
    } as any;
    
    MockedCrunchyConeApiClient.mockImplementation(() => mockApiClient);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Provider Initialization', () => {
    test('should create provider with explicit config', () => {
      const provider = new RemoteEnvironmentProvider({
        projectId: 'test-project-123',
        apiKey: 'test-api-key',
        apiUrl: 'https://test.api.com',
      });
      
      expect(provider.getProviderType()).toBe('remote');
      expect(provider.supportsSecrets()).toBe(true);
      expect(provider.getProjectId()).toBe('test-project-123');
      expect(provider.hasApiKey()).toBe(true);
    });

    test('should use environment variables as fallback', () => {
      mockGetCrunchyConeProjectID.mockReturnValue('env-project-id');
      
      const provider = new RemoteEnvironmentProvider();
      
      expect(provider.getProjectId()).toBe('env-project-id');
      expect(MockedCrunchyConeApiClient).toHaveBeenCalledWith({
        apiKey: '',
        baseUrl: undefined,
      });
    });

    test('should throw error when no project ID is available', () => {
      mockGetCrunchyConeProjectID.mockReturnValue(undefined);
      
      expect(() => new RemoteEnvironmentProvider()).toThrow(
        'Project ID is required for RemoteEnvironmentProvider',
      );
    });
  });

  describe('Environment Variables', () => {
    let provider: RemoteEnvironmentProvider;

    beforeEach(() => {
      provider = new RemoteEnvironmentProvider({
        projectId: 'test-project',
        apiKey: 'test-api-key',
      });
    });

    test('should get environment variable', async () => {
      const mockVars = { TEST_VAR: 'test-value', OTHER_VAR: 'other-value' };
      mockApiClient.getEnvironmentVariables.mockResolvedValue(mockVars);
      
      const value = await provider.getEnvVar('TEST_VAR');
      
      expect(value).toBe('test-value');
      expect(mockApiClient.getEnvironmentVariables).toHaveBeenCalledWith(
        'test-api-key',
        'test-project',
      );
    });

    test('should return undefined for non-existent variable', async () => {
      const mockVars = { OTHER_VAR: 'other-value' };
      mockApiClient.getEnvironmentVariables.mockResolvedValue(mockVars);
      
      const value = await provider.getEnvVar('NONEXISTENT');
      
      expect(value).toBeUndefined();
    });

    test('should set environment variable', async () => {
      const mockUpdatedVars = { TEST_VAR: 'new-value', EXISTING: 'existing' };
      mockApiClient.updateEnvironmentVariables.mockResolvedValue(mockUpdatedVars);
      
      await provider.setEnvVar('TEST_VAR', 'new-value');
      
      expect(mockApiClient.updateEnvironmentVariables).toHaveBeenCalledWith(
        'test-api-key',
        'test-project',
        { TEST_VAR: 'new-value' },
        true, // merge = true
      );
    });

    test('should delete environment variable', async () => {
      const mockExistingVars = { TEST_VAR: 'to-delete', KEEP_VAR: 'keep-this' };
      const mockUpdatedVars = { KEEP_VAR: 'keep-this' };
      
      mockApiClient.getEnvironmentVariables.mockResolvedValue(mockExistingVars);
      mockApiClient.updateEnvironmentVariables.mockResolvedValue(mockUpdatedVars);
      
      await provider.deleteEnvVar('TEST_VAR');
      
      expect(mockApiClient.getEnvironmentVariables).toHaveBeenCalledWith(
        'test-api-key',
        'test-project',
      );
      expect(mockApiClient.updateEnvironmentVariables).toHaveBeenCalledWith(
        'test-api-key',
        'test-project',
        { KEEP_VAR: 'keep-this' }, // TEST_VAR removed
        false, // merge = false for replacement
      );
    });

    test('should list all environment variables', async () => {
      const mockVars = {
        VAR1: 'value1',
        VAR2: 'value2',
        VAR3: 'value3',
      };
      mockApiClient.getEnvironmentVariables.mockResolvedValue(mockVars);
      
      const allVars = await provider.listEnvVars();
      
      expect(allVars).toEqual(mockVars);
      expect(mockApiClient.getEnvironmentVariables).toHaveBeenCalledWith(
        'test-api-key',
        'test-project',
      );
    });
  });

  describe('Secrets', () => {
    let provider: RemoteEnvironmentProvider;

    beforeEach(() => {
      provider = new RemoteEnvironmentProvider({
        projectId: 'test-project',
        apiKey: 'test-api-key',
      });
    });

    test('should set secret', async () => {
      mockApiClient.updateSecrets.mockResolvedValue(undefined);
      
      await provider.setSecret('SECRET_KEY', 'secret-value');
      
      expect(mockApiClient.updateSecrets).toHaveBeenCalledWith(
        'test-api-key',
        'test-project',
        { SECRET_KEY: 'secret-value' },
        true, // merge = true
      );
    });

    test('should delete secret', async () => {
      mockApiClient.deleteSecret.mockResolvedValue(undefined);
      
      await provider.deleteSecret('SECRET_KEY');
      
      expect(mockApiClient.deleteSecret).toHaveBeenCalledWith(
        'test-api-key',
        'test-project',
        'SECRET_KEY',
      );
    });

    test('should list secret names', async () => {
      const mockSecretNames = ['SECRET1', 'SECRET2', 'SECRET3'];
      mockApiClient.getSecretNames.mockResolvedValue(mockSecretNames);
      
      const secretNames = await provider.listSecretNames();
      
      expect(secretNames).toEqual(mockSecretNames);
      expect(mockApiClient.getSecretNames).toHaveBeenCalledWith(
        'test-api-key',
        'test-project',
      );
    });
  });

  describe('API Key Management', () => {
    test('should use provided API key', async () => {
      const provider = new RemoteEnvironmentProvider({
        projectId: 'test-project',
        apiKey: 'explicit-key',
      });

      mockApiClient.getEnvironmentVariables.mockResolvedValue({});
      await provider.listEnvVars();

      expect(mockApiClient.getEnvironmentVariables).toHaveBeenCalledWith(
        'explicit-key',
        'test-project',
      );
    });

    test('should fetch API key from keychain when not provided', async () => {
      const provider = new RemoteEnvironmentProvider({
        projectId: 'test-project',
        // No apiKey provided
      });

      mockGetCrunchyConeAPIKeyWithFallback.mockResolvedValue('keychain-api-key');
      mockApiClient.getEnvironmentVariables.mockResolvedValue({});

      await provider.listEnvVars();

      expect(mockGetCrunchyConeAPIKeyWithFallback).toHaveBeenCalled();
      expect(mockApiClient.getEnvironmentVariables).toHaveBeenCalledWith(
        'keychain-api-key',
        'test-project',
      );
    });

    test('should throw error when API key cannot be obtained', async () => {
      const provider = new RemoteEnvironmentProvider({
        projectId: 'test-project',
      });

      mockGetCrunchyConeAPIKeyWithFallback.mockRejectedValue(
        new Error('API key not found'),
      );

      await expect(provider.listEnvVars()).rejects.toThrow(
        'Failed to get API key for RemoteEnvironmentProvider',
      );
    });

    test('should cache API key after first fetch', async () => {
      const provider = new RemoteEnvironmentProvider({
        projectId: 'test-project',
      });

      mockGetCrunchyConeAPIKeyWithFallback.mockResolvedValue('cached-key');
      mockApiClient.getEnvironmentVariables.mockResolvedValue({});

      // First call - should fetch API key
      await provider.listEnvVars();
      expect(mockGetCrunchyConeAPIKeyWithFallback).toHaveBeenCalledTimes(1);

      // Second call - should use cached key
      await provider.listEnvVars();
      expect(mockGetCrunchyConeAPIKeyWithFallback).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling', () => {
    let provider: RemoteEnvironmentProvider;

    beforeEach(() => {
      provider = new RemoteEnvironmentProvider({
        projectId: 'test-project',
        apiKey: 'test-api-key',
      });
    });

    test('should propagate API errors for environment variables', async () => {
      mockApiClient.getEnvironmentVariables.mockRejectedValue(
        new Error('API Error: Unauthorized'),
      );

      await expect(provider.getEnvVar('TEST_VAR')).rejects.toThrow('API Error: Unauthorized');
    });

    test('should propagate API errors for secrets', async () => {
      mockApiClient.updateSecrets.mockRejectedValue(
        new Error('API Error: Insufficient permissions'),
      );

      await expect(provider.setSecret('SECRET', 'value')).rejects.toThrow(
        'API Error: Insufficient permissions',
      );
    });

    test('should handle network timeouts', async () => {
      mockApiClient.getEnvironmentVariables.mockRejectedValue(
        new Error('Request timeout after 10000ms'),
      );

      await expect(provider.listEnvVars()).rejects.toThrow('Request timeout');
    });
  });
});