// Test helpers and utilities
import { EmailParams } from '../../../../src/services/email/types';

export const testEmailParams = {
  basic: {
    to: 'test@example.com',
    subject: 'Test Subject',
    textBody: 'Hello World',
  },
  withHtml: {
    to: 'test@example.com',
    subject: 'Test Subject',
    textBody: 'Hello World',
    htmlBody: '<h1>Hello World</h1>',
  },
  multiRecipient: {
    to: ['test1@example.com', 'test2@example.com'] as string[],
    subject: 'Test Subject',
    textBody: 'Hello World',
  },
  withCustomFrom: {
    to: 'test@example.com',
    subject: 'Test Subject',
    textBody: 'Hello World',
    from: 'custom@example.com',
  },
  specialChars: {
    to: 'test@example.com',
    subject: 'Tëst Sübject 🚀',
    textBody: 'Héllö Wörld! 🌍',
    htmlBody: '<h1>Héllö Wörld! 🌍</h1>',
  },
  emptySubject: {
    to: 'test@example.com',
    subject: '',
    textBody: 'Hello World',
  },
  // New structured email format tests
  structuredTo: {
    to: { email: 'test@example.com', name: 'Test User' },
    subject: 'Test Subject',
    textBody: 'Hello World',
  },
  structuredFrom: {
    to: 'test@example.com',
    subject: 'Test Subject',
    textBody: 'Hello World',
    from: { email: 'sender@example.com', name: 'Sender Name' },
  },
  mixedRecipients: {
    to: [
      'simple@example.com',
      { email: 'structured@example.com', name: 'Structured User' },
    ],
    subject: 'Test Subject',
    textBody: 'Hello World',
  },
  fullStructured: {
    to: { email: 'test@example.com', name: 'Test User' },
    from: { email: 'sender@example.com', name: 'Company Name' },
    subject: 'Test Subject',
    textBody: 'Hello World',
    htmlBody: '<h1>Hello World</h1>',
  },
} as const satisfies Record<string, EmailParams>;

export const mockEnvVars = {
  smtp: {
    CRUNCHYCONE_SMTP_HOST: 'smtp.gmail.com',
    CRUNCHYCONE_SMTP_PORT: '587',
    CRUNCHYCONE_SMTP_USER: 'test@gmail.com',
    CRUNCHYCONE_SMTP_PASS: 'password123',
    CRUNCHYCONE_SMTP_FROM: 'test@gmail.com',
  },
  sendgrid: {
    CRUNCHYCONE_SENDGRID_API_KEY: 'SG.test_api_key',
    CRUNCHYCONE_SENDGRID_FROM: 'test@sendgrid.com',
  },
  resend: {
    CRUNCHYCONE_RESEND_API_KEY: 're_test_api_key',
    CRUNCHYCONE_RESEND_FROM: 'test@resend.dev',
  },
  ses: {
    CRUNCHYCONE_AWS_ACCESS_KEY_ID: 'AKIATEST',
    CRUNCHYCONE_AWS_SECRET_ACCESS_KEY: 'test_secret_key',
    CRUNCHYCONE_AWS_REGION: 'us-east-1',
    CRUNCHYCONE_SES_FROM: 'test@aws.com',
  },
  mailgun: {
    CRUNCHYCONE_MAILGUN_API_KEY: 'mg_test_api_key',
    CRUNCHYCONE_MAILGUN_DOMAIN: 'mg.example.com',
    CRUNCHYCONE_MAILGUN_FROM: 'test@mg.example.com',
  },
  crunchycone: {
    CRUNCHYCONE_API_KEY: 'cc_test_api_key',
    CRUNCHYCONE_FROM: 'test@crunchycone.com',
  },
} as const;

export function setEnvVars(provider: keyof typeof mockEnvVars, includeDisplayName = false): void {
  const vars = mockEnvVars[provider];
  Object.entries(vars).forEach(([key, value]) => {
    process.env[key] = value;
  });
  
  // Optionally set display name for testing
  if (includeDisplayName) {
    process.env.CRUNCHYCONE_EMAIL_FROM_DISPLAY = 'Test Company';
  }
}

export function expectSuccessResponse(response: any): void {
  expect(response).toMatchObject({
    success: true,
    messageId: expect.any(String),
  });
  expect(response.error).toBeUndefined();
}

export function expectErrorResponse(response: any): void {
  expect(response).toMatchObject({
    success: false,
    error: expect.any(String),
  });
  expect(response.messageId).toBeUndefined();
}