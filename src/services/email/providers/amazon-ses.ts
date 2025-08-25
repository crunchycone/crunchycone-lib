import { EmailService, EmailParams, EmailResponse } from '../types';
import { formatSingleEmailForProvider, formatEmailArrayForProvider, formatEmailWithDisplayName } from '../utils';

export class AmazonSESEmailService implements EmailService {
  private accessKeyId: string;
  private secretAccessKey: string;
  private region: string;
  private from: string;
  private fromDisplayName?: string;
  private sesClient: any;

  constructor() {
    this.accessKeyId = process.env.CRUNCHYCONE_AWS_ACCESS_KEY_ID || '';
    this.secretAccessKey = process.env.CRUNCHYCONE_AWS_SECRET_ACCESS_KEY || '';
    this.region = process.env.CRUNCHYCONE_AWS_REGION || 'us-east-1';
    this.from = process.env.CRUNCHYCONE_SES_FROM || '';
    this.fromDisplayName = process.env.CRUNCHYCONE_EMAIL_FROM_DISPLAY;

    // Configuration validation will happen when the service is actually used
  }

  private async initializeSESClient() {
    if (this.sesClient) {
      return this.sesClient;
    }

    // Validate configuration when actually trying to use the service
    if (!this.accessKeyId || !this.secretAccessKey || !this.from) {
      throw new Error(
        'Missing required Amazon SES environment variables:\n' +
        '- CRUNCHYCONE_AWS_ACCESS_KEY_ID: Your AWS access key ID\n' +
        '- CRUNCHYCONE_AWS_SECRET_ACCESS_KEY: Your AWS secret access key\n' +
        '- CRUNCHYCONE_SES_FROM: The sender email address\n' +
        '- CRUNCHYCONE_AWS_REGION: AWS region (optional, defaults to us-east-1)'
      );
    }

    try {
      const { SESClient } = await import('@aws-sdk/client-ses');
      
      this.sesClient = new SESClient({
        region: this.region,
        credentials: {
          accessKeyId: this.accessKeyId,
          secretAccessKey: this.secretAccessKey,
        },
      });

      return this.sesClient;
    } catch (error) {
      if ((error as any).code === 'MODULE_NOT_FOUND') {
        throw new Error(
          'AWS SES SDK not found. Please install it with:\n' +
          'npm install @aws-sdk/client-ses\n' +
          'or\n' +
          'yarn add @aws-sdk/client-ses',
        );
      }
      throw error;
    }
  }

  async sendEmail(params: EmailParams): Promise<EmailResponse> {
    try {
      const sesClient = await this.initializeSESClient();
      const { SendEmailCommand } = await import('@aws-sdk/client-ses');

      const body: any = {
        Text: {
          Charset: 'UTF-8',
          Data: params.textBody,
        },
      };

      if (params.htmlBody) {
        body.Html = {
          Charset: 'UTF-8',
          Data: params.htmlBody,
        };
      }

      const command = new SendEmailCommand({
        Source: params.from ? formatSingleEmailForProvider(params.from) : formatEmailWithDisplayName(this.from, this.fromDisplayName),
        Destination: {
          ToAddresses: formatEmailArrayForProvider(params.to),
        },
        Message: {
          Subject: {
            Charset: 'UTF-8',
            Data: params.subject,
          },
          Body: body,
        },
      });

      const result = await sesClient.send(command);

      return {
        success: true,
        messageId: result.MessageId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}