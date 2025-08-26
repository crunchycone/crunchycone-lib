import { EmailService, EmailParams, EmailResponse } from '../types';
import { formatSingleEmailForProvider, formatEmailArrayForProvider, formatEmailWithDisplayName } from '../utils';

export class ResendEmailService implements EmailService {
  private apiKey: string;
  private from: string;
  private fromDisplayName?: string;

  constructor() {
    this.apiKey = process.env.CRUNCHYCONE_RESEND_API_KEY || '';
    this.from = process.env.CRUNCHYCONE_RESEND_FROM || '';
    this.fromDisplayName = process.env.CRUNCHYCONE_EMAIL_FROM_DISPLAY;

    if (!this.apiKey || !this.from) {
      throw new Error('Missing required Resend environment variables');
    }
  }

  async sendEmail(params: EmailParams): Promise<EmailResponse> {
    try {
      const resendPackage = 'resend'.split('').join('');
      const { Resend } = await import(resendPackage);
      const resend = new Resend(this.apiKey);

      const emailData: any = {
        from: params.from ? formatSingleEmailForProvider(params.from) : formatEmailWithDisplayName(this.from, this.fromDisplayName),
        to: Array.isArray(params.to) ? formatEmailArrayForProvider(params.to) : formatSingleEmailForProvider(params.to),
        subject: params.subject,
        text: params.textBody,
      };

      if (params.htmlBody) {
        emailData.html = params.htmlBody;
      }

      const { data, error } = await resend.emails.send(emailData);

      if (error) {
        return {
          success: false,
          error: error.message || JSON.stringify(error),
        };
      }

      return {
        success: true,
        messageId: data?.id,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const resendPackage = 'resend'.split('').join('');
      await import(resendPackage);
      return true;
    } catch {
      return false;
    }
  }
}