import { MailgunEmailService } from '../../../../src/services/email/providers/mailgun';
import { testEmailParams, setEnvVars, expectErrorResponse } from '../shared/test-helpers';

// Mock fetch
global.fetch = jest.fn();
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

// Helper to create properly typed Response mocks
const createMockResponse = (options: {
  ok?: boolean;
  status?: number;
  statusText?: string;
  json?: () => Promise<any>;
  text?: () => Promise<string>;
}): Response => {
  return {
    ok: options.ok ?? true,
    status: options.status ?? 200,
    statusText: options.statusText ?? 'OK',
    headers: new Headers(),
    json: options.json ?? (async () => ({})),
    text: options.text ?? (async () => ''),
  } as unknown as Response;
};

describe('Mailgun Email Service', () => {
  let service: MailgunEmailService;

  beforeEach(() => {
    setEnvVars('mailgun');
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    test('should create service with valid environment variables', () => {
      expect(() => new MailgunEmailService()).not.toThrow();
    });

    test('should throw error when API key is missing', () => {
      delete process.env.CRUNCHYCONE_MAILGUN_API_KEY;
      expect(() => new MailgunEmailService()).toThrow('Missing required Mailgun environment variables');
    });

    test('should throw error when domain is missing', () => {
      delete process.env.CRUNCHYCONE_MAILGUN_DOMAIN;
      expect(() => new MailgunEmailService()).toThrow('Missing required Mailgun environment variables');
    });

    test('should throw error when FROM address is missing', () => {
      delete process.env.CRUNCHYCONE_MAILGUN_FROM;
      expect(() => new MailgunEmailService()).toThrow('Missing required Mailgun environment variables');
    });
  });

  describe('Email Sending', () => {
    beforeEach(() => {
      service = new MailgunEmailService();
    });

    test('should make POST request to correct Mailgun API endpoint', async () => {
      mockFetch.mockResolvedValue(createMockResponse({
        json: async () => ({ id: 'mailgun-test-id', message: 'Queued. Thank you.' }),
      }));
      
      await service.sendEmail(testEmailParams.basic);
      
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.mailgun.net/v3/mg.example.com/messages',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': `Basic ${Buffer.from('api:mg_test_api_key').toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
        }),
      );
    });

    test('should send email with text content only', async () => {
      mockFetch.mockResolvedValue(createMockResponse({
        json: async () => ({ id: 'mailgun-test-id', message: 'Queued. Thank you.' }),
      }));
      
      await service.sendEmail(testEmailParams.basic);
      
      const [, options] = mockFetch.mock.calls[0];
      const body = new URLSearchParams(options!.body as string);
      
      expect(body.get('from')).toBe('test@mg.example.com');
      expect(body.get('to')).toBe('test@example.com');
      expect(body.get('subject')).toBe('Test Subject');
      expect(body.get('text')).toBe('Hello World');
      expect(body.get('html')).toBeNull();
    });

    test('should send email with text and HTML content', async () => {
      mockFetch.mockResolvedValue(createMockResponse({
        json: async () => ({ id: 'mailgun-test-id', message: 'Queued. Thank you.' }),
      }));
      
      await service.sendEmail(testEmailParams.withHtml);
      
      const [, options] = mockFetch.mock.calls[0];
      const body = new URLSearchParams(options!.body as string);
      
      expect(body.get('from')).toBe('test@mg.example.com');
      expect(body.get('to')).toBe('test@example.com');
      expect(body.get('subject')).toBe('Test Subject');
      expect(body.get('text')).toBe('Hello World');
      expect(body.get('html')).toBe('<h1>Hello World</h1>');
    });

    test('should handle multiple recipients by joining with comma', async () => {
      mockFetch.mockResolvedValue(createMockResponse({
        json: async () => ({ id: 'mailgun-test-id', message: 'Queued. Thank you.' }),
      }));
      
      await service.sendEmail(testEmailParams.multiRecipient);
      
      const [, options] = mockFetch.mock.calls[0];
      const body = new URLSearchParams(options!.body as string);
      
      expect(body.get('to')).toBe('test1@example.com, test2@example.com');
    });

    test('should handle single recipient as string', async () => {
      mockFetch.mockResolvedValue(createMockResponse({
        json: async () => ({ id: 'mailgun-test-id', message: 'Queued. Thank you.' }),
      }));
      
      await service.sendEmail(testEmailParams.basic);
      
      const [, options] = mockFetch.mock.calls[0];
      const body = new URLSearchParams(options!.body as string);
      
      expect(body.get('to')).toBe('test@example.com');
    });

    test('should use custom from address when provided', async () => {
      mockFetch.mockResolvedValue(createMockResponse({
        json: async () => ({ id: 'mailgun-test-id', message: 'Queued. Thank you.' }),
      }));
      
      await service.sendEmail(testEmailParams.withCustomFrom);
      
      const [, options] = mockFetch.mock.calls[0];
      const body = new URLSearchParams(options!.body as string);
      
      expect(body.get('from')).toBe('custom@example.com');
    });

    test('should return success response with messageId', async () => {
      mockFetch.mockResolvedValue(createMockResponse({
        json: async () => ({ id: 'mailgun-message-id', message: 'Queued. Thank you.' }),
      }));
      
      const response = await service.sendEmail(testEmailParams.basic);
      
      expect(response).toEqual({
        success: true,
        messageId: 'mailgun-message-id',
      });
    });

    test('should handle Mailgun API errors', async () => {
      mockFetch.mockResolvedValue(createMockResponse({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: async () => 'Forbidden',
      }));
      
      const response = await service.sendEmail(testEmailParams.basic);
      
      expectErrorResponse(response);
      expect(response.error).toBe('Mailgun API error: 403 Forbidden - Forbidden');
    });

    test('should handle domain validation errors', async () => {
      mockFetch.mockResolvedValue(createMockResponse({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => 'Domain not found',
      }));
      
      const response = await service.sendEmail(testEmailParams.basic);
      
      expectErrorResponse(response);
      expect(response.error).toBe('Mailgun API error: 404 Not Found - Domain not found');
    });

    test('should handle invalid API key errors', async () => {
      mockFetch.mockResolvedValue(createMockResponse({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Invalid API key',
      }));
      
      const response = await service.sendEmail(testEmailParams.basic);
      
      expectErrorResponse(response);
      expect(response.error).toBe('Mailgun API error: 401 Unauthorized - Invalid API key');
    });

    test('should handle rate limiting errors', async () => {
      mockFetch.mockResolvedValue(createMockResponse({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        text: async () => 'Rate limit exceeded',
      }));
      
      const response = await service.sendEmail(testEmailParams.basic);
      
      expectErrorResponse(response);
      expect(response.error).toBe('Mailgun API error: 429 Too Many Requests - Rate limit exceeded');
    });

    test('should handle special characters in content', async () => {
      mockFetch.mockResolvedValue(createMockResponse({
        json: async () => ({ id: 'mailgun-test-id', message: 'Queued. Thank you.' }),
      }));
      
      await service.sendEmail(testEmailParams.specialChars);
      
      const [, options] = mockFetch.mock.calls[0];
      const body = new URLSearchParams(options!.body as string);
      
      expect(body.get('subject')).toBe('Tëst Sübject 🚀');
      expect(body.get('text')).toBe('Héllö Wörld! 🌍');
      expect(body.get('html')).toBe('<h1>Héllö Wörld! 🌍</h1>');
    });

    test('should handle fetch network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));
      
      const response = await service.sendEmail(testEmailParams.basic);
      
      expectErrorResponse(response);
      expect(response.error).toBe('Network error');
    });

    test('should handle unknown errors', async () => {
      mockFetch.mockRejectedValue('Unknown error');
      
      const response = await service.sendEmail(testEmailParams.basic);
      
      expectErrorResponse(response);
      expect(response.error).toBe('Unknown error');
    });
  });

  describe('JSON Response Parsing', () => {
    test('should handle invalid JSON response gracefully', async () => {
      mockFetch.mockResolvedValue(createMockResponse({
        json: async () => { throw new Error('Invalid JSON'); },
      }));
      
      const response = await service.sendEmail(testEmailParams.basic);
      
      expectErrorResponse(response);
      expect(response.error).toBe('Invalid JSON');
    });
  });
});