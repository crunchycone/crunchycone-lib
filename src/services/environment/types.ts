/**
 * CrunchyCone Environment and Secrets Management Types
 */

export type ProviderType = 'local' | 'remote';

/**
 * Base interface for environment and secrets providers
 */
export interface EnvironmentProvider {
  // Environment Variables
  getEnvVar(key: string): Promise<string | undefined>;
  setEnvVar(key: string, value: string): Promise<void>;
  deleteEnvVar(key: string): Promise<void>;
  listEnvVars(): Promise<Record<string, string>>;
  
  // Secrets
  setSecret(key: string, value: string): Promise<void>;
  deleteSecret(key: string): Promise<void>;
  listSecretNames(): Promise<string[]>;
  
  // Provider info
  getProviderType(): ProviderType;
  supportsSecrets(): boolean;
}

/**
 * Configuration for environment service
 */
export interface EnvironmentServiceConfig {
  projectId?: string;
  apiKey?: string;
  apiUrl?: string;
  dotEnvPath?: string;
  forceProvider?: ProviderType;
}

/**
 * Result of environment variable operations
 */
export interface EnvironmentOperationResult {
  success: boolean;
  error?: string;
}

/**
 * Environment variable update request
 */
export interface EnvironmentVariablesUpdate {
  variables: Record<string, string>;
  merge?: boolean;
}

/**
 * Secrets update request  
 */
export interface SecretsUpdate {
  secrets: Record<string, string>;
  merge?: boolean;
}

/**
 * API response format for environment variables
 */
export interface EnvironmentVariablesApiResponse {
  data: {
    variables: Record<string, string>;
  };
  meta: {
    timestamp: string;
  };
}

/**
 * API response format for environment variable updates
 */
export interface EnvironmentVariablesUpdateResponse {
  data: {
    success: boolean;
    updated: string[];
    variables: Record<string, string>;
  };
  meta: {
    timestamp: string;
  };
}

/**
 * API response format for secrets (names only)
 */
export interface SecretsApiResponse {
  data: {
    secrets: Record<string, string>; // Values are always "*****"
  };
  meta: {
    timestamp: string;
  };
}

/**
 * API response format for secrets updates
 */
export interface SecretsUpdateResponse {
  data: {
    success: boolean;
    updated: string[];
    secrets: Record<string, string>; // Values are always "*****"
  };
  meta: {
    timestamp: string;
  };
}

/**
 * API response format for secret deletion
 */
export interface SecretDeleteResponse {
  data: {
    success: boolean;
    deleted: string;
    secrets: Record<string, string>; // Values are always "*****"
  };
  meta: {
    timestamp: string;
  };
}

/**
 * Error response format from API
 */
export interface ApiErrorResponse {
  error: {
    message: string;
    code: string;
  };
  meta: {
    timestamp: string;
  };
}