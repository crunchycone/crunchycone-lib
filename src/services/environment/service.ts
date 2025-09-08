/**
 * CrunchyCone Environment Service
 * Unified interface for managing environment variables and secrets
 * Automatically detects and uses appropriate provider based on CRUNCHYCONE_PLATFORM
 */

import { EnvironmentProvider, EnvironmentServiceConfig, ProviderType } from './types';
import { LocalEnvironmentProvider } from './providers/local-provider';
import { RemoteEnvironmentProvider } from './providers/remote-provider';

export class CrunchyConeEnvironmentService implements EnvironmentProvider {
  private provider: EnvironmentProvider;
  private readonly initialPlatformState: boolean;

  constructor(config?: EnvironmentServiceConfig) {
    this.initialPlatformState = this.detectCurrentPlatformState(config);
    this.provider = this.createProvider(config);
  }

  // Provider Detection and Creation

  private createProvider(config?: EnvironmentServiceConfig): EnvironmentProvider {
    const providerType = this.detectProviderType(config);
    
    switch (providerType) {
      case 'local':
        return new LocalEnvironmentProvider(config?.dotEnvPath);
      case 'remote':
        return new RemoteEnvironmentProvider({
          projectId: config?.projectId,
          apiKey: config?.apiKey,
          apiUrl: config?.apiUrl,
        });
      default:
        throw new Error(`Unsupported provider type: ${providerType}`);
    }
  }

  private detectProviderType(config?: EnvironmentServiceConfig): ProviderType {
    // Allow explicit override via config
    if (config?.forceProvider) {
      return config.forceProvider;
    }

    // Use initial platform state detected at construction time
    return this.initialPlatformState ? 'remote' : 'local';
  }

  private detectCurrentPlatformState(config?: EnvironmentServiceConfig): boolean {
    // Allow explicit override via config
    if (config?.forceProvider) {
      return config.forceProvider === 'remote';
    }
    
    // Detect based on CRUNCHYCONE_PLATFORM environment variable at construction time
    return process.env.CRUNCHYCONE_PLATFORM === '1';
  }

  /**
   * Check if running in CrunchyCone platform environment
   * @returns true if CRUNCHYCONE_PLATFORM=1 at construction time, false otherwise
   */
  public isPlatformEnvironment(): boolean {
    return this.initialPlatformState;
  }

  // Delegate all provider methods

  getProviderType(): ProviderType {
    return this.provider.getProviderType();
  }

  supportsSecrets(): boolean {
    return this.provider.supportsSecrets();
  }

  // Environment Variables

  async getEnvVar(key: string): Promise<string | undefined> {
    return this.provider.getEnvVar(key);
  }

  async setEnvVar(key: string, value: string): Promise<void> {
    return this.provider.setEnvVar(key, value);
  }

  async deleteEnvVar(key: string): Promise<void> {
    return this.provider.deleteEnvVar(key);
  }

  async listEnvVars(): Promise<Record<string, string>> {
    return this.provider.listEnvVars();
  }

  // Secrets

  async setSecret(key: string, value: string): Promise<void> {
    return this.provider.setSecret(key, value);
  }

  async deleteSecret(key: string): Promise<void> {
    return this.provider.deleteSecret(key);
  }

  async listSecretNames(): Promise<string[]> {
    return this.provider.listSecretNames();
  }

  // Utility methods

  /**
   * Get the underlying provider instance
   * Useful for provider-specific operations or debugging
   */
  getProvider(): EnvironmentProvider {
    return this.provider;
  }

  /**
   * Get information about the current configuration
   */
  getProviderInfo(): {
    type: ProviderType;
    supportsSecrets: boolean;
    isPlatformEnvironment: boolean;
  } {
    return {
      type: this.getProviderType(),
      supportsSecrets: this.supportsSecrets(),
      isPlatformEnvironment: this.isPlatformEnvironment(),
    };
  }

  // Convenience methods for common operations

  /**
   * Bulk set environment variables
   * @param variables - Key-value pairs to set
   */
  async setEnvVars(variables: Record<string, string>): Promise<void> {
    // For local provider, set variables sequentially to avoid file system conflicts
    if (this.getProviderType() === 'local') {
      for (const [key, value] of Object.entries(variables)) {
        await this.setEnvVar(key, value);
      }
    } else {
      // For remote provider, can set in parallel
      await Promise.all(
        Object.entries(variables).map(([key, value]) => this.setEnvVar(key, value)),
      );
    }
  }

  /**
   * Bulk set secrets
   * @param secrets - Key-value pairs to set
   */
  async setSecrets(secrets: Record<string, string>): Promise<void> {
    if (!this.supportsSecrets()) {
      console.warn('Secrets are not supported by the current provider. Operation skipped.');
      return;
    }

    await Promise.all(
      Object.entries(secrets).map(([key, value]) => this.setSecret(key, value)),
    );
  }

  /**
   * Get multiple environment variables at once
   * @param keys - Array of keys to retrieve
   * @returns Object with key-value pairs for found variables
   */
  async getEnvVars(keys: string[]): Promise<Record<string, string>> {
    const results: Record<string, string> = {};
    
    await Promise.all(
      keys.map(async (key) => {
        const value = await this.getEnvVar(key);
        if (value !== undefined) {
          results[key] = value;
        }
      }),
    );

    return results;
  }
}

/**
 * Factory function to create a CrunchyCone Environment Service
 * @param config - Optional configuration
 * @returns Configured CrunchyConeEnvironmentService instance
 */
export function createCrunchyConeEnvironmentService(config?: EnvironmentServiceConfig): CrunchyConeEnvironmentService {
  return new CrunchyConeEnvironmentService(config);
}

/**
 * Global service instance for convenience
 * Automatically detects environment and creates appropriate provider
 */
let globalService: CrunchyConeEnvironmentService | null = null;

/**
 * Get or create global environment service instance
 * @param config - Optional configuration (only used on first call)
 * @returns Global CrunchyConeEnvironmentService instance
 */
export function getCrunchyConeEnvironmentService(config?: EnvironmentServiceConfig): CrunchyConeEnvironmentService {
  if (!globalService) {
    globalService = new CrunchyConeEnvironmentService(config);
  }
  return globalService;
}

/**
 * Check if running in CrunchyCone platform environment
 * Utility function that doesn't require service instantiation
 * @returns true if CRUNCHYCONE_PLATFORM=1, false otherwise
 */
export function isPlatformEnvironment(): boolean {
  return process.env.CRUNCHYCONE_PLATFORM === '1';
}

/**
 * Get the provider type that would be used in current environment
 * Utility function that doesn't require service instantiation
 * @param forceProvider - Optional override
 * @returns Provider type that would be selected
 */
export function getProviderType(forceProvider?: ProviderType): ProviderType {
  if (forceProvider) {
    return forceProvider;
  }
  return isPlatformEnvironment() ? 'remote' : 'local';
}