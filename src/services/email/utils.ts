import { EmailRecipient, EmailAddress } from './types';

export function isEmailAddress(recipient: EmailRecipient): recipient is EmailAddress {
  return typeof recipient === 'object' && recipient !== null && 'email' in recipient;
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function normalizeEmailRecipient(recipient: EmailRecipient): { email: string; name?: string } {
  if (isEmailAddress(recipient)) {
    if (!validateEmail(recipient.email)) {
      throw new Error(`Invalid email address: ${recipient.email}`);
    }
    return recipient;
  }
  
  if (!validateEmail(recipient)) {
    throw new Error(`Invalid email address: ${recipient}`);
  }
  
  return { email: recipient };
}

export function formatEmailForSMTP(recipient: EmailRecipient): string {
  const normalized = normalizeEmailRecipient(recipient);
  if (normalized.name && normalized.name.trim()) {
    // Escape quotes in the name
    const escapedName = normalized.name.replace(/"/g, '\\"');
    return `"${escapedName}" <${normalized.email}>`;
  }
  return normalized.email;
}

export function formatEmailForProvider(recipient: EmailRecipient): string {
  const normalized = normalizeEmailRecipient(recipient);
  return normalized.email;
}

export function formatEmailArrayForSMTP(recipients: EmailRecipient | EmailRecipient[]): string {
  const recipientArray = Array.isArray(recipients) ? recipients : [recipients];
  return recipientArray.map(formatEmailForSMTP).join(', ');
}

export function formatEmailArrayForProvider(recipients: EmailRecipient | EmailRecipient[]): string[] {
  const recipientArray = Array.isArray(recipients) ? recipients : [recipients];
  return recipientArray.map(formatEmailForProvider);
}

export function formatSingleEmailForProvider(recipient: EmailRecipient): string {
  return formatEmailForProvider(recipient);
}

/**
 * Formats an email address with display name for providers that support it
 * @param email - The email address
 * @param displayName - Optional display name 
 * @returns Formatted email string (e.g., "Display Name <email@example.com>" or "email@example.com")
 */
export function formatEmailWithDisplayName(email: string, displayName?: string): string {
  if (displayName && displayName.trim()) {
    // Escape quotes in the display name
    const escapedName = displayName.trim().replace(/"/g, '\\"');
    return `"${escapedName}" <${email}>`;
  }
  return email;
}