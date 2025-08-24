import { EmailService, EmailParams, EmailResponse } from '../types';
import { formatSingleEmailForProvider, formatEmailArrayForSMTP, formatEmailWithDisplayName } from '../utils';

interface MailgunApiResponse {
  id: string;
  message: string;
}

export class MailgunEmailService implements EmailService {
  private apiKey: string;
  private domain: string;
  private from: string;
  private fromDisplayName?: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.CRUNCHYCONE_MAILGUN_API_KEY || '';
    this.domain = process.env.CRUNCHYCONE_MAILGUN_DOMAIN || '';
    this.from = process.env.CRUNCHYCONE_MAILGUN_FROM || '';
    this.fromDisplayName = process.env.CRUNCHYCONE_EMAIL_FROM_DISPLAY;
    this.baseUrl = `https://api.mailgun.net/v3/${this.domain}`;

    if (!this.apiKey || !this.domain || !this.from) {
      throw new Error('Missing required Mailgun environment variables');
    }
  }

  async sendEmail(params: EmailParams): Promise<EmailResponse> {
    try {
      const formData = new URLSearchParams();
      formData.append('from', params.from ? formatSingleEmailForProvider(params.from) : formatEmailWithDisplayName(this.from, this.fromDisplayName));
      formData.append('to', formatEmailArrayForSMTP(params.to));
      formData.append('subject', params.subject);
      formData.append('text', params.textBody);

      if (params.htmlBody) {
        formData.append('html', params.htmlBody);
      }

      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`api:${this.apiKey}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Mailgun API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json() as MailgunApiResponse;

      return {
        success: true,
        messageId: data.id,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}