/**
 * CrunchyCone Environment and Secrets Management
 * 
 * This module provides a unified interface for managing environment variables and secrets
 * that automatically adapts to the runtime environment:
 * 
 * - Local Environment (CRUNCHYCONE_PLATFORM != "1"): Manages .env files, secrets are no-ops
 * - Platform Environment (CRUNCHYCONE_PLATFORM = "1"): Uses CrunchyCone API for both
 * 
 * @example Basic Usage
 * ```typescript
 * import { getCrunchyConeEnvironmentService } from 'crunchycone-lib/environment';
 * 
 * const envService = getCrunchyConeEnvironmentService();
 * 
 * // Works in both local and platform environments
 * await envService.setEnvVar('DATABASE_URL', 'postgres://...');
 * const dbUrl = await envService.getEnvVar('DATABASE_URL');
 * 
 * // Secrets only work in platform environment (no-op locally)
 * await envService.setSecret('API_TOKEN', 'secret-value');
 * const secretNames = await envService.listSecretNames();
 * ```
 * 
 * @example Environment Detection
 * ```typescript
 * import { isPlatformEnvironment, getProviderType } from 'crunchycone-lib/environment';
 * 
 * if (isPlatformEnvironment()) {
 *   console.log('Running in CrunchyCone platform');
 * } else {
 *   console.log('Running locally');
 * }
 * 
 * console.log('Provider type:', getProviderType()); // 'local' or 'remote'
 * ```
 * 
 * @example Custom Configuration
 * ```typescript
 * import { createCrunchyConeEnvironmentService } from 'crunchycone-lib/environment';
 * 
 * const envService = createCrunchyConeEnvironmentService({
 *   forceProvider: 'local',  // Override environment detection
 *   dotEnvPath: './custom/.env',  // Custom .env file path
 *   projectId: 'my-project-id',   // Custom project ID
 *   apiKey: 'my-api-key'          // Custom API key
 * });
 * ```
 */

// Main service class and factory functions
export {
  CrunchyConeEnvironmentService,
  createCrunchyConeEnvironmentService,
  getCrunchyConeEnvironmentService,
  isPlatformEnvironment,
  getProviderType,
} from './service';

// Types and interfaces
export type {
  EnvironmentProvider,
  EnvironmentServiceConfig,
  EnvironmentOperationResult,
  EnvironmentVariablesUpdate,
  SecretsUpdate,
  ProviderType,
  EnvironmentVariablesApiResponse,
  EnvironmentVariablesUpdateResponse,
  SecretsApiResponse,
  SecretsUpdateResponse,
  SecretDeleteResponse,
  ApiErrorResponse,
} from './types';

// Provider implementations (for advanced usage)
export { LocalEnvironmentProvider } from './providers/local-provider';
export { RemoteEnvironmentProvider } from './providers/remote-provider';