import * as fs from 'fs';
import * as path from 'path';

/**
 * Dynamically imports keytar only when needed, using eval to avoid bundler resolution
 * @returns Promise<any> The keytar module
 */
async function loadKeytar(): Promise<any> {
  try {
    // Use eval to prevent bundlers from trying to resolve keytar at build time
    const keytar = await eval('import("keytar")');
    return keytar;
  } catch (_error) {
    throw new Error('keytar is not available. This functionality requires keytar to be installed.');
  }
}

/**
 * Reads the CrunchyCone CLI API key from the system keychain
 * @returns Promise<string> The API key, or throws an error if not found
 */
export async function getCrunchyConeAPIKey(): Promise<string> {
  const SERVICE_NAME = 'crunchycone-cli';
  const ACCOUNT_NAME = 'default';

  try {
    const keytar = await loadKeytar();
    const apiKey = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);

    if (!apiKey) {
      throw new Error('CrunchyCone API key not found. Please run: crunchycone auth login');
    }

    return apiKey;
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new Error('CrunchyCone API key not found. Please run: crunchycone auth login');
    }
    if (error instanceof Error && error.message.includes('keytar is not available')) {
      throw error; // Re-throw keytar availability errors as-is
    }
    throw new Error(`Failed to read API key from keychain: ${(error as Error).message}`);
  }
}

/**
 * Checks if CrunchyCone CLI API key exists in environment variable or keychain
 * @returns Promise<boolean> True if API key exists, false otherwise
 */
export async function hasCrunchyConeAPIKey(): Promise<boolean> {
  try {
    await getCrunchyConeAPIKeyWithFallback();
    return true;
  } catch {
    return false;
  }
}

/**
 * Gets the CrunchyCone API key from environment variable or keychain
 * Tries environment variable first, then falls back to keychain
 * @returns Promise<string> The API key
 * @throws Error if API key is not found in either location
 */
export async function getCrunchyConeAPIKeyWithFallback(): Promise<string> {
  // First try environment variable
  const envApiKey = process.env.CRUNCHYCONE_API_KEY;
  if (envApiKey && envApiKey.trim()) {
    return envApiKey.trim();
  }

  // Fall back to keychain only if environment variable is not set
  try {
    return await getCrunchyConeAPIKey();
  } catch (error) {
    // If keytar failed to load, provide a more helpful error message
    if (error instanceof Error && error.message.includes('keytar is not available')) {
      throw new Error(
        'CrunchyCone API key not found in environment variable CRUNCHYCONE_API_KEY. ' +
        'Keychain access is not available (keytar not installed). ' +
        'Please set CRUNCHYCONE_API_KEY environment variable.',
      );
    }
    throw new Error(
      'CrunchyCone API key not found. ' +
      'Set CRUNCHYCONE_API_KEY environment variable or run: crunchycone auth login',
    );
  }
}


/**
 * Simple TOML parser for crunchycone.toml files
 * Only handles basic key=value pairs and [sections]
 */
interface CrunchyConeTomlConfig {
  environment?: string;
  project?: {
    id?: string;
  };
}

function parseSimpleToml(content: string): CrunchyConeTomlConfig {
  const config: CrunchyConeTomlConfig = {};
  const lines = content.split('\n');
  let currentSection = '';

  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    // Handle sections like [project]
    const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      continue;
    }

    // Handle key=value pairs
    const keyValueMatch = trimmed.match(/^([^=]+)=(.*)$/);
    if (keyValueMatch) {
      const key = keyValueMatch[1].trim();
      const value = keyValueMatch[2].trim().replace(/^["']|["']$/g, ''); // Remove quotes

      if (currentSection === 'project') {
        if (!config.project) config.project = {};
        if (key === 'id') {
          config.project.id = value;
        }
      } else if (currentSection === '' && key === 'environment') {
        config.environment = value;
      }
    }
  }

  return config;
}

/**
 * Finds and reads crunchycone.toml file starting from current directory
 * and walking up to find the project root
 */
function findCrunchyConeToml(): CrunchyConeTomlConfig | null {
  let currentDir = process.cwd();
  const root = path.parse(currentDir).root;

  while (currentDir !== root) {
    const tomlPath = path.join(currentDir, 'crunchycone.toml');
    
    if (fs.existsSync(tomlPath)) {
      try {
        const content = fs.readFileSync(tomlPath, 'utf-8');
        return parseSimpleToml(content);
      } catch (error) {
        // If we can't read the file, continue searching up
        console.warn(`Warning: Found crunchycone.toml at ${tomlPath} but couldn't read it:`, error);
      }
    }

    // Move up one directory
    const parent = path.dirname(currentDir);
    if (parent === currentDir) break; // Reached filesystem root
    currentDir = parent;
  }

  return null;
}

/**
 * Gets the CrunchyCone API URL from environment variable with fallback to crunchycone.toml and default
 * @returns string The API URL
 */
export function getCrunchyConeAPIURL(): string {
  // First try environment variable
  if (process.env.CRUNCHYCONE_API_URL) {
    return process.env.CRUNCHYCONE_API_URL;
  }

  // Try to read from crunchycone.toml
  const tomlConfig = findCrunchyConeToml();
  if (tomlConfig?.environment) {
    if (tomlConfig.environment === 'dev') {
      return 'https://api.crunchycone.dev';
    }
    // For any other environment (prod, staging, etc.), use production URL
    return 'https://api.crunchycone.dev';
  }

  // Default fallback
  return 'https://api.crunchycone.dev';
}

/**
 * Gets the CrunchyCone project ID from environment variable with fallback to crunchycone.toml
 * @returns string | undefined The project ID if set
 */
export function getCrunchyConeProjectID(): string | undefined {
  // First try environment variable
  if (process.env.CRUNCHYCONE_PROJECT_ID) {
    return process.env.CRUNCHYCONE_PROJECT_ID;
  }

  // Try to read from crunchycone.toml
  const tomlConfig = findCrunchyConeToml();
  return tomlConfig?.project?.id;
}