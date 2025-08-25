import { createEmailService } from '../../../src/services/email/factory';
import { AmazonSESEmailService } from '../../../src/services/email/providers/amazon-ses';
import { SendGridEmailService } from '../../../src/services/email/providers/sendgrid';
import { ResendEmailService } from '../../../src/services/email/providers/resend';
import { MailgunEmailService } from '../../../src/services/email/providers/mailgun';
import { testEmailParams, setEnvVars, expectErrorResponse } from './shared/test-helpers';

// Mock all external dependencies
jest.mock('nodemailer');
jest.mock('@sendgrid/mail');
jest.mock('resend');
jest.mock('@aws-sdk/client-ses');

import sgMail from '@sendgrid/mail';

// Mock fetch for Mailgun HTTP API
global.fetch = jest.fn();
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

describe('Email Service Error Handling', () => {
  describe('Network and Timeout Errors', () => {
    test('should handle SMTP network timeout gracefully', async () => {
      setEnvVars('smtp');
      process.env.CRUNCHYCONE_EMAIL_PROVIDER = 'smtp';
      
      const nodemailer = require('nodemailer');
      const mockTransporter = {
        sendMail: jest.fn().mockRejectedValue(new Error('ETIMEDOUT')),
      };
      nodemailer.createTransport = jest.fn().mockReturnValue(mockTransporter);
      
      const service = createEmailService();
      const response = await service.sendEmail(testEmailParams.basic);
      
      expectErrorResponse(response);
      expect(response.error).toBe('ETIMEDOUT');
    });

    test('should handle SendGrid network errors', async () => {
      setEnvVars('sendgrid');
      process.env.CRUNCHYCONE_EMAIL_PROVIDER = 'sendgrid';
      
      const mockSgMail = sgMail as jest.Mocked<typeof sgMail>;
      mockSgMail.setApiKey = jest.fn();
      mockSgMail.send = jest.fn().mockRejectedValue(new Error('Network error'));
      
      const service = createEmailService();
      const response = await service.sendEmail(testEmailParams.basic);
      
      expectErrorResponse(response);
      expect(response.error).toBe('Network error');
    });

    test('should handle Resend connection errors', async () => {
      setEnvVars('resend');
      process.env.CRUNCHYCONE_EMAIL_PROVIDER = 'resend';
      
      const { Resend } = require('resend');
      const mockResend = {
        emails: {
          send: jest.fn().mockRejectedValue(new Error('Connection refused')),
        },
      };
      Resend.mockImplementation(() => mockResend);
      
      const service = createEmailService();
      const response = await service.sendEmail(testEmailParams.basic);
      
      expectErrorResponse(response);
      expect(response.error).toBe('Connection refused');
    });
  });

  describe('Authentication and Authorization Errors', () => {
    test('should handle SMTP authentication failure', async () => {
      setEnvVars('smtp');
      process.env.CRUNCHYCONE_EMAIL_PROVIDER = 'smtp';
      
      const nodemailer = require('nodemailer');
      const mockTransporter = {
        sendMail: jest.fn().mockRejectedValue(new Error('Invalid login: 535-5.7.8 Username and Password not accepted')),
      };
      nodemailer.createTransport = jest.fn().mockReturnValue(mockTransporter);
      
      const service = createEmailService();
      const response = await service.sendEmail(testEmailParams.basic);
      
      expectErrorResponse(response);
      expect(response.error).toContain('Invalid login');
    });

    test('should handle SendGrid invalid API key', async () => {
      setEnvVars('sendgrid');
      process.env.CRUNCHYCONE_EMAIL_PROVIDER = 'sendgrid';
      
      const mockSgMail = sgMail as jest.Mocked<typeof sgMail>;
      mockSgMail.setApiKey = jest.fn();
      mockSgMail.send = jest.fn().mockRejectedValue(new Error('Unauthorized'));
      
      const service = createEmailService();
      const response = await service.sendEmail(testEmailParams.basic);
      
      expectErrorResponse(response);
      expect(response.error).toBe('Unauthorized');
    });

    test('should handle Amazon SES invalid credentials', async () => {
      setEnvVars('ses');
      
      const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
      const mockSend = jest.fn().mockRejectedValue(new Error('The security token included in the request is invalid'));
      SESClient.mockImplementation(() => ({ send: mockSend }));
      SendEmailCommand.mockImplementation((params: any) => params);
      
      const service = new AmazonSESEmailService();
      const response = await service.sendEmail(testEmailParams.basic);
      
      expectErrorResponse(response);
      expect(response.error).toContain('security token');
    });

    test('should handle AWS SDK initialization errors', async () => {
      setEnvVars('ses');
      
      // Mock SESClient to have a broken constructor
      const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
      SESClient.mockImplementation(() => {
        throw new Error('AWS SDK initialization failed');
      });
      SendEmailCommand.mockImplementation((params: any) => params);
      
      const service = new AmazonSESEmailService();
      const response = await service.sendEmail(testEmailParams.basic);
      
      expectErrorResponse(response);
      expect(response.error).toContain('AWS SDK initialization failed');
    });

    test('should handle Mailgun forbidden access', async () => {
      setEnvVars('mailgun');
      process.env.CRUNCHYCONE_EMAIL_PROVIDER = 'mailgun';
      
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: async () => 'Forbidden access to domain',
      } as unknown as Response);
      
      const service = createEmailService();
      const response = await service.sendEmail(testEmailParams.basic);
      
      expectErrorResponse(response);
      expect(response.error).toBe('Mailgun API error: 403 Forbidden - Forbidden access to domain');
    });

    test('should handle Mailgun network connection errors', async () => {
      setEnvVars('mailgun');
      process.env.CRUNCHYCONE_EMAIL_PROVIDER = 'mailgun';
      
      // Mock fetch to throw network error
      mockFetch.mockRejectedValue(new Error('Network connection failed'));
      
      const service = createEmailService();
      const response = await service.sendEmail(testEmailParams.basic);
      
      expectErrorResponse(response);
      expect(response.error).toBe('Network connection failed');
    });
  });

  describe('Rate Limiting Errors', () => {
    test('should handle SendGrid rate limiting', async () => {
      setEnvVars('sendgrid');
      process.env.CRUNCHYCONE_EMAIL_PROVIDER = 'sendgrid';
      
      const sgMail = require('@sendgrid/mail');
      sgMail.setApiKey = jest.fn();
      sgMail.send = jest.fn().mockRejectedValue(new Error('Rate limit exceeded'));
      
      const service = createEmailService();
      const response = await service.sendEmail(testEmailParams.basic);
      
      expectErrorResponse(response);
      expect(response.error).toBe('Rate limit exceeded');
    });

    test('should handle Resend rate limiting', async () => {
      setEnvVars('resend');
      process.env.CRUNCHYCONE_EMAIL_PROVIDER = 'resend';
      
      const { Resend } = require('resend');
      const mockResend = {
        emails: {
          send: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Too Many Requests' },
          }),
        },
      };
      Resend.mockImplementation(() => mockResend);
      
      const service = createEmailService();
      const response = await service.sendEmail(testEmailParams.basic);
      
      expectErrorResponse(response);
      expect(response.error).toBe('Too Many Requests');
    });

    test('should handle Mailgun rate limiting', async () => {
      setEnvVars('mailgun');
      process.env.CRUNCHYCONE_EMAIL_PROVIDER = 'mailgun';
      
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        text: async () => 'Rate limit exceeded',
      } as unknown as Response);
      
      const service = createEmailService();
      const response = await service.sendEmail(testEmailParams.basic);
      
      expectErrorResponse(response);
      expect(response.error).toBe('Mailgun API error: 429 Too Many Requests - Rate limit exceeded');
    });

    test('should handle Amazon SES throttling', async () => {
      setEnvVars('ses');
      
      const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
      const mockSend = jest.fn().mockRejectedValue(new Error('Throttling: Rate exceeded'));
      SESClient.mockImplementation(() => ({ send: mockSend }));
      SendEmailCommand.mockImplementation((params: any) => params);
      
      const service = new AmazonSESEmailService();
      const response = await service.sendEmail(testEmailParams.basic);
      
      expectErrorResponse(response);
      expect(response.error).toContain('Rate exceeded');
    });
  });

  describe('Malformed Email Address Errors', () => {
    const invalidEmailParams = {
      to: 'invalid-email',
      subject: 'Test',
      textBody: 'Test body',
    };

    test('should handle SMTP invalid email format', async () => {
      setEnvVars('smtp');
      process.env.CRUNCHYCONE_EMAIL_PROVIDER = 'smtp';
      
      const nodemailer = require('nodemailer');
      const mockTransporter = {
        sendMail: jest.fn().mockRejectedValue(new Error('Invalid email address format')),
      };
      nodemailer.createTransport = jest.fn().mockReturnValue(mockTransporter);
      
      const service = createEmailService();
      const response = await service.sendEmail(invalidEmailParams);
      
      expectErrorResponse(response);
      expect(response.error).toContain('Invalid email address');
    });

    test('should handle SendGrid invalid recipient', async () => {
      setEnvVars('sendgrid');
      process.env.CRUNCHYCONE_EMAIL_PROVIDER = 'sendgrid';
      
      const sgMail = require('@sendgrid/mail');
      sgMail.setApiKey = jest.fn();
      sgMail.send = jest.fn().mockRejectedValue(new Error('Bad Request: Invalid email'));
      
      const service = createEmailService();
      const response = await service.sendEmail(invalidEmailParams);
      
      expectErrorResponse(response);
      expect(response.error).toContain('Invalid email');
    });
  });

  describe('Service-Specific Errors', () => {
    test('should handle Amazon SES quota exceeded', async () => {
      setEnvVars('ses');
      
      const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
      const mockSend = jest.fn().mockRejectedValue(new Error('Daily sending quota exceeded'));
      SESClient.mockImplementation(() => ({ send: mockSend }));
      SendEmailCommand.mockImplementation((params: any) => params);
      
      const service = new AmazonSESEmailService();
      const response = await service.sendEmail(testEmailParams.basic);
      
      expectErrorResponse(response);
      expect(response.error).toContain('quota exceeded');
    });

    test('should handle SendGrid unverified sender', async () => {
      setEnvVars('sendgrid');
      process.env.CRUNCHYCONE_EMAIL_PROVIDER = 'sendgrid';
      
      const sgMail = require('@sendgrid/mail');
      sgMail.setApiKey = jest.fn();
      sgMail.send = jest.fn().mockRejectedValue(new Error('From email address is not verified'));
      
      const service = createEmailService();
      const response = await service.sendEmail(testEmailParams.basic);
      
      expectErrorResponse(response);
      expect(response.error).toContain('not verified');
    });

    test('should handle Mailgun domain not found', async () => {
      setEnvVars('mailgun');
      process.env.CRUNCHYCONE_EMAIL_PROVIDER = 'mailgun';
      
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => 'Domain not found',
      } as unknown as Response);
      
      const service = createEmailService();
      const response = await service.sendEmail(testEmailParams.basic);
      
      expectErrorResponse(response);
      expect(response.error).toBe('Mailgun API error: 404 Not Found - Domain not found');
    });
  });

  describe('Unknown Error Handling', () => {
    test('should handle non-Error objects gracefully', async () => {
      setEnvVars('smtp');
      process.env.CRUNCHYCONE_EMAIL_PROVIDER = 'smtp';
      
      const nodemailer = require('nodemailer');
      const mockTransporter = {
        sendMail: jest.fn().mockRejectedValue('String error'),
      };
      nodemailer.createTransport = jest.fn().mockReturnValue(mockTransporter);
      
      const service = createEmailService();
      const response = await service.sendEmail(testEmailParams.basic);
      
      expectErrorResponse(response);
      expect(response.error).toBe('Unknown error');
    });

    test('should handle null/undefined errors', async () => {
      setEnvVars('resend');
      process.env.CRUNCHYCONE_EMAIL_PROVIDER = 'resend';
      
      const { Resend } = require('resend');
      const mockResend = {
        emails: {
          send: jest.fn().mockRejectedValue(null),
        },
      };
      Resend.mockImplementation(() => mockResend);
      
      const service = createEmailService();
      const response = await service.sendEmail(testEmailParams.basic);
      
      expectErrorResponse(response);
      expect(response.error).toBe('Unknown error');
    });
  });

  describe('Consistent Error Response Format', () => {
    const providers = ['smtp'];

    test.each(providers)('should return consistent error format for %s provider', async (provider) => {
      if (provider !== 'crunchycone') {
        setEnvVars(provider as any);
      }
      process.env.CRUNCHYCONE_EMAIL_PROVIDER = provider;
      
      // Mock each provider to return an error
      switch (provider) {
        case 'smtp': {
          const nodemailer = require('nodemailer');
          nodemailer.createTransport = jest.fn().mockReturnValue({
            sendMail: jest.fn().mockRejectedValue(new Error('Test error')),
          });
          break;
        }
      }
      
      const service = createEmailService();
      const response = await service.sendEmail(testEmailParams.basic);
      
      expect(response).toHaveProperty('success', false);
      expect(response).toHaveProperty('error', 'Test error');
      expect(response).not.toHaveProperty('messageId');
    });

    test('should return consistent error format for ses provider (direct import)', async () => {
      setEnvVars('ses');
      
      const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
      const mockSend = jest.fn().mockRejectedValue(new Error('Test error'));
      SESClient.mockImplementation(() => ({ send: mockSend }));
      SendEmailCommand.mockImplementation((params: any) => params);
      
      const service = new AmazonSESEmailService();
      const response = await service.sendEmail(testEmailParams.basic);
      
      expect(response).toHaveProperty('success', false);
      expect(response).toHaveProperty('error', 'Test error');
      expect(response).not.toHaveProperty('messageId');
    });

    test('should return consistent error format for sendgrid provider (direct import)', async () => {
      setEnvVars('sendgrid');
      
      const mockSgMail = sgMail as jest.Mocked<typeof sgMail>;
      mockSgMail.setApiKey = jest.fn();
      mockSgMail.send = jest.fn().mockRejectedValue(new Error('Test error'));
      
      const { SendGridEmailService } = require('../../../src/services/email/providers/sendgrid');
      const service = new SendGridEmailService();
      const response = await service.sendEmail(testEmailParams.basic);
      
      expect(response).toHaveProperty('success', false);
      expect(response).toHaveProperty('error', 'Test error');
      expect(response).not.toHaveProperty('messageId');
    });
  });
});