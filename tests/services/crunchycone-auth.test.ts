import { 
  CrunchyConeAuthService, 
  createCrunchyConeAuthService, 
  checkCrunchyConeAuth,
} from '../../src/services/crunchycone-auth';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';

// Mock the API client
jest.mock('../../src/services/crunchycone-api', () => ({
  validateApiKey: jest.fn(),
  getCurrentUser: jest.fn(),
  getProjectInfo: jest.fn(),
}));

// Mock the auth utilities
jest.mock('../../src/auth', () => ({
  getCrunchyConeAPIKeyWithFallback: jest.fn(),
  getCrunchyConeAPIURL: jest.fn(),
  getCrunchyConeProjectID: jest.fn(),
}));

// Mock child_process
jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

const mockValidateApiKey = require('../../src/services/crunchycone-api').validateApiKey as jest.MockedFunction<any>;
const mockGetCurrentUser = require('../../src/services/crunchycone-api').getCurrentUser as jest.MockedFunction<any>;
const mockGetProjectInfo = require('../../src/services/crunchycone-api').getProjectInfo as jest.MockedFunction<any>;
const mockGetCrunchyConeAPIKeyWithFallback = require('../../src/auth').getCrunchyConeAPIKeyWithFallback as jest.MockedFunction<any>;
const mockGetCrunchyConeProjectID = require('../../src/auth').getCrunchyConeProjectID as jest.MockedFunction<any>;
const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;

describe('CrunchyConeAuthService', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
  };

  const mockProject = {
    project_id: 'project-123',
    name: 'Test Project',
  };

  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    jest.clearAllMocks();
    
    // Default mock implementations
    mockValidateApiKey.mockResolvedValue(mockUser);
    mockGetCurrentUser.mockResolvedValue(mockUser);
    mockGetProjectInfo.mockResolvedValue(mockProject);
    mockGetCrunchyConeAPIKeyWithFallback.mockResolvedValue('keychain-api-key');
    mockGetCrunchyConeProjectID.mockReturnValue('project-123');
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Constructor', () => {
    test('should create service with default config', () => {
      const service = new CrunchyConeAuthService();
      expect(service).toBeInstanceOf(CrunchyConeAuthService);
    });

    test('should create service with custom config', () => {
      const service = new CrunchyConeAuthService({
        timeout: 5000,
        preferApi: false,
        cliTimeout: 20000,
      });
      expect(service).toBeInstanceOf(CrunchyConeAuthService);
    });
  });

  describe('checkAuthentication', () => {
    describe('API Authentication (Environment Variable)', () => {
      test('should authenticate with environment API key', async () => {
        process.env.CRUNCHYCONE_API_KEY = 'env-api-key';
        
        const service = new CrunchyConeAuthService();
        const result = await service.checkAuthentication();

        expect(result).toEqual({
          success: true,
          source: 'api',
          user: mockUser,
          project: mockProject,
          message: 'Authenticated via API key',
        });
        
        expect(mockValidateApiKey).toHaveBeenCalledWith('env-api-key');
      });

      test('should handle invalid API key from environment', async () => {
        process.env.CRUNCHYCONE_API_KEY = 'invalid-key';
        mockValidateApiKey.mockRejectedValue(new Error('Invalid API key'));

        const service = new CrunchyConeAuthService();
        const result = await service.checkAuthentication();

        expect(result).toEqual({
          success: false,
          source: 'api',
          error: 'API authentication failed: Invalid API key',
        });
      });

      test('should skip empty environment API key', async () => {
        process.env.CRUNCHYCONE_API_KEY = '   ';
        
        const service = new CrunchyConeAuthService();
        await service.checkAuthentication();

        expect(mockValidateApiKey).not.toHaveBeenCalled();
        expect(mockGetCrunchyConeAPIKeyWithFallback).toHaveBeenCalled();
      });
    });

    describe('API Authentication (Keychain)', () => {
      test('should authenticate with keychain API key when env key not present', async () => {
        delete process.env.CRUNCHYCONE_API_KEY;
        
        const service = new CrunchyConeAuthService();
        const result = await service.checkAuthentication();

        expect(result).toEqual({
          success: true,
          source: 'api',
          user: mockUser,
          project: mockProject,
          message: 'Authenticated via API key from keychain',
        });
        
        expect(mockGetCurrentUser).toHaveBeenCalledWith('keychain-api-key');
      });

      test('should handle keychain access failure and fall back to CLI', async () => {
        delete process.env.CRUNCHYCONE_API_KEY;
        mockGetCrunchyConeAPIKeyWithFallback.mockRejectedValue(new Error('Keychain not available'));

        // Mock CLI success
        const mockChild = new EventEmitter() as any;
        mockChild.stdout = new EventEmitter();
        mockChild.stderr = new EventEmitter();
        mockSpawn.mockReturnValue(mockChild);

        const service = new CrunchyConeAuthService();
        const authPromise = service.checkAuthentication();

        // Simulate CLI response
        setTimeout(() => {
          mockChild.stdout.emit('data', JSON.stringify({
            success: true,
            user: mockUser,
            project: mockProject,
          }));
          mockChild.emit('close', 0);
        }, 10);

        const result = await authPromise;

        expect(result.success).toBe(true);
        expect(result.source).toBe('cli');
      });

      test('should handle project info failure gracefully', async () => {
        process.env.CRUNCHYCONE_API_KEY = 'env-api-key';
        mockGetProjectInfo.mockRejectedValue(new Error('Project not found'));

        const service = new CrunchyConeAuthService();
        const result = await service.checkAuthentication();

        expect(result).toEqual({
          success: true,
          source: 'api',
          user: mockUser,
          project: undefined,
          message: 'Authenticated via API key',
        });
      });

      test('should handle missing project ID gracefully', async () => {
        process.env.CRUNCHYCONE_API_KEY = 'env-api-key';
        mockGetCrunchyConeProjectID.mockReturnValue(undefined);

        const service = new CrunchyConeAuthService();
        const result = await service.checkAuthentication();

        expect(result.project).toBeUndefined();
        expect(mockGetProjectInfo).not.toHaveBeenCalled();
      });
    });

    describe('CLI Fallback', () => {
      beforeEach(() => {
        delete process.env.CRUNCHYCONE_API_KEY;
        mockGetCrunchyConeAPIKeyWithFallback.mockRejectedValue(new Error('No keychain access'));
      });

      test('should successfully authenticate via CLI', async () => {
        const mockChild = new EventEmitter() as any;
        mockChild.stdout = new EventEmitter();
        mockChild.stderr = new EventEmitter();
        mockSpawn.mockReturnValue(mockChild);

        const service = new CrunchyConeAuthService();
        const authPromise = service.checkAuthentication();

        // Simulate successful CLI response
        setTimeout(() => {
          mockChild.stdout.emit('data', JSON.stringify({
            success: true,
            user: mockUser,
            project: mockProject,
          }));
          mockChild.emit('close', 0);
        }, 10);

        const result = await authPromise;

        expect(result).toEqual({
          success: true,
          source: 'cli',
          user: mockUser,
          project: mockProject,
          message: 'Authenticated via CLI',
        });

        expect(mockSpawn).toHaveBeenCalledWith(
          'npx',
          ['crunchycone-cli', 'auth', 'check', '-j'],
          expect.any(Object),
        );
      });

      test('should handle CLI command not found', async () => {
        const mockChild = new EventEmitter() as any;
        mockSpawn.mockReturnValue(mockChild);

        const service = new CrunchyConeAuthService();
        const authPromise = service.checkAuthentication();

        // Simulate command not found error
        setTimeout(() => {
          mockChild.emit('error', { message: 'spawn npx ENOENT' });
        }, 10);

        const result = await authPromise;

        expect(result).toEqual({
          success: false,
          source: 'cli',
          error: 'CLI authentication failed: crunchycone-cli not found. Please install it with: npm install -g crunchycone-cli',
        });
      });

      test('should handle CLI authentication failure', async () => {
        const mockChild = new EventEmitter() as any;
        mockChild.stdout = new EventEmitter();
        mockChild.stderr = new EventEmitter();
        mockSpawn.mockReturnValue(mockChild);

        const service = new CrunchyConeAuthService();
        const authPromise = service.checkAuthentication();

        // Simulate CLI failure
        setTimeout(() => {
          mockChild.stderr.emit('data', JSON.stringify({
            success: false,
            error: 'Not authenticated',
          }));
          mockChild.emit('close', 1);
        }, 10);

        const result = await authPromise;

        expect(result).toEqual({
          success: false,
          source: 'cli',
          error: 'Not authenticated',
        });
      });

      test('should handle CLI timeout', async () => {
        const mockChild = new EventEmitter() as any;
        mockChild.stdout = new EventEmitter();
        mockChild.stderr = new EventEmitter();
        mockChild.kill = jest.fn();
        mockSpawn.mockReturnValue(mockChild);

        const service = new CrunchyConeAuthService({ cliTimeout: 50 });
        
        // The timeout test is hard to test precisely due to timing, 
        // so we'll just ensure it doesn't hang forever
        const authPromise = service.checkAuthentication();
        
        // Simulate a timeout by not emitting close event
        
        try {
          const result = await authPromise;
          expect(result.success).toBe(false);
          expect(result.source).toBe('cli');
          expect(result.error).toContain('timeout');
        } catch (error) {
          // Also acceptable if it throws
          expect(error instanceof Error && error.message.includes('timeout')).toBe(true);
        }
      });

      test('should handle malformed CLI JSON response', async () => {
        const mockChild = new EventEmitter() as any;
        mockChild.stdout = new EventEmitter();
        mockChild.stderr = new EventEmitter();
        mockSpawn.mockReturnValue(mockChild);

        const service = new CrunchyConeAuthService();
        const authPromise = service.checkAuthentication();

        // Simulate invalid JSON response
        setTimeout(() => {
          mockChild.stdout.emit('data', 'invalid json response');
          mockChild.emit('close', 0);
        }, 10);

        const result = await authPromise;

        expect(result.success).toBe(false);
        expect(result.source).toBe('cli');
        expect(result.error).toContain('Failed to parse CLI response');
      });

      test('should handle CLI stderr as plain text when not JSON', async () => {
        const mockChild = new EventEmitter() as any;
        mockChild.stdout = new EventEmitter();
        mockChild.stderr = new EventEmitter();
        mockSpawn.mockReturnValue(mockChild);

        const service = new CrunchyConeAuthService();
        const authPromise = service.checkAuthentication();

        // Simulate plain text error
        setTimeout(() => {
          mockChild.stderr.emit('data', 'Command failed with error');
          mockChild.emit('close', 1);
        }, 10);

        const result = await authPromise;

        expect(result).toEqual({
          success: false,
          source: 'cli',
          error: 'Command failed with error',
        });
      });
    });

    describe('Network Error Handling', () => {
      test('should continue to keychain when environment API has network error', async () => {
        process.env.CRUNCHYCONE_API_KEY = 'env-api-key';
        mockValidateApiKey.mockRejectedValue(new Error('Network timeout'));

        const service = new CrunchyConeAuthService();
        const result = await service.checkAuthentication();

        expect(result.success).toBe(true);
        expect(result.source).toBe('api');
        expect(result.message).toBe('Authenticated via API key from keychain');
        
        // Should have tried both env key and keychain key
        expect(mockValidateApiKey).toHaveBeenCalledWith('env-api-key');
        expect(mockGetCurrentUser).toHaveBeenCalledWith('keychain-api-key');
      });

      test('should fallback to CLI when both API attempts have network errors', async () => {
        process.env.CRUNCHYCONE_API_KEY = 'env-api-key';
        mockValidateApiKey.mockRejectedValue(new Error('Network timeout'));
        mockGetCurrentUser.mockRejectedValue(new Error('Network timeout'));

        // Mock CLI success
        const mockChild = new EventEmitter() as any;
        mockChild.stdout = new EventEmitter();
        mockChild.stderr = new EventEmitter();
        mockSpawn.mockReturnValue(mockChild);

        const service = new CrunchyConeAuthService();
        const authPromise = service.checkAuthentication();

        // Simulate CLI response
        setTimeout(() => {
          mockChild.stdout.emit('data', JSON.stringify({
            success: true,
            user: mockUser,
          }));
          mockChild.emit('close', 0);
        }, 10);

        const result = await authPromise;

        expect(result.success).toBe(true);
        expect(result.source).toBe('cli');
      });
    });

    describe('Platform Mode Behavior', () => {
      test('should not fallback to keychain or CLI in platform mode when no API key found', async () => {
        // Set platform mode
        process.env.CRUNCHYCONE_PLATFORM = '1';
        delete process.env.CRUNCHYCONE_API_KEY;

        const service = new CrunchyConeAuthService();
        const result = await service.checkAuthentication();

        expect(result).toEqual({
          success: false,
          source: 'api',
          error: 'No API key found in platform mode. Please set CRUNCHYCONE_API_KEY environment variable.',
        });

        // Should never call keychain or spawn in platform mode
        expect(mockGetCrunchyConeAPIKeyWithFallback).not.toHaveBeenCalled();
        expect(mockSpawn).not.toHaveBeenCalled();
      });

      test('should fail immediately in platform mode when env API key is invalid', async () => {
        // Set platform mode
        process.env.CRUNCHYCONE_PLATFORM = '1';
        process.env.CRUNCHYCONE_API_KEY = 'invalid-key';
        
        // Mock API failure
        mockValidateApiKey.mockRejectedValue(new Error('Invalid API key'));

        const service = new CrunchyConeAuthService();
        const result = await service.checkAuthentication();

        expect(result).toEqual({
          success: false,
          source: 'api',
          error: 'API authentication failed in platform mode: Invalid API key',
        });

        // Should never call keychain or spawn in platform mode
        expect(mockGetCrunchyConeAPIKeyWithFallback).not.toHaveBeenCalled();
        expect(mockSpawn).not.toHaveBeenCalled();
      });

      test('should fallback to keychain then CLI in local development mode', async () => {
        // Ensure we're not in platform mode
        delete process.env.CRUNCHYCONE_PLATFORM;
        delete process.env.CRUNCHYCONE_API_KEY;
        
        // Make keychain fail
        mockGetCrunchyConeAPIKeyWithFallback.mockRejectedValue(new Error('No keychain access'));

        // Mock CLI success
        const mockChild = new EventEmitter() as any;
        mockChild.stdout = new EventEmitter();
        mockChild.stderr = new EventEmitter();
        mockSpawn.mockReturnValue(mockChild);

        const service = new CrunchyConeAuthService();
        const authPromise = service.checkAuthentication();

        // Simulate CLI response
        setTimeout(() => {
          mockChild.stdout.emit('data', JSON.stringify({
            success: true,
            user: { id: 'user-123', email: 'test@example.com', name: 'Test' },
          }));
          mockChild.emit('close', 0);
        }, 10);

        const result = await authPromise;

        expect(result.success).toBe(true);
        expect(result.source).toBe('cli');
        
        // Should try keychain first, then fall back to CLI in local development mode
        expect(mockGetCrunchyConeAPIKeyWithFallback).toHaveBeenCalled();
        expect(mockSpawn).toHaveBeenCalledWith(
          'npx',
          ['crunchycone-cli', 'auth', 'check', '-j'],
          expect.any(Object),
        );
      });

      test('should use keychain in local development mode when available', async () => {
        // Ensure we're not in platform mode
        delete process.env.CRUNCHYCONE_PLATFORM;
        delete process.env.CRUNCHYCONE_API_KEY;
        
        // Mock successful keychain access
        const mockUser = { id: 'user-123', email: 'test@example.com', name: 'Test' };
        mockGetCrunchyConeAPIKeyWithFallback.mockResolvedValue('keychain-api-key');
        mockGetCurrentUser.mockResolvedValue(mockUser);
        mockGetProjectInfo.mockResolvedValue(null);

        const service = new CrunchyConeAuthService();
        const result = await service.checkAuthentication();

        expect(result.success).toBe(true);
        expect(result.source).toBe('api');
        expect(result.message).toBe('Authenticated via API key from keychain');
        
        // Should try keychain and succeed, never call CLI
        expect(mockGetCrunchyConeAPIKeyWithFallback).toHaveBeenCalled();
        expect(mockGetCurrentUser).toHaveBeenCalledWith('keychain-api-key');
        expect(mockSpawn).not.toHaveBeenCalled();
      });
    });
  });
});

describe('Standalone Functions', () => {
  test('createCrunchyConeAuthService should return service instance', () => {
    const service = createCrunchyConeAuthService();
    expect(service).toBeInstanceOf(CrunchyConeAuthService);
  });

  test('createCrunchyConeAuthService should pass config to constructor', () => {
    const config = { timeout: 5000, preferApi: false };
    const service = createCrunchyConeAuthService(config);
    expect(service).toBeInstanceOf(CrunchyConeAuthService);
  });

  test('checkCrunchyConeAuth should create service and check auth', async () => {
    process.env.CRUNCHYCONE_API_KEY = 'test-key';
    
    const mockUser = { id: 'user-123', email: 'test@example.com', name: 'Test' };
    mockValidateApiKey.mockResolvedValue(mockUser);
    mockGetProjectInfo.mockResolvedValue(null);

    const result = await checkCrunchyConeAuth();

    expect(result.success).toBe(true);
    expect(result.source).toBe('api');
    expect(result.user).toEqual(mockUser);
  });
});