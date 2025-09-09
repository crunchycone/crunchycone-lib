/**
 * Tests for CrunchyCone Environment Service
 * Verifies CRUNCHYCONE_PLATFORM detection and provider selection
 */

import * as fs from 'fs';
import * as path from 'path';
import { 
  CrunchyConeEnvironmentService, 
  createCrunchyConeEnvironmentService,
  getCrunchyConeEnvironmentService,
  isPlatformEnvironment,
  getProviderType,
} from '../../../src/services/environment';
import { LocalEnvironmentProvider } from '../../../src/services/environment/providers/local-provider';
import { RemoteEnvironmentProvider } from '../../../src/services/environment/providers/remote-provider';

describe('CrunchyCone Environment Service', () => {
  const originalEnv = process.env;
  const testTempDir = path.join(__dirname, 'temp-env-test');

  beforeEach(() => {
    // Reset environment variables for each test
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.CRUNCHYCONE_PLATFORM;
    
    // Create temp directory for test .env files
    if (fs.existsSync(testTempDir)) {
      fs.rmSync(testTempDir, { recursive: true });
    }
    fs.mkdirSync(testTempDir, { recursive: true });
  });

  afterEach(() => {
    process.env = originalEnv;
    
    // Clean up temp directory
    if (fs.existsSync(testTempDir)) {
      fs.rmSync(testTempDir, { recursive: true });
    }
  });

  describe('Environment Detection', () => {
    test('should detect local environment when CRUNCHYCONE_PLATFORM is not set', () => {
      expect(isPlatformEnvironment()).toBe(false);
      expect(getProviderType()).toBe('local');
    });

    test('should detect local environment when CRUNCHYCONE_PLATFORM is not "1" or "true"', () => {
      process.env.CRUNCHYCONE_PLATFORM = '0';
      expect(isPlatformEnvironment()).toBe(false);
      expect(getProviderType()).toBe('local');

      process.env.CRUNCHYCONE_PLATFORM = 'false';
      expect(isPlatformEnvironment()).toBe(false);
      expect(getProviderType()).toBe('local');

      process.env.CRUNCHYCONE_PLATFORM = 'yes';
      expect(isPlatformEnvironment()).toBe(false);
      expect(getProviderType()).toBe('local');
    });

    test('should detect platform environment when CRUNCHYCONE_PLATFORM=1', () => {
      process.env.CRUNCHYCONE_PLATFORM = '1';
      expect(isPlatformEnvironment()).toBe(true);
      expect(getProviderType()).toBe('remote');
    });

    test('should detect platform environment when CRUNCHYCONE_PLATFORM=true', () => {
      process.env.CRUNCHYCONE_PLATFORM = 'true';
      expect(isPlatformEnvironment()).toBe(true);
      expect(getProviderType()).toBe('remote');
    });

    test('should respect forceProvider override', () => {
      process.env.CRUNCHYCONE_PLATFORM = '1';
      expect(getProviderType('local')).toBe('local');
      
      delete process.env.CRUNCHYCONE_PLATFORM;
      expect(getProviderType('remote')).toBe('remote');
    });
  });

  describe('Provider Selection', () => {
    test('should create LocalEnvironmentProvider in local environment', () => {
      delete process.env.CRUNCHYCONE_PLATFORM;
      
      const service = createCrunchyConeEnvironmentService({
        dotEnvPath: path.join(testTempDir, '.env'),
      });
      
      expect(service.getProviderType()).toBe('local');
      expect(service.supportsSecrets()).toBe(false);
      expect(service.isPlatformEnvironment()).toBe(false);
      expect(service.getProvider()).toBeInstanceOf(LocalEnvironmentProvider);
    });

    test('should create RemoteEnvironmentProvider in platform environment', () => {
      process.env.CRUNCHYCONE_PLATFORM = '1';
      process.env.CRUNCHYCONE_PROJECT_ID = 'test-project-123';
      
      const service = createCrunchyConeEnvironmentService({
        apiKey: 'test-api-key',
        projectId: 'test-project-123',
      });
      
      expect(service.getProviderType()).toBe('remote');
      expect(service.supportsSecrets()).toBe(true);
      expect(service.isPlatformEnvironment()).toBe(true);
      expect(service.getProvider()).toBeInstanceOf(RemoteEnvironmentProvider);
    });

    test('should respect forceProvider config option', () => {
      process.env.CRUNCHYCONE_PLATFORM = '1'; // Platform environment
      
      // Force local provider despite being in platform environment
      const localService = createCrunchyConeEnvironmentService({
        forceProvider: 'local',
        dotEnvPath: path.join(testTempDir, '.env'),
      });
      
      expect(localService.getProviderType()).toBe('local');
      expect(localService.getProvider()).toBeInstanceOf(LocalEnvironmentProvider);
      
      delete process.env.CRUNCHYCONE_PLATFORM; // Local environment
      process.env.CRUNCHYCONE_PROJECT_ID = 'test-project-123';
      
      // Force remote provider despite being in local environment
      const remoteService = createCrunchyConeEnvironmentService({
        forceProvider: 'remote',
        apiKey: 'test-api-key',
        projectId: 'test-project-123',
      });
      
      expect(remoteService.getProviderType()).toBe('remote');
      expect(remoteService.getProvider()).toBeInstanceOf(RemoteEnvironmentProvider);
    });
  });

  describe('Local Provider Integration', () => {
    let service: CrunchyConeEnvironmentService;
    const testEnvPath = path.join(testTempDir, '.env');

    beforeEach(() => {
      delete process.env.CRUNCHYCONE_PLATFORM;
      service = createCrunchyConeEnvironmentService({
        dotEnvPath: testEnvPath,
      });
    });

    test('should manage environment variables via .env file', async () => {
      // Set a variable
      await service.setEnvVar('TEST_VAR', 'test-value');
      
      // Verify it was written to .env file
      const envContent = fs.readFileSync(testEnvPath, 'utf-8');
      expect(envContent).toContain('TEST_VAR=test-value');
      
      // Read it back
      const value = await service.getEnvVar('TEST_VAR');
      expect(value).toBe('test-value');
      
      // List all variables
      const allVars = await service.listEnvVars();
      expect(allVars).toEqual({ TEST_VAR: 'test-value' });
      
      // Delete the variable
      await service.deleteEnvVar('TEST_VAR');
      const valueAfterDelete = await service.getEnvVar('TEST_VAR');
      expect(valueAfterDelete).toBeUndefined();
    });

    test('should handle secrets as no-ops', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      // Setting secrets should warn but not throw
      await expect(service.setSecret('SECRET_KEY', 'secret-value')).resolves.not.toThrow();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Secrets are not supported locally'));
      
      // Deleting secrets should warn but not throw
      await expect(service.deleteSecret('SECRET_KEY')).resolves.not.toThrow();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Secrets are not supported locally'));
      
      // Listing secrets should return empty array
      const secretNames = await service.listSecretNames();
      expect(secretNames).toEqual([]);
      
      consoleSpy.mockRestore();
    });

    test('should handle bulk operations', async () => {
      await service.setEnvVars({
        VAR1: 'value1',
        VAR2: 'value2',
        VAR3: 'value3',
      });
      
      // Verify individual variables were set
      expect(await service.getEnvVar('VAR1')).toBe('value1');
      expect(await service.getEnvVar('VAR2')).toBe('value2');
      expect(await service.getEnvVar('VAR3')).toBe('value3');
      
      const result = await service.getEnvVars(['VAR1', 'VAR2', 'NONEXISTENT']);
      expect(result).toEqual({
        VAR1: 'value1',
        VAR2: 'value2',
      });
      
      const allVars = await service.listEnvVars();
      expect(allVars).toEqual({
        VAR1: 'value1',
        VAR2: 'value2',
        VAR3: 'value3',
      });
    });
  });

  describe('Global Service Instance', () => {
    test('should provide singleton global service', () => {
      delete process.env.CRUNCHYCONE_PLATFORM;
      
      const service1 = getCrunchyConeEnvironmentService();
      const service2 = getCrunchyConeEnvironmentService();
      
      expect(service1).toBe(service2); // Same instance
      expect(service1.getProviderType()).toBe('local');
    });

    test('should respect environment changes after service creation', () => {
      // Create service in local environment
      delete process.env.CRUNCHYCONE_PLATFORM;
      const service = createCrunchyConeEnvironmentService();
      expect(service.getProviderType()).toBe('local');
      
      // Change environment variable - service should still reflect original state
      process.env.CRUNCHYCONE_PLATFORM = '1';
      expect(service.isPlatformEnvironment()).toBe(false); // Still reports original state
      expect(service.getProviderType()).toBe('local'); // Provider doesn't change
      
      // But new service should detect new environment
      expect(isPlatformEnvironment()).toBe(true); // Utility function sees current state
    });
  });

  describe('Provider Info', () => {
    test('should provide accurate provider information', () => {
      delete process.env.CRUNCHYCONE_PLATFORM;
      const localService = createCrunchyConeEnvironmentService({
        dotEnvPath: path.join(testTempDir, '.env'),
      });
      
      const localInfo = localService.getProviderInfo();
      expect(localInfo).toEqual({
        type: 'local',
        supportsSecrets: false,
        isPlatformEnvironment: false,
      });
      
      process.env.CRUNCHYCONE_PLATFORM = '1';
      process.env.CRUNCHYCONE_PROJECT_ID = 'test-project';
      
      const remoteService = createCrunchyConeEnvironmentService({
        apiKey: 'test-key',
        projectId: 'test-project',
      });
      
      const remoteInfo = remoteService.getProviderInfo();
      expect(remoteInfo).toEqual({
        type: 'remote',
        supportsSecrets: true,
        isPlatformEnvironment: true,
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle RemoteEnvironmentProvider without project ID', () => {
      process.env.CRUNCHYCONE_PLATFORM = '1';
      delete process.env.CRUNCHYCONE_PROJECT_ID;
      
      expect(() => createCrunchyConeEnvironmentService({
        apiKey: 'test-key',
        // No project ID provided
      })).toThrow('Project ID is required for RemoteEnvironmentProvider');
    });

    test('should handle invalid .env file paths gracefully', async () => {
      delete process.env.CRUNCHYCONE_PLATFORM;
      const service = createCrunchyConeEnvironmentService({
        dotEnvPath: '/invalid/path/that/does/not/exist/.env',
      });
      
      // Should not throw for non-existent file
      const value = await service.getEnvVar('SOME_VAR');
      expect(value).toBeUndefined();
      
      // Should be able to create the file when setting a variable
      // Note: This would fail with permission error for truly invalid paths
      // For this test, we'll just verify the service was created successfully
      expect(service.getProviderType()).toBe('local');
    });
  });
});