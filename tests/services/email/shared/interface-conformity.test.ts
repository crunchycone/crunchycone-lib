import { EmailService } from '../../../../src/services/email/types';
import { SMTPEmailService } from '../../../../src/services/email/providers/smtp';
import { SendGridEmailService } from '../../../../src/services/email/providers/sendgrid';
import { ResendEmailService } from '../../../../src/services/email/providers/resend';
import { AmazonSESEmailService } from '../../../../src/services/email/providers/amazon-ses';
import { MailgunEmailService } from '../../../../src/services/email/providers/mailgun';
import { CrunchyConeEmailService } from '../../../../src/services/email/providers/crunchycone';
import { testEmailParams, mockEnvVars, setEnvVars, expectSuccessResponse } from './test-helpers';

// Mock all external dependencies
jest.mock('nodemailer');
jest.mock('@sendgrid/mail');
jest.mock('resend');
jest.mock('@aws-sdk/client-ses');
jest.mock('mailgun-js');

// Mock fetch for CrunchyCone provider
global.fetch = jest.fn();

import sgMail from '@sendgrid/mail';
import mailgun from 'mailgun-js';

const providers = [
  {
    name: 'SMTP',
    class: SMTPEmailService,
    envKey: 'smtp' as keyof typeof mockEnvVars,
    setup: () => setEnvVars('smtp'),
  },
  {
    name: 'SendGrid',
    class: SendGridEmailService,
    envKey: 'sendgrid' as keyof typeof mockEnvVars,
    setup: () => setEnvVars('sendgrid'),
  },
  {
    name: 'Resend',
    class: ResendEmailService,
    envKey: 'resend' as keyof typeof mockEnvVars,
    setup: () => setEnvVars('resend'),
  },
  {
    name: 'Amazon SES',
    class: AmazonSESEmailService,
    envKey: 'ses' as keyof typeof mockEnvVars,
    setup: () => setEnvVars('ses'),
  },
  {
    name: 'Mailgun',
    class: MailgunEmailService,
    envKey: 'mailgun' as keyof typeof mockEnvVars,
    setup: () => setEnvVars('mailgun'),
  },
  {
    name: 'CrunchyCone',
    class: CrunchyConeEmailService,
    envKey: 'crunchycone' as keyof typeof mockEnvVars,
    setup: () => setEnvVars('crunchycone'),
  },
];

describe.each(providers)('$name Provider Interface Conformity', ({ name, class: ServiceClass, setup }) => {
  let service: EmailService;

  beforeEach(() => {
    setup();
    
    // Setup mocks based on provider
    if (name === 'SMTP') {
      const nodemailer = require('nodemailer');
      const mockTransporter = {
        sendMail: jest.fn().mockResolvedValue({ messageId: 'mock-message-id' }),
      };
      nodemailer.createTransport = jest.fn().mockReturnValue(mockTransporter);
    }
    
    if (name === 'SendGrid') {
      const mockSgMail = sgMail as jest.Mocked<typeof sgMail>;
      mockSgMail.setApiKey = jest.fn();
      mockSgMail.send = jest.fn().mockResolvedValue([{
        headers: { 'x-message-id': 'mock-sendgrid-id' },
      }]);
    }
    
    if (name === 'Resend') {
      const { Resend } = require('resend');
      const mockResend = {
        emails: {
          send: jest.fn().mockResolvedValue({
            data: { id: 'mock-resend-id' },
            error: null,
          }),
        },
      };
      Resend.mockImplementation(() => mockResend);
    }
    
    if (name === 'Amazon SES') {
      const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
      const mockSend = jest.fn().mockResolvedValue({ MessageId: 'mock-ses-id' });
      SESClient.mockImplementation(() => ({
        send: mockSend,
      }));
      SendEmailCommand.mockImplementation((params: any) => params);
    }
    
    if (name === 'Mailgun') {
      const mockMailgun = mailgun as any;
      const mockMG = {
        messages: jest.fn().mockReturnValue({
          send: jest.fn().mockResolvedValue({ id: 'mock-mailgun-id' }),
        }),
      };
      mockMailgun.mockReturnValue(mockMG);
    }

    if (name === 'CrunchyCone') {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          email_id: 'mock-crunchycone-id',
        }),
      } as any);
    }

    service = new ServiceClass();
  });

  test('should implement EmailService interface', () => {
    expect(service).toHaveProperty('sendEmail');
    expect(typeof service.sendEmail).toBe('function');
  });

  test('should send text-only email successfully', async () => {
    const response = await service.sendEmail(testEmailParams.basic);
    expectSuccessResponse(response);
  });

  test('should send text + HTML email successfully', async () => {
    const response = await service.sendEmail(testEmailParams.withHtml);
    expectSuccessResponse(response);
  });

  test('should handle single recipient', async () => {
    const response = await service.sendEmail(testEmailParams.basic);
    expectSuccessResponse(response);
  });

  test('should handle multiple recipients', async () => {
    const response = await service.sendEmail(testEmailParams.multiRecipient);
    expectSuccessResponse(response);
  });

  test('should handle custom from address', async () => {
    const response = await service.sendEmail(testEmailParams.withCustomFrom);
    expectSuccessResponse(response);
  });

  test('should handle special characters in subject/body', async () => {
    const response = await service.sendEmail(testEmailParams.specialChars);
    expectSuccessResponse(response);
  });

  test('should handle empty subject gracefully', async () => {
    const response = await service.sendEmail(testEmailParams.emptySubject);
    expectSuccessResponse(response);
  });

  test('should handle structured EmailAddress for to field', async () => {
    const response = await service.sendEmail(testEmailParams.structuredTo);
    expectSuccessResponse(response);
  });

  test('should handle structured EmailAddress for from field', async () => {
    const response = await service.sendEmail(testEmailParams.structuredFrom);
    expectSuccessResponse(response);
  });

  test('should handle mixed recipient array', async () => {
    const response = await service.sendEmail(testEmailParams.mixedRecipients);
    expectSuccessResponse(response);
  });

  test('should handle fully structured email with names', async () => {
    const response = await service.sendEmail(testEmailParams.fullStructured);
    expectSuccessResponse(response);
  });

  test('should return response with messageId', async () => {
    const response = await service.sendEmail(testEmailParams.basic);
    expect(response.success).toBe(true);
    expect(response.messageId).toBeDefined();
    expect(typeof response.messageId).toBe('string');
    expect(response.messageId!.length).toBeGreaterThan(0);
  });
});