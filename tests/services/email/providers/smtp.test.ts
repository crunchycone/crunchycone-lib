import { SMTPEmailService } from '../../../../src/services/email/providers/smtp';
import { testEmailParams, setEnvVars, expectErrorResponse } from '../shared/test-helpers';

// Mock nodemailer module
jest.mock('nodemailer');
import * as nodemailer from 'nodemailer';

describe('SMTP Email Service', () => {
  let service: SMTPEmailService;
  let mockTransporter: jest.Mocked<any>;
  let mockCreateTransport: jest.MockedFunction<typeof nodemailer.createTransport>;

  beforeEach(() => {
    // Clean up environment first
    delete process.env.CRUNCHYCONE_EMAIL_FROM_DISPLAY;
    setEnvVars('smtp');
    
    // Create mock transporter
    mockTransporter = {
      sendMail: jest.fn(),
    };

    // Mock createTransport function
    mockCreateTransport = nodemailer.createTransport as jest.MockedFunction<typeof nodemailer.createTransport>;
    mockCreateTransport.mockReturnValue(mockTransporter);

    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    test('should create service with valid environment variables', () => {
      expect(() => new SMTPEmailService()).not.toThrow();
    });

    test('should throw error when SMTP_HOST is missing', () => {
      delete process.env.CRUNCHYCONE_SMTP_HOST;
      expect(() => new SMTPEmailService()).toThrow('Missing required SMTP environment variables');
    });

    test('should throw error when SMTP_USER is missing', () => {
      delete process.env.CRUNCHYCONE_SMTP_USER;
      expect(() => new SMTPEmailService()).toThrow('Missing required SMTP environment variables');
    });

    test('should throw error when SMTP_PASS is missing', () => {
      delete process.env.CRUNCHYCONE_SMTP_PASS;
      expect(() => new SMTPEmailService()).toThrow('Missing required SMTP environment variables');
    });

    test('should throw error when SMTP_FROM is missing', () => {
      delete process.env.CRUNCHYCONE_SMTP_FROM;
      expect(() => new SMTPEmailService()).toThrow('Missing required SMTP environment variables');
    });

    test('should create service with display name when provided', () => {
      setEnvVars('smtp', true); // Include display name
      expect(() => new SMTPEmailService()).not.toThrow();
    });

    test('should use default port 587 when not specified', async () => {
      delete process.env.CRUNCHYCONE_SMTP_PORT;
      service = new SMTPEmailService();
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-id' });
      
      await service.sendEmail(testEmailParams.basic);
      
      expect(mockCreateTransport).toHaveBeenCalledWith({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: 'test@gmail.com',
          pass: 'password123',
        },
      });
    });
  });

  describe('Transporter Configuration', () => {
    beforeEach(() => {
      service = new SMTPEmailService();
    });

    test('should create transporter with correct SMTP settings', async () => {
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-id' });
      
      await service.sendEmail(testEmailParams.basic);
      
      expect(mockCreateTransport).toHaveBeenCalledWith({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: 'test@gmail.com',
          pass: 'password123',
        },
      });
    });

    test('should use secure connection for port 465', async () => {
      process.env.CRUNCHYCONE_SMTP_PORT = '465';
      service = new SMTPEmailService();
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-id' });
      
      await service.sendEmail(testEmailParams.basic);
      
      expect(mockCreateTransport).toHaveBeenCalledWith({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
          user: 'test@gmail.com',
          pass: 'password123',
        },
      });
    });
  });

  describe('Email Sending', () => {
    beforeEach(() => {
      service = new SMTPEmailService();
    });

    test('should send email with correct mail options', async () => {
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-id' });
      
      await service.sendEmail(testEmailParams.basic);
      
      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: 'test@gmail.com',
        to: 'test@example.com',
        subject: 'Test Subject',
        text: 'Hello World',
        html: undefined,
      });
    });

    test('should send email with HTML body', async () => {
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-id' });
      
      await service.sendEmail(testEmailParams.withHtml);
      
      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: 'test@gmail.com',
        to: 'test@example.com',
        subject: 'Test Subject',
        text: 'Hello World',
        html: '<h1>Hello World</h1>',
      });
    });

    test('should handle multiple recipients', async () => {
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-id' });
      
      await service.sendEmail(testEmailParams.multiRecipient);
      
      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: 'test@gmail.com',
        to: 'test1@example.com, test2@example.com',
        subject: 'Test Subject',
        text: 'Hello World',
        html: undefined,
      });
    });

    test('should use custom from address when provided', async () => {
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-id' });
      
      await service.sendEmail(testEmailParams.withCustomFrom);
      
      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: 'custom@example.com',
        to: 'test@example.com',
        subject: 'Test Subject',
        text: 'Hello World',
        html: undefined,
      });
    });

    test('should use display name from environment when no custom from provided', async () => {
      // Setup environment with display name
      setEnvVars('smtp', true);
      service = new SMTPEmailService();
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-id' });
      
      await service.sendEmail(testEmailParams.basic);
      
      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: '"Test Company" <test@gmail.com>',
        to: 'test@example.com',
        subject: 'Test Subject',
        text: 'Hello World',
        html: undefined,
      });
    });

    test('should not use display name when custom from provided', async () => {
      // Setup environment with display name
      setEnvVars('smtp', true);
      service = new SMTPEmailService();
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-id' });
      
      await service.sendEmail(testEmailParams.withCustomFrom);
      
      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: 'custom@example.com',
        to: 'test@example.com',
        subject: 'Test Subject',
        text: 'Hello World',
        html: undefined,
      });
    });

    test('should return success response with messageId', async () => {
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'smtp-message-id' });
      
      const response = await service.sendEmail(testEmailParams.basic);
      
      expect(response).toEqual({
        success: true,
        messageId: 'smtp-message-id',
      });
    });

    test('should handle SMTP errors', async () => {
      const error = new Error('SMTP connection failed');
      mockTransporter.sendMail.mockRejectedValue(error);
      
      const response = await service.sendEmail(testEmailParams.basic);
      
      expectErrorResponse(response);
      expect(response.error).toBe('SMTP connection failed');
    });

    test('should handle authentication errors', async () => {
      const error = new Error('Invalid login: 535-5.7.8 Username and Password not accepted');
      mockTransporter.sendMail.mockRejectedValue(error);
      
      const response = await service.sendEmail(testEmailParams.basic);
      
      expectErrorResponse(response);
      expect(response.error).toBe('Invalid login: 535-5.7.8 Username and Password not accepted');
    });

    test('should handle unknown errors', async () => {
      mockTransporter.sendMail.mockRejectedValue('Unknown error');
      
      const response = await service.sendEmail(testEmailParams.basic);
      
      expectErrorResponse(response);
      expect(response.error).toBe('Unknown error');
    });
  });
});