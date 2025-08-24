import {
  isEmailAddress,
  validateEmail,
  normalizeEmailRecipient,
  formatEmailForSMTP,
  formatEmailForProvider,
  formatEmailArrayForSMTP,
  formatEmailArrayForProvider,
  formatSingleEmailForProvider,
  formatEmailWithDisplayName,
} from '../../../src/services/email/utils';

describe('Email Utils', () => {
  describe('isEmailAddress', () => {
    test('should return true for EmailAddress objects', () => {
      expect(isEmailAddress({ email: 'test@example.com' })).toBe(true);
      expect(isEmailAddress({ email: 'test@example.com', name: 'Test User' })).toBe(true);
    });

    test('should return false for strings', () => {
      expect(isEmailAddress('test@example.com')).toBe(false);
    });

    test('should return false for null/undefined', () => {
      expect(isEmailAddress(null as any)).toBe(false);
      expect(isEmailAddress(undefined as any)).toBe(false);
    });
  });

  describe('validateEmail', () => {
    test('should validate correct email addresses', () => {
      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('user.name+tag@domain.co.uk')).toBe(true);
      expect(validateEmail('test123@test-domain.com')).toBe(true);
    });

    test('should reject invalid email addresses', () => {
      expect(validateEmail('invalid-email')).toBe(false);
      expect(validateEmail('test@')).toBe(false);
      expect(validateEmail('@domain.com')).toBe(false);
      expect(validateEmail('test@domain')).toBe(false);
      expect(validateEmail('')).toBe(false);
    });
  });

  describe('normalizeEmailRecipient', () => {
    test('should normalize EmailAddress objects', () => {
      const result = normalizeEmailRecipient({ email: 'test@example.com', name: 'Test User' });
      expect(result).toEqual({ email: 'test@example.com', name: 'Test User' });
    });

    test('should normalize string emails', () => {
      const result = normalizeEmailRecipient('test@example.com');
      expect(result).toEqual({ email: 'test@example.com' });
    });

    test('should throw error for invalid EmailAddress object', () => {
      expect(() => normalizeEmailRecipient({ email: 'invalid-email', name: 'Test' }))
        .toThrow('Invalid email address: invalid-email');
    });

    test('should throw error for invalid string email', () => {
      expect(() => normalizeEmailRecipient('invalid-email'))
        .toThrow('Invalid email address: invalid-email');
    });
  });

  describe('formatEmailForSMTP', () => {
    test('should format EmailAddress with name for SMTP', () => {
      const result = formatEmailForSMTP({ email: 'test@example.com', name: 'Test User' });
      expect(result).toBe('"Test User" <test@example.com>');
    });

    test('should format EmailAddress without name for SMTP', () => {
      const result = formatEmailForSMTP({ email: 'test@example.com' });
      expect(result).toBe('test@example.com');
    });

    test('should format string email for SMTP', () => {
      const result = formatEmailForSMTP('test@example.com');
      expect(result).toBe('test@example.com');
    });
  });

  describe('formatEmailForProvider', () => {
    test('should extract email from EmailAddress object', () => {
      const result = formatEmailForProvider({ email: 'test@example.com', name: 'Test User' });
      expect(result).toBe('test@example.com');
    });

    test('should return string email as-is', () => {
      const result = formatEmailForProvider('test@example.com');
      expect(result).toBe('test@example.com');
    });
  });

  describe('formatEmailArrayForSMTP', () => {
    test('should format single recipient', () => {
      const result = formatEmailArrayForSMTP('test@example.com');
      expect(result).toBe('test@example.com');
    });

    test('should format array of recipients', () => {
      const result = formatEmailArrayForSMTP([
        'simple@example.com',
        { email: 'test@example.com', name: 'Test User' },
      ]);
      expect(result).toBe('simple@example.com, "Test User" <test@example.com>');
    });

    test('should format mixed array correctly', () => {
      const result = formatEmailArrayForSMTP([
        { email: 'first@example.com', name: 'First User' },
        'second@example.com',
        { email: 'third@example.com', name: 'Third User' },
      ]);
      expect(result).toBe('"First User" <first@example.com>, second@example.com, "Third User" <third@example.com>');
    });
  });

  describe('formatEmailArrayForProvider', () => {
    test('should format single recipient to array', () => {
      const result = formatEmailArrayForProvider('test@example.com');
      expect(result).toEqual(['test@example.com']);
    });

    test('should extract emails from array of recipients', () => {
      const result = formatEmailArrayForProvider([
        'simple@example.com',
        { email: 'test@example.com', name: 'Test User' },
      ]);
      expect(result).toEqual(['simple@example.com', 'test@example.com']);
    });
  });

  describe('formatSingleEmailForProvider', () => {
    test('should extract email from EmailAddress object', () => {
      const result = formatSingleEmailForProvider({ email: 'test@example.com', name: 'Test User' });
      expect(result).toBe('test@example.com');
    });

    test('should return string email as-is', () => {
      const result = formatSingleEmailForProvider('test@example.com');
      expect(result).toBe('test@example.com');
    });
  });

  describe('Edge Cases', () => {
    test('should handle emails with special characters in names', () => {
      const result = formatEmailForSMTP({ email: 'test@example.com', name: 'Test "Special" User' });
      expect(result).toBe('"Test \\"Special\\" User" <test@example.com>');
    });

    test('should handle empty name in EmailAddress', () => {
      const result = formatEmailForSMTP({ email: 'test@example.com', name: '' });
      expect(result).toBe('test@example.com');
    });

    test('should handle undefined name in EmailAddress', () => {
      const result = formatEmailForSMTP({ email: 'test@example.com', name: undefined });
      expect(result).toBe('test@example.com');
    });
  });

  describe('formatEmailWithDisplayName', () => {
    test('should format email with display name', () => {
      const result = formatEmailWithDisplayName('test@example.com', 'Test User');
      expect(result).toBe('"Test User" <test@example.com>');
    });

    test('should format email without display name', () => {
      const result = formatEmailWithDisplayName('test@example.com');
      expect(result).toBe('test@example.com');
    });

    test('should format email with undefined display name', () => {
      const result = formatEmailWithDisplayName('test@example.com', undefined);
      expect(result).toBe('test@example.com');
    });

    test('should format email with empty display name', () => {
      const result = formatEmailWithDisplayName('test@example.com', '');
      expect(result).toBe('test@example.com');
    });

    test('should format email with whitespace-only display name', () => {
      const result = formatEmailWithDisplayName('test@example.com', '   ');
      expect(result).toBe('test@example.com');
    });

    test('should escape quotes in display name', () => {
      const result = formatEmailWithDisplayName('test@example.com', 'Test "Special" User');
      expect(result).toBe('"Test \\"Special\\" User" <test@example.com>');
    });

    test('should trim display name whitespace', () => {
      const result = formatEmailWithDisplayName('test@example.com', '  Test User  ');
      expect(result).toBe('"Test User" <test@example.com>');
    });
  });
});