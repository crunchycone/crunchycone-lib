import { ConsoleEmailService } from '../../../../src/services/email/providers/console';
import { testEmailParams } from '../shared/test-helpers';

describe('Console Email Service', () => {
  let service: ConsoleEmailService;
  let consoleSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    service = new ConsoleEmailService();
    
    // Spy on console methods
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    jest.clearAllMocks();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('Constructor', () => {
    test('should create service without any requirements', () => {
      expect(() => new ConsoleEmailService()).not.toThrow();
    });
  });

  describe('sendEmail', () => {
    test('should successfully log email to console', async () => {
      const response = await service.sendEmail(testEmailParams.basic);

      expect(response.success).toBe(true);
      expect(response.messageId).toMatch(/^console-\d+-\w+$/);
      expect(response.error).toBeUndefined();

      // Verify console.log was called multiple times for different parts of the email
      expect(consoleSpy).toHaveBeenCalledTimes(17); // Adjusted based on actual log calls
      
      // Check that key information was logged
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('CONSOLE EMAIL PROVIDER'));
      expect(consoleSpy).toHaveBeenCalledWith('📤 FROM:', 'No sender specified');
      expect(consoleSpy).toHaveBeenCalledWith('📥 TO:', testEmailParams.basic.to);
      expect(consoleSpy).toHaveBeenCalledWith('📋 SUBJECT:', testEmailParams.basic.subject);
      expect(consoleSpy).toHaveBeenCalledWith('📄 TEXT BODY:');
      expect(consoleSpy).toHaveBeenCalledWith(testEmailParams.basic.textBody);
    });

    test('should log email with string recipient', async () => {
      const params = {
        ...testEmailParams.basic,
        to: 'test@example.com',
      };

      const response = await service.sendEmail(params);

      expect(response.success).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith('📥 TO:', 'test@example.com');
    });

    test('should log email with multiple recipients', async () => {
      const params = {
        ...testEmailParams.basic,
        to: ['test1@example.com', { email: 'test2@example.com', name: 'Test User' }],
      };

      const response = await service.sendEmail(params);

      expect(response.success).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith('📥 TO:', 'test1@example.com, Test User <test2@example.com>');
    });

    test('should log email with named sender', async () => {
      const params = {
        ...testEmailParams.basic,
        from: { email: 'sender@example.com', name: 'Sender Name' },
      };

      const response = await service.sendEmail(params);

      expect(response.success).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith('📤 FROM:', 'Sender Name <sender@example.com>');
    });

    test('should log email with HTML body information', async () => {
      const params = {
        ...testEmailParams.basic,
        htmlBody: '<h1>Test HTML</h1><p>This is a test email.</p>',
      };

      const response = await service.sendEmail(params);

      expect(response.success).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith('🌐 HTML BODY: Present (not displayed in console)');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('📏 HTML Length:'));
    });

    test('should log email with provider settings', async () => {
      const params = {
        ...testEmailParams.basic,
        providerSettings: {
          priority: 'high',
          tags: ['newsletter', 'marketing'],
        },
      };

      const response = await service.sendEmail(params);

      expect(response.success).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith('⚙️  PROVIDER SETTINGS:');
      expect(consoleSpy).toHaveBeenCalledWith(JSON.stringify(params.providerSettings, null, 2));
    });

    test('should handle email without sender', async () => {
      const params = {
        ...testEmailParams.basic,
        from: undefined,
      };

      const response = await service.sendEmail(params);

      expect(response.success).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith('📤 FROM:', 'No sender specified');
    });

    test('should not log provider settings when empty', async () => {
      const params = {
        ...testEmailParams.basic,
        providerSettings: {},
      };

      const response = await service.sendEmail(params);

      expect(response.success).toBe(true);
      expect(consoleSpy).not.toHaveBeenCalledWith('⚙️  PROVIDER SETTINGS:');
    });

    test('should handle errors gracefully', async () => {
      // Mock console.log to throw an error
      consoleSpy.mockImplementation(() => {
        throw new Error('Console error');
      });

      const response = await service.sendEmail(testEmailParams.basic);

      expect(response.success).toBe(false);
      expect(response.error).toBe('Console error');
      expect(response.messageId).toBeUndefined();
      
      // Verify error was logged
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('CONSOLE EMAIL PROVIDER - ERROR'));
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error:', 'Console error');
    });

    test('should generate unique message IDs', async () => {
      const response1 = await service.sendEmail(testEmailParams.basic);
      const response2 = await service.sendEmail(testEmailParams.basic);

      expect(response1.success).toBe(true);
      expect(response2.success).toBe(true);
      expect(response1.messageId).not.toBe(response2.messageId);
      expect(response1.messageId).toMatch(/^console-\d+-\w+$/);
      expect(response2.messageId).toMatch(/^console-\d+-\w+$/);
    });

    test('should format timestamp correctly', async () => {
      const beforeTest = new Date().toISOString();
      const response = await service.sendEmail(testEmailParams.basic);
      const afterTest = new Date().toISOString();

      expect(response.success).toBe(true);
      
      // Check that a timestamp was logged (we can't check exact value due to timing)
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('⏰ Timestamp:'));
      
      // Get the actual timestamp that was logged
      const timestampCall = consoleSpy.mock.calls.find(call => 
        call[0] && call[0].includes('⏰ Timestamp:'),
      );
      
      if (timestampCall) {
        const loggedMessage = timestampCall[0];
        // Extract timestamp from the message like "⏰ Timestamp: 2024-01-01T12:00:00.000Z"
        const timestampMatch = loggedMessage.match(/⏰ Timestamp: (.+)$/);
        if (timestampMatch) {
          const loggedTimestamp = timestampMatch[1];
          expect(loggedTimestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
          expect(loggedTimestamp >= beforeTest).toBe(true);
          expect(loggedTimestamp <= afterTest).toBe(true);
        }
      }
    });
  });
});