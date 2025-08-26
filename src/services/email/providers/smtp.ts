import { EmailService, EmailParams, EmailResponse } from '../types';
import { formatEmailForSMTP, formatEmailArrayForSMTP, formatEmailWithDisplayName } from '../utils';

// Import nodemailer statically for better testability
import * as nodemailer from 'nodemailer';

export class SMTPEmailService implements EmailService {
  private host: string;
  private port: number;
  private user: string;
  private pass: string;
  private from: string;
  private fromDisplayName?: string;

  constructor() {
    this.host = process.env.CRUNCHYCONE_SMTP_HOST || '';
    this.port = parseInt(process.env.CRUNCHYCONE_SMTP_PORT || '587');
    this.user = process.env.CRUNCHYCONE_SMTP_USER || '';
    this.pass = process.env.CRUNCHYCONE_SMTP_PASS || '';
    this.from = process.env.CRUNCHYCONE_SMTP_FROM || '';
    this.fromDisplayName = process.env.CRUNCHYCONE_EMAIL_FROM_DISPLAY;

    if (!this.host || !this.user || !this.pass || !this.from) {
      throw new Error('Missing required SMTP environment variables');
    }
  }

  async sendEmail(params: EmailParams): Promise<EmailResponse> {
    try {
      const transporter = nodemailer.createTransport({
        host: this.host,
        port: this.port,
        secure: this.port === 465,
        auth: {
          user: this.user,
          pass: this.pass,
        },
      });

      const mailOptions = {
        from: params.from ? formatEmailForSMTP(params.from) : formatEmailWithDisplayName(this.from, this.fromDisplayName),
        to: formatEmailArrayForSMTP(params.to),
        subject: params.subject,
        text: params.textBody,
        html: params.htmlBody,
      };

      const info = await transporter.sendMail(mailOptions);

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async isAvailable(): Promise<boolean> {
    return true; // SMTP provider has no optional dependencies
  }
}