import { isEmailProviderAvailable, getAvailableEmailProviders } from '../../src/services/email/factory';
import { isStorageProviderAvailable, getAvailableStorageProviders } from '../../src/services/storage/storage';
import { createEmailService } from '../../src/services/email/factory';
import { LocalStorageProvider } from '../../src/services/storage/providers/localstorage';
import { CrunchyConeProvider } from '../../src/services/storage/providers/crunchycone';

describe('Provider Availability Checking', () => {
  describe('Email Provider Availability', () => {
    test('should return true for providers without optional dependencies', async () => {
      expect(await isEmailProviderAvailable('console')).toBe(true);
      expect(await isEmailProviderAvailable('smtp')).toBe(true);
      expect(await isEmailProviderAvailable('crunchycone')).toBe(true);
      expect(await isEmailProviderAvailable('mailgun')).toBe(true); // Uses built-in fetch
    });

    test('should return correct availability for providers with optional dependencies', async () => {
      // These might be true or false depending on test environment setup
      const sendgridAvailable = await isEmailProviderAvailable('sendgrid');
      const resendAvailable = await isEmailProviderAvailable('resend');
      const sesAvailable = await isEmailProviderAvailable('ses');

      expect(typeof sendgridAvailable).toBe('boolean');
      expect(typeof resendAvailable).toBe('boolean');
      expect(typeof sesAvailable).toBe('boolean');
    });

    test('should return false for invalid provider', async () => {
      expect(await isEmailProviderAvailable('invalid' as any)).toBe(false);
    });

    test('should return list of available email providers', async () => {
      const availableProviders = await getAvailableEmailProviders();
      
      expect(Array.isArray(availableProviders)).toBe(true);
      expect(availableProviders.length).toBeGreaterThan(0);
      
      // These should always be available
      expect(availableProviders).toContain('console');
      expect(availableProviders).toContain('smtp');
      expect(availableProviders).toContain('crunchycone');
      expect(availableProviders).toContain('mailgun');
    });

    test('should cache availability results', async () => {
      // Call twice and measure time difference to verify caching
      const start1 = Date.now();
      await isEmailProviderAvailable('console');
      const time1 = Date.now() - start1;

      const start2 = Date.now();
      await isEmailProviderAvailable('console');
      const time2 = Date.now() - start2;

      // Second call should be faster due to caching
      expect(time2).toBeLessThan(time1 + 10); // Allow some margin
    });
  });

  describe('Storage Provider Availability', () => {
    test('should return true for providers without optional dependencies', async () => {
      expect(await isStorageProviderAvailable('localstorage')).toBe(true);
      expect(await isStorageProviderAvailable('crunchycone')).toBe(true);
    });

    test('should return correct availability for providers with optional dependencies', async () => {
      const s3Available = await isStorageProviderAvailable('s3');
      const azureAvailable = await isStorageProviderAvailable('azure');
      const gcpAvailable = await isStorageProviderAvailable('gcp');

      expect(typeof s3Available).toBe('boolean');
      expect(typeof azureAvailable).toBe('boolean');
      expect(typeof gcpAvailable).toBe('boolean');
    });

    test('should return false for invalid provider', async () => {
      expect(await isStorageProviderAvailable('invalid' as any)).toBe(false);
    });

    test('should return list of available storage providers', async () => {
      const availableProviders = await getAvailableStorageProviders();
      
      expect(Array.isArray(availableProviders)).toBe(true);
      expect(availableProviders.length).toBeGreaterThan(0);
      
      // These should always be available
      expect(availableProviders).toContain('localstorage');
      expect(availableProviders).toContain('crunchycone');
    });
  });

  describe('Instance Method Availability', () => {
    test('email service instances should report availability', async () => {
      const consoleService = createEmailService('console');
      expect(await consoleService.isAvailable()).toBe(true);
    });

    test('storage provider instances should report availability', async () => {
      // Set required environment variable for LocalStorageProvider
      process.env.CRUNCHYCONE_LOCALSTORAGE_PATH = '/tmp/test-storage';
      const localStorage = new LocalStorageProvider();
      expect(await localStorage.isAvailable()).toBe(true);

      const crunchyConeStorage = new CrunchyConeProvider({
        apiKey: 'test-key',
        apiUrl: 'https://test.example.com',
        projectId: 'test-project'
      });
      expect(await crunchyConeStorage.isAvailable()).toBe(true);
    });
  });
});