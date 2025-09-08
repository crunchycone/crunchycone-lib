/**
 * Remote Environment Provider
 * Manages environment variables and secrets via CrunchyCone API
 */

import { CrunchyConeApiClient } from '../../crunchycone-api';
import { getCrunchyConeAPIKeyWithFallback, getCrunchyConeProjectID } from '../../../auth';
import { EnvironmentProvider, ProviderType } from '../types';

export class RemoteEnvironmentProvider implements EnvironmentProvider {
  private apiClient: CrunchyConeApiClient;
  private projectId: string;
  private apiKey: string;

  constructor(config?: { projectId?: string; apiKey?: string; apiUrl?: string }) {
    // Initialize with provided config or fallback to environment/keychain
    this.projectId = config?.projectId || getCrunchyConeProjectID() || '';
    this.apiKey = config?.apiKey || '';
    
    if (!this.projectId) {
      throw new Error('Project ID is required for RemoteEnvironmentProvider. Set CRUNCHYCONE_PROJECT_ID or provide in config.');
    }

    this.apiClient = new CrunchyConeApiClient({
      apiKey: this.apiKey,
      baseUrl: config?.apiUrl,
    });
  }

  getProviderType(): ProviderType {
    return 'remote';
  }

  supportsSecrets(): boolean {
    return true;
  }

  // Environment Variables Implementation

  async getEnvVar(key: string): Promise<string | undefined> {
    const apiKey = await this.getApiKey();
    const variables = await this.apiClient.getEnvironmentVariables(apiKey, this.projectId);
    return variables[key];
  }

  async setEnvVar(key: string, value: string): Promise<void> {
    const apiKey = await this.getApiKey();
    await this.apiClient.updateEnvironmentVariables(apiKey, this.projectId, { [key]: value }, true);
  }

  async deleteEnvVar(key: string): Promise<void> {
    const apiKey = await this.getApiKey();
    
    // To delete a variable, we need to get all variables, remove the target, and update with merge=false
    const allVariables = await this.apiClient.getEnvironmentVariables(apiKey, this.projectId);
    delete allVariables[key];
    await this.apiClient.updateEnvironmentVariables(apiKey, this.projectId, allVariables, false);
  }

  async listEnvVars(): Promise<Record<string, string>> {
    const apiKey = await this.getApiKey();
    return await this.apiClient.getEnvironmentVariables(apiKey, this.projectId);
  }

  // Secrets Implementation

  async setSecret(key: string, value: string): Promise<void> {
    const apiKey = await this.getApiKey();
    await this.apiClient.updateSecrets(apiKey, this.projectId, { [key]: value }, true);
  }

  async deleteSecret(key: string): Promise<void> {
    const apiKey = await this.getApiKey();
    await this.apiClient.deleteSecret(apiKey, this.projectId, key);
  }

  async listSecretNames(): Promise<string[]> {
    const apiKey = await this.getApiKey();
    return await this.apiClient.getSecretNames(apiKey, this.projectId);
  }

  // Helper methods

  private async getApiKey(): Promise<string> {
    if (this.apiKey && this.apiKey.trim()) {
      return this.apiKey;
    }

    try {
      this.apiKey = await getCrunchyConeAPIKeyWithFallback();
      return this.apiKey;
    } catch (error) {
      throw new Error(`Failed to get API key for RemoteEnvironmentProvider: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Utility methods for configuration

  getProjectId(): string {
    return this.projectId;
  }

  hasApiKey(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim());
  }
}