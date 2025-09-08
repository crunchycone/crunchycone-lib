/**
 * CrunchyCone API Client
 * Provides direct API access to CrunchyCone services for authentication and project management
 */

import { getCrunchyConeAPIURL } from '../auth';

export interface CrunchyConeApiConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
}

export interface CrunchyConeUser {
  id: string;
  email: string;
  name?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CrunchyConeProject {
  project_id: string;
  name: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CrunchyConeApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface CrunchyConeAuthResponse {
  user: CrunchyConeUser;
  authenticated: boolean;
}

/**
 * CrunchyCone API Client for authentication and project management
 */
export class CrunchyConeApiClient {
  private config: CrunchyConeApiConfig;

  constructor(config: CrunchyConeApiConfig) {
    this.config = {
      ...config,
      baseUrl: config.baseUrl || getCrunchyConeAPIURL(),
      timeout: config.timeout || 10000, // 10 seconds default for auth calls
    };

    // Ensure baseUrl doesn't have trailing slash
    if (this.config.baseUrl) {
      this.config.baseUrl = this.config.baseUrl.replace(/\/$/, '');
    }
  }

  /**
   * Validate an API key and get authenticated user details
   * @param apiKey - The API key to validate (optional, uses config if not provided)
   * @param apiUrl - Optional custom API URL (optional, uses config if not provided)
   * @returns Promise with user details if valid
   */
  async validateApiKey(apiKey?: string, apiUrl?: string): Promise<CrunchyConeUser> {
    const keyToUse = apiKey || this.config.apiKey;
    const urlToUse = apiUrl || this.config.baseUrl;
    
    if (!keyToUse) {
      throw new Error('API key is required');
    }

    const response = await this.makeApiCall('/auth/me', 'GET', undefined, keyToUse, urlToUse);
    
    if (response.ok) {
      const data = await response.json() as CrunchyConeApiResponse<CrunchyConeAuthResponse>;
      if (data.success && data.data?.user) {
        return data.data.user;
      } else {
        throw new Error(data.error || data.message || 'Failed to validate API key');
      }
    } else {
      const errorData = await response.json().catch(() => ({ message: 'Unknown error' })) as any;
      throw new Error(`API key validation failed: ${response.status} - ${errorData.message || errorData.error || 'Invalid API key'}`);
    }
  }

  /**
   * Get authenticated user details (alias for validateApiKey for consistency)
   * @param apiKey - The API key to use (optional, uses config if not provided)  
   * @param apiUrl - Optional custom API URL (optional, uses config if not provided)
   * @returns Promise with user details
   */
  async getCurrentUser(apiKey?: string, apiUrl?: string): Promise<CrunchyConeUser> {
    return this.validateApiKey(apiKey, apiUrl);
  }

  /**
   * Get project information
   * @param apiKey - The API key to use
   * @param projectId - The project ID to fetch
   * @param apiUrl - Optional custom API URL (optional, uses config if not provided)
   * @returns Promise with project details
   */
  async getProjectInfo(apiKey: string, projectId: string, apiUrl?: string): Promise<CrunchyConeProject> {
    const urlToUse = apiUrl || this.config.baseUrl;
    
    if (!apiKey) {
      throw new Error('API key is required');
    }
    
    if (!projectId) {
      throw new Error('Project ID is required');
    }

    const response = await this.makeApiCall(`/projects/${projectId}`, 'GET', undefined, apiKey, urlToUse);
    
    if (response.ok) {
      const data = await response.json() as CrunchyConeApiResponse<CrunchyConeProject>;
      if (data.success && data.data) {
        return data.data;
      } else {
        throw new Error(data.error || data.message || 'Failed to get project info');
      }
    } else {
      const errorData = await response.json().catch(() => ({ message: 'Unknown error' })) as any;
      throw new Error(`Failed to get project info: ${response.status} - ${errorData.message || errorData.error || 'Project not found'}`);
    }
  }

  /**
   * Get environment variables for a project
   * @param apiKey - The API key to use
   * @param projectId - The project ID
   * @param apiUrl - Optional custom API URL
   * @returns Promise with environment variables
   */
  async getEnvironmentVariables(apiKey: string, projectId: string, apiUrl?: string): Promise<Record<string, string>> {
    const urlToUse = apiUrl || this.config.baseUrl;
    
    if (!apiKey) {
      throw new Error('API key is required');
    }
    
    if (!projectId) {
      throw new Error('Project ID is required');
    }

    const response = await this.makeApiCall(`/api/v1/projects/${projectId}/env-vars`, 'GET', undefined, apiKey, urlToUse);
    
    if (response.ok) {
      const data = await response.json() as any;
      return data.data?.variables || {};
    } else {
      const errorData = await response.json().catch(() => ({ message: 'Unknown error' })) as any;
      throw new Error(`Failed to get environment variables: ${response.status} - ${errorData.error?.message || errorData.message || 'Request failed'}`);
    }
  }

  /**
   * Update environment variables for a project
   * @param apiKey - The API key to use
   * @param projectId - The project ID
   * @param variables - The environment variables to update
   * @param merge - Whether to merge with existing variables (default: true)
   * @param apiUrl - Optional custom API URL
   * @returns Promise with updated variables
   */
  async updateEnvironmentVariables(
    apiKey: string, 
    projectId: string, 
    variables: Record<string, string>, 
    merge: boolean = true, 
    apiUrl?: string,
  ): Promise<Record<string, string>> {
    const urlToUse = apiUrl || this.config.baseUrl;
    
    if (!apiKey) {
      throw new Error('API key is required');
    }
    
    if (!projectId) {
      throw new Error('Project ID is required');
    }

    const body = { variables, merge };
    const response = await this.makeApiCall(`/api/v1/projects/${projectId}/env-vars`, 'PATCH', body, apiKey, urlToUse);
    
    if (response.ok) {
      const data = await response.json() as any;
      return data.data?.variables || {};
    } else {
      const errorData = await response.json().catch(() => ({ message: 'Unknown error' })) as any;
      throw new Error(`Failed to update environment variables: ${response.status} - ${errorData.error?.message || errorData.message || 'Request failed'}`);
    }
  }

  /**
   * Get secret names for a project (values are masked)
   * @param apiKey - The API key to use
   * @param projectId - The project ID
   * @param apiUrl - Optional custom API URL
   * @returns Promise with secret names
   */
  async getSecretNames(apiKey: string, projectId: string, apiUrl?: string): Promise<string[]> {
    const urlToUse = apiUrl || this.config.baseUrl;
    
    if (!apiKey) {
      throw new Error('API key is required');
    }
    
    if (!projectId) {
      throw new Error('Project ID is required');
    }

    const response = await this.makeApiCall(`/api/v1/projects/${projectId}/secrets`, 'GET', undefined, apiKey, urlToUse);
    
    if (response.ok) {
      const data = await response.json() as any;
      const secrets = data.data?.secrets || {};
      return Object.keys(secrets);
    } else {
      const errorData = await response.json().catch(() => ({ message: 'Unknown error' })) as any;
      throw new Error(`Failed to get secrets: ${response.status} - ${errorData.error?.message || errorData.message || 'Request failed'}`);
    }
  }

  /**
   * Update secrets for a project
   * @param apiKey - The API key to use
   * @param projectId - The project ID
   * @param secrets - The secrets to update
   * @param merge - Whether to merge with existing secrets (default: true)
   * @param apiUrl - Optional custom API URL
   */
  async updateSecrets(
    apiKey: string, 
    projectId: string, 
    secrets: Record<string, string>, 
    merge: boolean = true, 
    apiUrl?: string,
  ): Promise<void> {
    const urlToUse = apiUrl || this.config.baseUrl;
    
    if (!apiKey) {
      throw new Error('API key is required');
    }
    
    if (!projectId) {
      throw new Error('Project ID is required');
    }

    const body = { secrets, merge };
    const response = await this.makeApiCall(`/api/v1/projects/${projectId}/secrets`, 'PATCH', body, apiKey, urlToUse);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Unknown error' })) as any;
      throw new Error(`Failed to update secrets: ${response.status} - ${errorData.error?.message || errorData.message || 'Request failed'}`);
    }
  }

  /**
   * Delete a secret for a project
   * @param apiKey - The API key to use
   * @param projectId - The project ID
   * @param secretKey - The secret key to delete
   * @param apiUrl - Optional custom API URL
   */
  async deleteSecret(apiKey: string, projectId: string, secretKey: string, apiUrl?: string): Promise<void> {
    const urlToUse = apiUrl || this.config.baseUrl;
    
    if (!apiKey) {
      throw new Error('API key is required');
    }
    
    if (!projectId) {
      throw new Error('Project ID is required');
    }
    
    if (!secretKey) {
      throw new Error('Secret key is required');
    }

    const response = await this.makeApiCall(`/api/v1/projects/${projectId}/secrets/${secretKey}`, 'DELETE', undefined, apiKey, urlToUse);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Unknown error' })) as any;
      throw new Error(`Failed to delete secret: ${response.status} - ${errorData.error?.message || errorData.message || 'Request failed'}`);
    }
  }

  /**
   * Make an HTTP API call to CrunchyCone API
   * @private
   */
  private async makeApiCall(
    endpoint: string, 
    method: string, 
    body?: any, 
    apiKey?: string, 
    baseUrl?: string,
  ): Promise<Response> {
    const keyToUse = apiKey || this.config.apiKey;
    const urlToUse = baseUrl || this.config.baseUrl;
    const url = `${urlToUse}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-API-Key': keyToUse,
      'User-Agent': 'crunchycone-lib/1.0',
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.config.timeout}ms`);
      }
      
      // Handle network errors
      if (error instanceof Error) {
        throw new Error(`Network error: ${error.message}`);
      }
      
      throw error;
    }
  }
}

/**
 * Convenience functions for common operations
 */

/**
 * Validate an API key against CrunchyCone API
 * @param apiKey - The API key to validate
 * @param apiUrl - Optional custom API URL
 * @returns Promise with user details if valid
 */
export async function validateApiKey(apiKey: string, apiUrl?: string): Promise<CrunchyConeUser> {
  const client = new CrunchyConeApiClient({ apiKey, baseUrl: apiUrl });
  return client.validateApiKey();
}

/**
 * Get current user details from CrunchyCone API
 * @param apiKey - The API key to use
 * @param apiUrl - Optional custom API URL
 * @returns Promise with user details
 */
export async function getCurrentUser(apiKey: string, apiUrl?: string): Promise<CrunchyConeUser> {
  const client = new CrunchyConeApiClient({ apiKey, baseUrl: apiUrl });
  return client.getCurrentUser();
}

/**
 * Get project information from CrunchyCone API
 * @param apiKey - The API key to use
 * @param projectId - The project ID to fetch
 * @param apiUrl - Optional custom API URL
 * @returns Promise with project details
 */
export async function getProjectInfo(apiKey: string, projectId: string, apiUrl?: string): Promise<CrunchyConeProject> {
  const client = new CrunchyConeApiClient({ apiKey, baseUrl: apiUrl });
  return client.getProjectInfo(apiKey, projectId, apiUrl);
}