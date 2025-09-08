import { AmazonSESEmailService } from '../../../../src/services/email/providers/amazon-ses';
import { testEmailParams, setEnvVars, expectErrorResponse } from '../shared/test-helpers';

jest.mock('@aws-sdk/client-ses');

describe('Amazon SES Email Service', () => {
  let service: AmazonSESEmailService;
  let mockSend: any;
  let mockSESClient: any;

  beforeEach(() => {
    setEnvVars('ses');
    
    mockSend = jest.fn();
    mockSESClient = {
      send: mockSend,
    };
    
    const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
    SESClient.mockImplementation(() => mockSESClient);
    SendEmailCommand.mockImplementation((params: any) => params);
  });

  describe('Constructor', () => {
    test('should create service with valid environment variables', () => {
      expect(() => new AmazonSESEmailService()).not.toThrow();
    });

    test('should return error when AWS access key is missing', async () => {
      delete process.env.CRUNCHYCONE_AWS_ACCESS_KEY_ID;
      
      const service = new AmazonSESEmailService(); // Constructor should not throw
      const response = await service.sendEmail({
        to: 'test@example.com',
        subject: 'Test',
        textBody: 'Test',
      });
      
      expect(response.success).toBe(false);
      expect(response.error).toContain('Missing required Amazon SES environment variables');
    });

    test('should return error when AWS secret key is missing', async () => {
      delete process.env.CRUNCHYCONE_AWS_SECRET_ACCESS_KEY;
      
      const service = new AmazonSESEmailService(); // Constructor should not throw
      const response = await service.sendEmail({
        to: 'test@example.com',
        subject: 'Test',
        textBody: 'Test',
      });
      
      expect(response.success).toBe(false);
      expect(response.error).toContain('Missing required Amazon SES environment variables');
    });

    test('should return error when from address is missing', async () => {
      delete process.env.CRUNCHYCONE_SES_FROM;
      
      const service = new AmazonSESEmailService(); // Constructor should not throw
      const response = await service.sendEmail({
        to: 'test@example.com',
        subject: 'Test',
        textBody: 'Test',
      });
      
      expect(response.success).toBe(false);
      expect(response.error).toContain('Missing required Amazon SES environment variables');
    });

    test('should use default region when not specified', () => {
      delete process.env.CRUNCHYCONE_AWS_REGION;
      service = new AmazonSESEmailService();
      
      expect(service).toBeDefined();
    });
  });

  describe('sendEmail', () => {
    beforeEach(() => {
      service = new AmazonSESEmailService();
    });

    test('should create SES client with credentials', async () => {
      mockSend.mockResolvedValue({ MessageId: 'ses-test-id' });
      
      await service.sendEmail(testEmailParams.basic);
      
      const { SESClient } = require('@aws-sdk/client-ses');
      expect(SESClient).toHaveBeenCalledWith({
        region: 'us-east-1',
        credentials: {
          accessKeyId: 'AKIATEST',
          secretAccessKey: 'test_secret_key',
        },
      });
    });

    test('should send email with text content only', async () => {
      mockSend.mockResolvedValue({ MessageId: 'ses-test-id' });
      
      await service.sendEmail(testEmailParams.basic);
      
      const { SendEmailCommand } = require('@aws-sdk/client-ses');
      expect(SendEmailCommand).toHaveBeenCalledWith({
        Source: 'test@aws.com',
        Destination: {
          ToAddresses: ['test@example.com'],
        },
        Message: {
          Subject: {
            Charset: 'UTF-8',
            Data: 'Test Subject',
          },
          Body: {
            Text: {
              Charset: 'UTF-8',
              Data: 'Hello World',
            },
          },
        },
      });
      expect(mockSend).toHaveBeenCalled();
    });

    test('should send email with text and HTML content', async () => {
      mockSend.mockResolvedValue({ MessageId: 'ses-test-id' });
      
      await service.sendEmail(testEmailParams.withHtml);
      
      const { SendEmailCommand } = require('@aws-sdk/client-ses');
      expect(SendEmailCommand).toHaveBeenCalledWith({
        Source: 'test@aws.com',
        Destination: {
          ToAddresses: ['test@example.com'],
        },
        Message: {
          Subject: {
            Charset: 'UTF-8',
            Data: 'Test Subject',
          },
          Body: {
            Text: {
              Charset: 'UTF-8',
              Data: 'Hello World',
            },
            Html: {
              Charset: 'UTF-8',
              Data: '<h1>Hello World</h1>',
            },
          },
        },
      });
    });

    test('should handle multiple recipients', async () => {
      mockSend.mockResolvedValue({ MessageId: 'ses-test-id' });
      
      await service.sendEmail(testEmailParams.multiRecipient);
      
      const { SendEmailCommand } = require('@aws-sdk/client-ses');
      expect(SendEmailCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Destination: {
            ToAddresses: ['test1@example.com', 'test2@example.com'],
          },
        }),
      );
    });

    test('should handle custom from address', async () => {
      mockSend.mockResolvedValue({ MessageId: 'ses-test-id' });
      
      await service.sendEmail(testEmailParams.withCustomFrom);
      
      const { SendEmailCommand } = require('@aws-sdk/client-ses');
      expect(SendEmailCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Source: 'custom@example.com',
        }),
      );
    });

    test('should return success response with message ID', async () => {
      mockSend.mockResolvedValue({ MessageId: 'ses-test-id' });
      
      const result = await service.sendEmail(testEmailParams.basic);
      
      expect(result).toEqual({
        success: true,
        messageId: 'ses-test-id',
      });
    });

    test('should handle SES API errors', async () => {
      mockSend.mockRejectedValue(new Error('SES API error'));
      
      const result = await service.sendEmail(testEmailParams.basic);
      
      expectErrorResponse(result);
      expect(result.error).toBe('SES API error');
    });

    test('should handle unknown errors', async () => {
      mockSend.mockRejectedValue('Unknown error');
      
      const result = await service.sendEmail(testEmailParams.basic);
      
      expectErrorResponse(result);
      expect(result.error).toBe('Unknown error');
    });
  });
});