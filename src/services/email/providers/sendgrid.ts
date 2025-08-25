import { 
  EmailService, 
  EmailParams, 
  EmailResponse, 
  SendGridEmailProvider,
  EmailMessage,
  ProviderConfig,
  SendResult,
  DeliveryStatus,
  WebhookEvent,
} from '../types';
import { formatSingleEmailForProvider, formatEmailArrayForProvider } from '../utils';
import * as crypto from 'crypto';

// Import SendGrid statically for better testability
import sgMail from '@sendgrid/mail';

export interface SendGridConfig extends ProviderConfig {
  clickTracking?: boolean;
  openTracking?: boolean;
}

export class SendGridEmailService implements EmailService {
  private apiKey: string;
  private from: string;
  private fromDisplayName?: string;
  private clickTracking: boolean;
  private openTracking: boolean;

  constructor() {
    this.apiKey = process.env.CRUNCHYCONE_SENDGRID_API_KEY || '';
    this.from = process.env.CRUNCHYCONE_SENDGRID_FROM || '';
    this.fromDisplayName = process.env.CRUNCHYCONE_EMAIL_FROM_DISPLAY;
    this.clickTracking = process.env.CRUNCHYCONE_SENDGRID_CLICK_TRACKING !== 'false';
    this.openTracking = process.env.CRUNCHYCONE_SENDGRID_OPEN_TRACKING !== 'false';

    if (!this.apiKey || !this.from) {
      throw new Error('Missing required SendGrid environment variables');
    }
  }

  async sendEmail(params: EmailParams): Promise<EmailResponse> {
    try {
      sgMail.setApiKey(this.apiKey);

      const content = [
        {
          type: 'text/plain',
          value: params.textBody,
        },
      ];

      if (params.htmlBody) {
        content.push({
          type: 'text/html',
          value: params.htmlBody,
        });
      }

      // Build tracking settings
      const trackingSettings: any = {
        click_tracking: { enable: this.clickTracking },
        open_tracking: { enable: this.openTracking },
      };

      const msg: any = {
        to: Array.isArray(params.to) ? formatEmailArrayForProvider(params.to) : formatSingleEmailForProvider(params.to),
        from: params.from ? formatSingleEmailForProvider(params.from) : (
          this.fromDisplayName ? {
            email: this.from,
            name: this.fromDisplayName,
          } : this.from
        ),
        subject: params.subject,
        content,
        tracking_settings: trackingSettings,
      };

      // Apply provider-specific settings if provided
      if (params.providerSettings) {
        Object.assign(msg, params.providerSettings);
        // If provider settings contain tracking_settings, merge with defaults
        if (params.providerSettings.tracking_settings) {
          msg.tracking_settings = {
            ...trackingSettings,
            ...params.providerSettings.tracking_settings,
          };
        }
      }

      const [response] = await sgMail.send(msg);

      return {
        success: true,
        messageId: response.headers['x-message-id'] as string,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

export class SendGridProvider implements SendGridEmailProvider {
  private config: SendGridConfig;

  constructor(config: SendGridConfig) {
    this.config = config;
    sgMail.setApiKey(config.apiKey);
  }

  async sendEmail(message: EmailMessage, _config?: ProviderConfig): Promise<SendResult> {
    try {
      // Select sub-account API key if needed
      const apiKey = this.selectAPIKey(message.from.email);
      sgMail.setApiKey(apiKey);

      // Build SendGrid message
      const sgMessage: any = {
        from: {
          email: message.from.email,
          name: message.from.name || this.config.defaultFromName,
        },
        personalizations: [{
          to: message.to.map(recipient => ({
            email: recipient.email,
            name: recipient.name,
          })),
        }],
        subject: message.subject,
        content: [
          {
            type: 'text/plain',
            value: message.textBody,
          },
        ],
        custom_args: {
          crunchycone_email_id: message.trackingId,
          is_sensitive: message.isSensitive.toString(),
        },
      };

      // Add HTML content if provided
      if (message.htmlBody) {
        sgMessage.content.push({
          type: 'text/html',
          value: message.htmlBody,
        });
      }

      // Send the email
      const [response] = await sgMail.send(sgMessage);

      return {
        providerMessageId: this.extractMessageId(response.headers),
        status: this.mapSendGridStatus(response.statusCode),
        message: String(response.body) || 'Email sent successfully',
      };
    } catch (error) {
      throw new Error(`SendGrid API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getDeliveryStatus(messageId: string): Promise<DeliveryStatus> {
    // This would require SendGrid's Activity API
    // For now, return a basic status
    return {
      messageId,
      status: 'unknown',
    };
  }

  async processWebhook(payload: any): Promise<WebhookEvent[]> {
    if (!Array.isArray(payload)) {
      return [];
    }

    return payload.map((event: any) => ({
      messageId: event.sg_message_id,
      event: event.event,
      timestamp: new Date(event.timestamp * 1000),
      reason: event.reason,
      emailId: event.custom_args?.crunchycone_email_id,
      recipient: event.email,
      customArgs: event.custom_args,
    }));
  }

  private selectAPIKey(fromEmail: string): string {
    if (!this.config.subAccounts) {
      return this.config.apiKey;
    }

    const domain = this.extractDomain(fromEmail);
    const subAccount = this.config.subAccounts[domain];
    
    return subAccount ? subAccount.apiKey : this.config.apiKey;
  }

  private extractDomain(email: string): string {
    return email.split('@')[1] || '';
  }

  private extractMessageId(headers: any): string {
    return headers['x-message-id'] || '';
  }

  private mapSendGridStatus(statusCode: number): string {
    if (statusCode >= 200 && statusCode < 300) {
      return 'queued';
    } else if (statusCode >= 400) {
      return 'failed';
    }
    return 'unknown';
  }

  static verifyWebhookSignature(payload: Buffer, signature: string, secret: string): boolean {
    if (!signature.startsWith('sha256=')) {
      return false;
    }

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('base64');

    return `sha256=${expectedSignature}` === signature;
  }
}