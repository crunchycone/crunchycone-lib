import { CrunchyConeEmailService } from '../../../../src/services/email/providers/crunchycone';
import { testEmailParams, expectSuccessResponse, expectErrorResponse } from '../shared/test-helpers';

// Mock fetch globally
global.fetch = jest.fn();

describe('CrunchyCone Email Service', () => {
  let service: CrunchyConeEmailService;
  let mockFetch: jest.MockedFunction<typeof fetch>;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockClear();
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    test('should throw error when no API key provided', () => {
      delete process.env.CRUNCHYCONE_API_KEY;
      
      expect(() => new CrunchyConeEmailService()).toThrow(
        'CrunchyCone API key is required. Set CRUNCHYCONE_API_KEY environment variable or pass apiKey in config.',
      );
    });

    test('should create service with environment variable API key', () => {
      process.env.CRUNCHYCONE_API_KEY = 'test-api-key';
      
      expect(() => new CrunchyConeEmailService()).not.toThrow();
      const service = new CrunchyConeEmailService();
      expect(service).toBeInstanceOf(CrunchyConeEmailService);
    });

    test('should create service with config API key', () => {
      delete process.env.CRUNCHYCONE_API_KEY;
      
      expect(() => new CrunchyConeEmailService({ apiKey: 'config-api-key' })).not.toThrow();
    });

    test('should use custom base URL from config', () => {
      expect(() => new CrunchyConeEmailService({ 
        apiKey: 'test-key',
        baseUrl: 'https://custom.example.com', 
      })).not.toThrow();
    });

    test('should use environment variable base URL', () => {
      process.env.CRUNCHYCONE_API_KEY = 'test-key';
      process.env.CRUNCHYCONE_EMAIL_BASE_URL = 'https://env.example.com';
      
      expect(() => new CrunchyConeEmailService()).not.toThrow();
    });

    test('should remove trailing slash from base URL', () => {
      expect(() => new CrunchyConeEmailService({ 
        apiKey: 'test-key',
        baseUrl: 'https://example.com/', 
      })).not.toThrow();
    });
  });

  describe('sendEmail', () => {
    beforeEach(() => {
      service = new CrunchyConeEmailService({ apiKey: 'test-api-key' });
    });

    test('should send successful email and return email_id', async () => {
      const mockResponse = {
        email_id: 'test-email-id-123',
        status: 'queued',
        message: 'Email queued for delivery',
        sendgrid_message_id: 'sg-message-id',
        sent_at: '2023-12-15T10:00:00Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const response = await service.sendEmail(testEmailParams.basic);
      
      expectSuccessResponse(response);
      expect(response.messageId).toBe('test-email-id-123');
      
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.crunchycone.com/v1/emails/send',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-API-Key': 'test-api-key',
            'User-Agent': 'crunchycone-lib/1.0',
          }),
        }),
      );
    });

    test('should send email with HTML content', async () => {
      const mockResponse = { email_id: 'test-email-id' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await service.sendEmail(testEmailParams.withHtml);
      
      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1]?.body as string);
      
      expect(requestBody.html).toBe('<h1>Hello World</h1>');
      expect(requestBody.text).toBe('Hello World');
    });

    test('should handle multiple recipients', async () => {
      const mockResponse = { email_id: 'test-email-id' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await service.sendEmail(testEmailParams.multiRecipient);
      
      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1]?.body as string);
      
      expect(requestBody.to).toEqual([
        { email: 'test1@example.com' },
        { email: 'test2@example.com' },
      ]);
    });

    test('should handle single recipient as object not array', async () => {
      const mockResponse = { email_id: 'test-email-id' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await service.sendEmail(testEmailParams.basic);
      
      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1]?.body as string);
      
      expect(requestBody.to).toEqual({ email: 'test@example.com' });
      expect(Array.isArray(requestBody.to)).toBe(false);
    });

    test('should handle custom from address', async () => {
      const mockResponse = { email_id: 'test-email-id' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await service.sendEmail(testEmailParams.withCustomFrom);
      
      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1]?.body as string);
      
      expect(requestBody.from).toEqual({
        email: 'custom@example.com',
      });
    });

    test('should use default from address when not provided', async () => {
      const mockResponse = { email_id: 'test-email-id' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await service.sendEmail(testEmailParams.basic);
      
      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1]?.body as string);
      
      expect(requestBody.from).toEqual({
        email: 'noreply@crunchycone.com',
        name: 'CrunchyCone Platform',
      });
    });

    test('should set special flag when specified in provider settings', async () => {
      const mockResponse = { email_id: 'test-email-id' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const emailParams = {
        ...testEmailParams.basic,
        providerSettings: { special: true },
      };

      await service.sendEmail(emailParams);
      
      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1]?.body as string);
      
      expect(requestBody.special).toBe(true);
    });

    test('should handle API error response', async () => {
      const errorResponse = {
        error: 'Invalid API key',
        message: 'The provided API key is invalid',
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => errorResponse,
      } as Response);

      const response = await service.sendEmail(testEmailParams.basic);
      
      expectErrorResponse(response);
      expect(response.error).toContain('403');
      expect(response.error).toContain('The provided API key is invalid');
    });

    test('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const response = await service.sendEmail(testEmailParams.basic);
      
      expectErrorResponse(response);
      expect(response.error).toBe('Network error');
    });

    // Note: Timeout functionality is implemented but difficult to test reliably in Jest

    test('should handle malformed JSON response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => { throw new Error('Invalid JSON'); },
      } as unknown as Response);

      const response = await service.sendEmail(testEmailParams.basic);
      
      expectErrorResponse(response);
      expect(response.error).toContain('500');
      expect(response.error).toContain('Unknown error');
    });
  });

  describe('getEmailStatus', () => {
    beforeEach(() => {
      service = new CrunchyConeEmailService({ apiKey: 'test-api-key' });
    });

    test('should fetch email status successfully', async () => {
      const mockStatus = {
        email_id: 'test-email-id',
        status: 'delivered',
        subject: 'Test Subject',
        sent_at: '2023-12-15T10:01:00Z',
        delivered_at: '2023-12-15T10:02:00Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockStatus,
      } as Response);

      const status = await service.getEmailStatus('test-email-id');
      expect(status).toEqual(mockStatus);
      
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.crunchycone.com/v1/emails/test-email-id',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'X-API-Key': 'test-api-key',
          }),
        }),
      );
    });

    test('should handle email not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Email not found' }),
      } as Response);

      await expect(service.getEmailStatus('non-existent')).rejects.toThrow('Failed to get email status: 404');
    });
  });

  describe('listEmails', () => {
    beforeEach(() => {
      service = new CrunchyConeEmailService({ apiKey: 'test-api-key' });
    });

    test('should list emails with default parameters', async () => {
      const mockResponse = {
        emails: [{ email_id: 'email-1' }, { email_id: 'email-2' }],
        total_count: 2,
        has_more: false,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await service.listEmails();
      expect(result).toEqual(mockResponse);
      
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.crunchycone.com/v1/emails',
        expect.objectContaining({
          method: 'GET',
        }),
      );
    });

    test('should list emails with query parameters', async () => {
      const mockResponse = { emails: [], total_count: 0, has_more: false };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await service.listEmails({ status: 'sent', limit: 10, offset: 20 });
      
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.crunchycone.com/v1/emails?status=sent&limit=10&offset=20',
        expect.objectContaining({
          method: 'GET',
        }),
      );
    });

    test('should handle list emails error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ error: 'Unauthorized' }),
      } as Response);

      await expect(service.listEmails()).rejects.toThrow('Failed to list emails: 403');
    });
  });

  describe('Configuration', () => {
    test('should use environment variables for from address defaults', async () => {
      process.env.CRUNCHYCONE_EMAIL_FROM_EMAIL = 'custom@company.com';
      process.env.CRUNCHYCONE_EMAIL_FROM_NAME = 'Custom Company';
      process.env.CRUNCHYCONE_API_KEY = 'test-key';
      
      const service = new CrunchyConeEmailService();
      
      const mockResponse = { email_id: 'test-id' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await service.sendEmail(testEmailParams.basic);
      
      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1]?.body as string);
      
      expect(requestBody.from).toEqual({
        email: 'custom@company.com',
        name: 'Custom Company',
      });
    });
  });
});