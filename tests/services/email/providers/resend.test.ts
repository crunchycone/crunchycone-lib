import { ResendEmailService } from '../../../../src/services/email/providers/resend';
import { testEmailParams, setEnvVars, expectErrorResponse } from '../shared/test-helpers';

jest.mock('resend');

describe('Resend Email Service', () => {
  let service: ResendEmailService;
  let mockResend: any;
  let MockResendClass: any;

  beforeEach(() => {
    setEnvVars('resend');
    
    mockResend = {
      emails: {
        send: jest.fn(),
      },
    };
    
    MockResendClass = jest.fn().mockImplementation(() => mockResend);
    require('resend').Resend = MockResendClass;
  });

  describe('Constructor', () => {
    test('should create service with valid environment variables', () => {
      expect(() => new ResendEmailService()).not.toThrow();
    });

    test('should throw error when API key is missing', () => {
      delete process.env.CRUNCHYCONE_RESEND_API_KEY;
      expect(() => new ResendEmailService()).toThrow('Missing required Resend environment variables');
    });

    test('should throw error when FROM address is missing', () => {
      delete process.env.CRUNCHYCONE_RESEND_FROM;
      expect(() => new ResendEmailService()).toThrow('Missing required Resend environment variables');
    });
  });

  describe('Email Sending', () => {
    beforeEach(() => {
      service = new ResendEmailService();
    });

    test('should initialize Resend client with API key', async () => {
      mockResend.emails.send.mockResolvedValue({ data: { id: 'resend-test-id' }, error: null });
      
      await service.sendEmail(testEmailParams.basic);
      
      expect(MockResendClass).toHaveBeenCalledWith('re_test_api_key');
    });

    test('should send email with text content only', async () => {
      mockResend.emails.send.mockResolvedValue({ data: { id: 'resend-test-id' }, error: null });
      
      await service.sendEmail(testEmailParams.basic);
      
      expect(mockResend.emails.send).toHaveBeenCalledWith({
        from: 'test@resend.dev',
        to: 'test@example.com',
        subject: 'Test Subject',
        text: 'Hello World',
      });
    });

    test('should send email with text and HTML content', async () => {
      mockResend.emails.send.mockResolvedValue({ data: { id: 'resend-test-id' }, error: null });
      
      await service.sendEmail(testEmailParams.withHtml);
      
      expect(mockResend.emails.send).toHaveBeenCalledWith({
        from: 'test@resend.dev',
        to: 'test@example.com',
        subject: 'Test Subject',
        text: 'Hello World',
        html: '<h1>Hello World</h1>',
      });
    });

    test('should handle multiple recipients', async () => {
      mockResend.emails.send.mockResolvedValue({ data: { id: 'resend-test-id' }, error: null });
      
      await service.sendEmail(testEmailParams.multiRecipient);
      
      expect(mockResend.emails.send).toHaveBeenCalledWith({
        from: 'test@resend.dev',
        to: ['test1@example.com', 'test2@example.com'],
        subject: 'Test Subject',
        text: 'Hello World',
      });
    });

    test('should use custom from address when provided', async () => {
      mockResend.emails.send.mockResolvedValue({ data: { id: 'resend-test-id' }, error: null });
      
      await service.sendEmail(testEmailParams.withCustomFrom);
      
      expect(mockResend.emails.send).toHaveBeenCalledWith({
        from: 'custom@example.com',
        to: 'test@example.com',
        subject: 'Test Subject',
        text: 'Hello World',
      });
    });

    test('should return success response with messageId from data', async () => {
      mockResend.emails.send.mockResolvedValue({ 
        data: { id: 'resend-message-id' }, 
        error: null, 
      });
      
      const response = await service.sendEmail(testEmailParams.basic);
      
      expect(response).toEqual({
        success: true,
        messageId: 'resend-message-id',
      });
    });

    test('should handle Resend API error response', async () => {
      mockResend.emails.send.mockResolvedValue({ 
        data: null, 
        error: { message: 'Invalid API key' },
      });
      
      const response = await service.sendEmail(testEmailParams.basic);
      
      expectErrorResponse(response);
      expect(response.error).toBe('Invalid API key');
    });

    test('should handle network errors', async () => {
      const error = new Error('Network error');
      mockResend.emails.send.mockRejectedValue(error);
      
      const response = await service.sendEmail(testEmailParams.basic);
      
      expectErrorResponse(response);
      expect(response.error).toBe('Network error');
    });

    test('should handle rate limiting errors', async () => {
      mockResend.emails.send.mockResolvedValue({ 
        data: null, 
        error: { message: 'Rate limit exceeded' },
      });
      
      const response = await service.sendEmail(testEmailParams.basic);
      
      expectErrorResponse(response);
      expect(response.error).toBe('Rate limit exceeded');
    });

    test('should handle special characters in content', async () => {
      mockResend.emails.send.mockResolvedValue({ data: { id: 'resend-test-id' }, error: null });
      
      await service.sendEmail(testEmailParams.specialChars);
      
      expect(mockResend.emails.send).toHaveBeenCalledWith({
        from: 'test@resend.dev',
        to: 'test@example.com',
        subject: 'Tëst Sübject 🚀',
        text: 'Héllö Wörld! 🌍',
        html: '<h1>Héllö Wörld! 🌍</h1>',
      });
    });

    test('should handle missing data in response', async () => {
      mockResend.emails.send.mockResolvedValue({ 
        data: null, 
        error: null, 
      });
      
      const response = await service.sendEmail(testEmailParams.basic);
      
      expect(response.success).toBe(true);
      expect(response.messageId).toBeUndefined();
    });

    test('should handle unknown errors', async () => {
      mockResend.emails.send.mockRejectedValue('Unknown error');
      
      const response = await service.sendEmail(testEmailParams.basic);
      
      expectErrorResponse(response);
      expect(response.error).toBe('Unknown error');
    });
  });
});