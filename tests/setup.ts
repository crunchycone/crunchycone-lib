// Set default environment variables for tests to prevent auth issues
process.env.CRUNCHYCONE_API_KEY = process.env.CRUNCHYCONE_API_KEY || 'test-api-key-global';

// Mock auth functions to prevent keytar issues during tests
jest.mock('../src/auth/crunchycone-auth', () => {
  const actual = jest.requireActual('../src/auth/crunchycone-auth');
  return {
    ...actual,
    getCrunchyConeAPIKey: jest.fn().mockResolvedValue('test-api-key-mock'),
    hasCrunchyConeAPIKey: jest.fn().mockResolvedValue(true),
    getCrunchyConeAPIKeyWithFallback: jest.fn().mockResolvedValue('test-api-key-mock'),
    getCrunchyConeAPIURL: jest.fn().mockReturnValue('https://api.crunchycone.com'),
    getCrunchyConeProjectID: jest.fn().mockImplementation(() => {
      return process.env.CRUNCHYCONE_PROJECT_ID || undefined;
    }),
  };
});

// Global test setup
beforeEach(() => {
  // Clear all environment variables before each test, but preserve API key
  delete process.env.CRUNCHYCONE_EMAIL_PROVIDER;
  delete process.env.CRUNCHYCONE_SMTP_HOST;
  delete process.env.CRUNCHYCONE_SMTP_PORT;
  delete process.env.CRUNCHYCONE_SMTP_USER;
  delete process.env.CRUNCHYCONE_SMTP_PASS;
  delete process.env.CRUNCHYCONE_SMTP_FROM;
  delete process.env.CRUNCHYCONE_SENDGRID_API_KEY;
  delete process.env.CRUNCHYCONE_SENDGRID_FROM;
  delete process.env.CRUNCHYCONE_RESEND_API_KEY;
  delete process.env.CRUNCHYCONE_RESEND_FROM;
  delete process.env.CRUNCHYCONE_AWS_ACCESS_KEY_ID;
  delete process.env.CRUNCHYCONE_AWS_SECRET_ACCESS_KEY;
  delete process.env.CRUNCHYCONE_AWS_REGION;
  delete process.env.CRUNCHYCONE_SES_FROM;
  delete process.env.CRUNCHYCONE_MAILGUN_API_KEY;
  delete process.env.CRUNCHYCONE_MAILGUN_DOMAIN;
  delete process.env.CRUNCHYCONE_MAILGUN_FROM;
  
  // Ensure API key is always set for tests
  process.env.CRUNCHYCONE_API_KEY = 'test-api-key-global';
});

// Console spy to suppress logs during tests
beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});