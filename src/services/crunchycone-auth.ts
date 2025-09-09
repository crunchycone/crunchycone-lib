/**
 * Unified CrunchyCone Authentication Service
 * Provides API-first authentication with CLI fallback for CrunchyCone services
 */

import { spawn } from 'child_process';
import { validateApiKey, getCurrentUser } from './crunchycone-api';
import { getCrunchyConeAPIKeyWithFallback, getCrunchyConeProjectID } from '../auth';

export interface CrunchyConeAuthResult {
  success: boolean;
  source: 'api' | 'cli';
  user?: {
    email: string;
    name?: string;
    id?: string;
  };
  project?: {
    project_id: string;
    name?: string;
  };
  error?: string;
  message?: string;
}

export interface CrunchyConeAuthServiceConfig {
  timeout?: number; // Timeout in milliseconds
  preferApi?: boolean; // If true, prefer API over CLI even when both are available
  cliTimeout?: number; // Separate timeout for CLI operations
}

/**
 * CLI response format for crunchycone auth check -j
 */
interface CrunchyConeCliAuthResponse {
  success: boolean;
  user?: {
    email: string;
    name?: string;
    id?: string;
  };
  project?: {
    project_id: string;
    name?: string;
  };
  message?: string;
  error?: string;
}

/**
 * Unified CrunchyCone Authentication Service
 * Attempts API authentication first, falls back to CLI if needed
 */
export class CrunchyConeAuthService {
  private config: Required<CrunchyConeAuthServiceConfig>;

  constructor(config: CrunchyConeAuthServiceConfig = {}) {
    this.config = {
      timeout: config.timeout || 10000, // 10 seconds default
      preferApi: config.preferApi !== false, // Default to true
      cliTimeout: config.cliTimeout || 15000, // 15 seconds for CLI
    };
  }

  /**
   * Check authentication using API-first approach with CLI fallback
   * @returns Promise with authentication result
   */
  async checkAuthentication(): Promise<CrunchyConeAuthResult> {
    const isPlatformMode = process.env.CRUNCHYCONE_PLATFORM === '1';
    
    // 1. Always check environment variable first (both platform and local mode)
    const envApiKey = process.env.CRUNCHYCONE_API_KEY;
    if (envApiKey && envApiKey.trim()) {
      try {
        const user = await validateApiKey(envApiKey);
        const project = await this.getProjectInfoSafely(envApiKey);
        
        return {
          success: true,
          source: 'api',
          user: {
            email: user.email,
            name: user.name,
            id: user.id,
          },
          project: project ? {
            project_id: project.project_id,
            name: project.name,
          } : undefined,
          message: 'Authenticated via API key',
        };
      } catch (apiError) {
        const errorMessage = apiError instanceof Error ? apiError.message : 'Unknown API error';
        
        // In platform mode, fail immediately if env API key is invalid
        if (isPlatformMode) {
          return {
            success: false,
            source: 'api',
            error: `API authentication failed in platform mode: ${errorMessage}`,
          };
        }
        
        // In local mode, if it's clearly an invalid key error, don't try fallbacks
        if (errorMessage.includes('Invalid API key') || errorMessage.includes('401')) {
          return {
            success: false,
            source: 'api',
            error: `API authentication failed: ${errorMessage}`,
          };
        }
        
        // For other errors (network, timeout) in local mode, continue to fallbacks
      }
    }

    // In platform mode, if no environment API key was found, fail immediately
    if (isPlatformMode) {
      return {
        success: false,
        source: 'api',
        error: 'No API key found in platform mode. Please set CRUNCHYCONE_API_KEY environment variable.',
      };
    }

    // 2. Local development mode only: Try keychain first
    try {
      const keychainApiKey = await getCrunchyConeAPIKeyWithFallback();
      if (keychainApiKey) {
        try {
          const user = await getCurrentUser(keychainApiKey);
          const project = await this.getProjectInfoSafely(keychainApiKey);
          
          return {
            success: true,
            source: 'api',
            user: {
              email: user.email,
              name: user.name,
              id: user.id,
            },
            project: project ? {
              project_id: project.project_id,
              name: project.name,
            } : undefined,
            message: 'Authenticated via API key from keychain',
          };
        } catch (apiError) {
          // API failed with keychain key, fall back to CLI
          const errorMessage = apiError instanceof Error ? apiError.message : 'Unknown API error';
          
          // If it's clearly an invalid key error, don't try CLI
          if (errorMessage.includes('Invalid API key') || errorMessage.includes('401')) {
            return {
              success: false,
              source: 'api',
              error: `API authentication failed: ${errorMessage}`,
            };
          }
          
          // For other errors (network, timeout), continue to CLI fallback
        }
      }
    } catch (_error) {
      // Keychain access failed, continue to CLI fallback
    }

    // 3. Fallback to CLI approach (only in local development mode)
    // Note: isPlatformMode already declared at the top of the function
    
    // Only use CLI fallback in local development mode
    try {
      const cliResult = await this.executeCliAuthCheck();
      return {
        success: cliResult.success,
        source: 'cli',
        user: cliResult.user,
        project: cliResult.project,
        error: cliResult.error,
        message: cliResult.success ? 'Authenticated via CLI' : cliResult.message,
      };
    } catch (cliError) {
      const errorMessage = cliError instanceof Error ? cliError.message : 'Unknown CLI error';
      return {
        success: false,
        source: 'cli',
        error: `CLI authentication failed: ${errorMessage}`,
      };
    }
  }

  /**
   * Safely get project info without failing the entire auth check
   * @private
   */
  private async getProjectInfoSafely(apiKey: string) {
    try {
      const projectId = getCrunchyConeProjectID();
      if (projectId) {
        const { getProjectInfo } = await import('./crunchycone-api');
        return await getProjectInfo(apiKey, projectId);
      }
    } catch (_error) {
      // Project info is optional, don't fail auth if it's not available
    }
    return undefined;
  }

  /**
   * Execute CLI auth check command
   * @private
   */
  private async executeCliAuthCheck(): Promise<CrunchyConeCliAuthResponse> {
    return new Promise((resolve, reject) => {
      const child = spawn('npx', ['crunchycone-cli', 'auth', 'check', '-j'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      // Set up timeout
      const timeoutId = setTimeout(() => {
        if (!child.killed) {
          child.kill('SIGTERM');
          reject(new Error(`CLI command timeout after ${this.config.cliTimeout}ms`));
        }
      }, this.config.cliTimeout);

      child.on('close', (code) => {
        clearTimeout(timeoutId);
        
        if (code === 0) {
          try {
            const result = JSON.parse(stdout.trim()) as CrunchyConeCliAuthResponse;
            resolve(result);
          } catch (parseError) {
            reject(new Error(`Failed to parse CLI response: ${parseError instanceof Error ? parseError.message : 'Invalid JSON'}`));
          }
        } else {
          let errorMessage = 'CLI command failed';
          
          try {
            // Try to parse stderr as JSON for structured error
            const errorResult = JSON.parse(stderr.trim());
            errorMessage = errorResult.error || errorResult.message || errorMessage;
          } catch {
            // Use stderr as plain text if not JSON
            errorMessage = stderr.trim() || `CLI command exited with code ${code}`;
          }
          
          resolve({
            success: false,
            error: errorMessage,
          });
        }
      });

      child.on('error', (error) => {
        clearTimeout(timeoutId);
        
        if (error.message.includes('ENOENT')) {
          reject(new Error('crunchycone-cli not found. Please install it with: npm install -g crunchycone-cli'));
        } else {
          reject(new Error(`Failed to execute CLI command: ${error.message}`));
        }
      });
    });
  }
}

/**
 * Create and configure a CrunchyCone authentication service
 * @param config - Optional configuration
 * @returns CrunchyConeAuthService instance
 */
export function createCrunchyConeAuthService(config?: CrunchyConeAuthServiceConfig): CrunchyConeAuthService {
  return new CrunchyConeAuthService(config);
}

/**
 * Convenience function to check authentication with default settings
 * @param config - Optional configuration
 * @returns Promise with authentication result
 */
export async function checkCrunchyConeAuth(config?: CrunchyConeAuthServiceConfig): Promise<CrunchyConeAuthResult> {
  const service = createCrunchyConeAuthService(config);
  return service.checkAuthentication();
}