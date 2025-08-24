export interface EmailAddress {
  email: string;
  name?: string;
}

export type EmailRecipient = string | EmailAddress;

export interface EmailParams {
  to: EmailRecipient | EmailRecipient[];
  subject: string;
  textBody: string;
  htmlBody?: string;
  from?: EmailRecipient;
  providerSettings?: Record<string, any>;
  sensitive?: boolean;
  sendgridSubaccount?: string;
}

export interface EmailResponse {
  success: boolean;
  messageId?: string;
  emailId?: string;
  status?: string;
  sendgridMessageId?: string;
  sentAt?: Date;
  error?: string;
}

export interface EmailService {
  sendEmail(params: EmailParams): Promise<EmailResponse>;
}

export interface EmailStatusResponse {
  emailId: string;
  from: EmailAddress;
  to: EmailAddress[];
  subject: string;
  status: EmailStatus;
  failureReason?: string;
  sendgridMessageId?: string;
  isCliApiKey: boolean;
  isSensitive: boolean;
  createdAt: Date;
  sentAt?: Date;
  deliveredAt?: Date;
}

export interface ListEmailsResponse {
  emails: EmailStatusResponse[];
  totalCount: number;
  hasMore: boolean;
}

export interface ListEmailsOptions {
  status?: string;
  limit?: number;
  offset?: number;
}

export type EmailStatus = 'queued' | 'sending' | 'sent' | 'failed' | 'bounced' | 'delivered';

export interface WebhookEvent {
  messageId: string;
  event: string;
  timestamp: Date;
  reason?: string;
  emailId: string;
  recipient?: string;
  customArgs?: Record<string, string>;
}

export interface SendEmailRequest {
  userId: string;
  fromAddress: EmailAddress;
  toAddresses: EmailAddress[];
  subject: string;
  textBody: string;
  htmlBody?: string;
  isCliApiKey: boolean;
  sensitive: boolean;
  sendgridSubaccount?: string;
}

export interface SendEmailGrpcResponse {
  emailId: string;
  status: string;
  message: string;
  sendgridMessageId: string;
  sentAt: Date;
}

export interface SendGridEmailProvider {
  sendEmail(message: EmailMessage, config?: ProviderConfig): Promise<SendResult>;
  getDeliveryStatus?(messageId: string): Promise<DeliveryStatus>;
  processWebhook?(payload: any): Promise<WebhookEvent[]>;
}

export interface EmailMessage {
  from: EmailAddress;
  to: EmailAddress[];
  subject: string;
  textBody: string;
  htmlBody?: string;
  trackingId: string;
  isSensitive: boolean;
  subAccount?: string;
}

export interface ProviderConfig {
  apiKey: string;
  defaultFromEmail?: string;
  defaultFromName?: string;
  webhookVerifyKey?: string;
  subAccounts?: Record<string, SubAccountConfig>;
}

export interface SubAccountConfig {
  apiKey: string;
  fromEmail: string;
  fromName: string;
  domain: string;
}

export interface SendResult {
  providerMessageId: string;
  status: string;
  message: string;
}

export interface DeliveryStatus {
  messageId: string;
  status: string;
  deliveredAt?: Date;
  failureReason?: string;
}

export type EmailProvider = 'smtp' | 'sendgrid' | 'resend' | 'ses' | 'mailgun' | 'crunchycone' | 'console';