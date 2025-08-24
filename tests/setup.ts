// Global test setup
beforeEach(() => {
  // Clear all environment variables before each test
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
});

// Console spy to suppress logs during tests
beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});