import { EmailService, EmailParams, EmailResponse, EmailRecipient } from '../types';

export class ConsoleEmailService implements EmailService {
  private formatRecipient(recipient: EmailRecipient): string {
    if (typeof recipient === 'string') {
      return recipient;
    }
    return recipient.name ? `${recipient.name} <${recipient.email}>` : recipient.email;
  }

  private formatRecipientArray(recipients: EmailRecipient | EmailRecipient[]): string {
    const recipientArray = Array.isArray(recipients) ? recipients : [recipients];
    return recipientArray.map(r => this.formatRecipient(r)).join(', ');
  }

  async sendEmail(params: EmailParams): Promise<EmailResponse> {
    try {
      const timestamp = new Date().toISOString();
      const messageId = `console-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Create a separator for visual clarity
      const separator = '='.repeat(80);

      console.log('\n' + separator);
      console.log('📧 CONSOLE EMAIL PROVIDER - EMAIL SENT');
      console.log(separator);
      console.log(`⏰ Timestamp: ${timestamp}`);
      console.log(`🆔 Message ID: ${messageId}`);
      console.log('');
      
      // Email headers
      console.log('📤 FROM:', params.from ? this.formatRecipient(params.from) : 'No sender specified');
      console.log('📥 TO:', this.formatRecipientArray(params.to));
      console.log('📋 SUBJECT:', params.subject);
      console.log('');

      // Email body
      console.log('📄 TEXT BODY:');
      console.log('-'.repeat(40));
      console.log(params.textBody);
      console.log('-'.repeat(40));

      // HTML body info (if present)
      if (params.htmlBody) {
        console.log('');
        console.log('🌐 HTML BODY: Present (not displayed in console)');
        console.log(`📏 HTML Length: ${params.htmlBody.length} characters`);
      }

      // Provider settings (if present)
      if (params.providerSettings && Object.keys(params.providerSettings).length > 0) {
        console.log('');
        console.log('⚙️  PROVIDER SETTINGS:');
        console.log(JSON.stringify(params.providerSettings, null, 2));
      }

      console.log(separator);
      console.log('✅ Email logged to console successfully');
      console.log(separator + '\n');

      return {
        success: true,
        messageId,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      console.error('\n' + '='.repeat(80));
      console.error('❌ CONSOLE EMAIL PROVIDER - ERROR');
      console.error('='.repeat(80));
      console.error('Error:', errorMessage);
      console.error('='.repeat(80) + '\n');

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async isAvailable(): Promise<boolean> {
    return true; // Console provider has no dependencies
  }
}