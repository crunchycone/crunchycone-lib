import { SendGridEmailService } from '../../../../src/services/email/providers/sendgrid';
import { testEmailParams, setEnvVars, expectErrorResponse } from '../shared/test-helpers';

// Mock SendGrid module
jest.mock('@sendgrid/mail');
import sgMail from '@sendgrid/mail';

describe('SendGrid Email Service', () => {
  let service: SendGridEmailService;
  let mockSgMail: jest.Mocked<typeof sgMail>;

  beforeEach(() => {
    setEnvVars('sendgrid');
    
    // Cast to mocked version
    mockSgMail = sgMail as jest.Mocked<typeof sgMail>;
    
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    test('should create service with valid environment variables', () => {
      expect(() => new SendGridEmailService()).not.toThrow();
    });

    test('should throw error when API key is missing', () => {
      delete process.env.CRUNCHYCONE_SENDGRID_API_KEY;
      expect(() => new SendGridEmailService()).toThrow('Missing required SendGrid environment variables');
    });

    test('should throw error when FROM address is missing', () => {
      delete process.env.CRUNCHYCONE_SENDGRID_FROM;
      expect(() => new SendGridEmailService()).toThrow('Missing required SendGrid environment variables');
    });
  });

  describe('Email Sending', () => {
    beforeEach(() => {
      service = new SendGridEmailService();
    });

    test('should set API key on SendGrid client', async () => {
      mockSgMail.send.mockResolvedValue([{ 
        statusCode: 202, 
        body: {}, 
        headers: { 'x-message-id': 'sg-test-id' }, 
      }] as any);
      
      await service.sendEmail(testEmailParams.basic);
      
      expect(mockSgMail.setApiKey).toHaveBeenCalledWith('SG.test_api_key');
    });

    test('should send email with text content only', async () => {
      mockSgMail.send.mockResolvedValue([{ 
        statusCode: 202, 
        body: {}, 
        headers: { 'x-message-id': 'sg-test-id' }, 
      }] as any);
      
      await service.sendEmail(testEmailParams.basic);
      
      expect(mockSgMail.send).toHaveBeenCalledWith({
        to: 'test@example.com',
        from: 'test@sendgrid.com',
        subject: 'Test Subject',
        content: [
          {
            type: 'text/plain',
            value: 'Hello World',
          },
        ],
        tracking_settings: {
          click_tracking: { enable: true },
          open_tracking: { enable: true },
        },
      });
    });

    test('should send email with text and HTML content', async () => {
      mockSgMail.send.mockResolvedValue([{ 
        statusCode: 202, 
        body: {}, 
        headers: { 'x-message-id': 'sg-test-id' }, 
      }] as any);
      
      await service.sendEmail(testEmailParams.withHtml);
      
      expect(mockSgMail.send).toHaveBeenCalledWith({
        to: 'test@example.com',
        from: 'test@sendgrid.com',
        subject: 'Test Subject',
        content: [
          {
            type: 'text/plain',
            value: 'Hello World',
          },
          {
            type: 'text/html',
            value: '<h1>Hello World</h1>',
          },
        ],
        tracking_settings: {
          click_tracking: { enable: true },
          open_tracking: { enable: true },
        },
      });
    });

    test('should handle multiple recipients', async () => {
      mockSgMail.send.mockResolvedValue([{ 
        statusCode: 202, 
        body: {}, 
        headers: { 'x-message-id': 'sg-test-id' }, 
      }] as any);
      
      await service.sendEmail(testEmailParams.multiRecipient);
      
      expect(mockSgMail.send).toHaveBeenCalledWith({
        to: ['test1@example.com', 'test2@example.com'],
        from: 'test@sendgrid.com',
        subject: 'Test Subject',
        content: [
          {
            type: 'text/plain',
            value: 'Hello World',
          },
        ],
        tracking_settings: {
          click_tracking: { enable: true },
          open_tracking: { enable: true },
        },
      });
    });

    test('should use custom from address when provided', async () => {
      mockSgMail.send.mockResolvedValue([{ 
        statusCode: 202, 
        body: {}, 
        headers: { 'x-message-id': 'sg-test-id' }, 
      }] as any);
      
      await service.sendEmail(testEmailParams.withCustomFrom);
      
      expect(mockSgMail.send).toHaveBeenCalledWith({
        to: 'test@example.com',
        from: 'custom@example.com',
        subject: 'Test Subject',
        content: [
          {
            type: 'text/plain',
            value: 'Hello World',
          },
        ],
        tracking_settings: {
          click_tracking: { enable: true },
          open_tracking: { enable: true },
        },
      });
    });

    test('should return success response with messageId from headers', async () => {
      mockSgMail.send.mockResolvedValue([{ 
        statusCode: 202,
        body: {},
        headers: { 'x-message-id': 'sendgrid-message-id' }, 
      }] as any);
      
      const response = await service.sendEmail(testEmailParams.basic);
      
      expect(response).toEqual({
        success: true,
        messageId: 'sendgrid-message-id',
      });
    });

    test('should handle SendGrid API errors', async () => {
      const error = new Error('Unauthorized');
      mockSgMail.send.mockRejectedValue(error);
      
      const response = await service.sendEmail(testEmailParams.basic);
      
      expectErrorResponse(response);
      expect(response.error).toBe('Unauthorized');
    });

    test('should handle SendGrid rate limiting errors', async () => {
      const error = new Error('Rate limit exceeded');
      mockSgMail.send.mockRejectedValue(error);
      
      const response = await service.sendEmail(testEmailParams.basic);
      
      expectErrorResponse(response);
      expect(response.error).toBe('Rate limit exceeded');
    });

    test('should handle invalid API key errors', async () => {
      const error = new Error('The provided authorization grant is invalid, expired, or revoked');
      mockSgMail.send.mockRejectedValue(error);
      
      const response = await service.sendEmail(testEmailParams.basic);
      
      expectErrorResponse(response);
      expect(response.error).toBe('The provided authorization grant is invalid, expired, or revoked');
    });

    test('should handle special characters in content', async () => {
      mockSgMail.send.mockResolvedValue([{ 
        statusCode: 202, 
        body: {}, 
        headers: { 'x-message-id': 'sg-test-id' }, 
      }] as any);
      
      await service.sendEmail(testEmailParams.specialChars);
      
      expect(mockSgMail.send).toHaveBeenCalledWith({
        to: 'test@example.com',
        from: 'test@sendgrid.com',
        subject: 'Tëst Sübject 🚀',
        content: [
          {
            type: 'text/plain',
            value: 'Héllö Wörld! 🌍',
          },
          {
            type: 'text/html',
            value: '<h1>Héllö Wörld! 🌍</h1>',
          },
        ],
        tracking_settings: {
          click_tracking: { enable: true },
          open_tracking: { enable: true },
        },
      });
    });

    test('should handle unknown errors', async () => {
      mockSgMail.send.mockRejectedValue('Unknown error');
      
      const response = await service.sendEmail(testEmailParams.basic);
      
      expectErrorResponse(response);
      expect(response.error).toBe('Unknown error');
    });
  });
});