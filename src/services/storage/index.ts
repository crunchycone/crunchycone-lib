// Core types and interfaces
export * from './types';

// Main storage functions
export * from './storage';

// Configuration
export { initializeStorageProvider } from './config';

// Validation utilities
export * from './validation';

// Helper utilities
export * from './utils';

// Note: Individual storage providers are available via specific imports to avoid loading optional dependencies:
// - import { LocalStorageProvider } from 'crunchycone-lib/storage/providers/local'
// - import { S3CompatibleProvider } from 'crunchycone-lib/storage/providers/s3'
// - import { GCPStorageProvider } from 'crunchycone-lib/storage/providers/gcp'
// - import { AzureStorageProvider } from 'crunchycone-lib/storage/providers/azure'
// - import { CrunchyConeProvider } from 'crunchycone-lib/storage/providers/crunchycone'

// Provider configuration types
export type { AWSS3Config } from './providers/aws-s3';
export type { DigitalOceanSpacesConfig } from './providers/digitalocean';
export type { WasabiConfig } from './providers/wasabi';
export type { BackblazeB2Config } from './providers/backblaze';
export type { CloudflareR2Config } from './providers/r2';
export type { GCPStorageConfig } from './providers/gcp-storage';
export type { AzureStorageConfig } from './providers/azure-storage';
export type { CrunchyConeConfig } from './providers/crunchycone';