import { EmailTemplateOptions, RenderedTemplate, TemplateMetadata, TemplateData } from './types';
import { EmailService } from '../types';
import { getEmailService } from '../factory';
import { getEmailTemplateEngine } from './factory';

export class EmailTemplateService {
  private templateEngine = getEmailTemplateEngine();
  private emailService: EmailService;

  constructor(emailService?: EmailService) {
    this.emailService = emailService || getEmailService();
  }

  async sendTemplatedEmail(options: EmailTemplateOptions): Promise<void> {
    const { to, from } = options;
    
    const rendered = await this.templateEngine.renderTemplate(options);
    
    const recipients = Array.isArray(to) ? to : [to];
    
    await this.emailService.sendEmail({
      to: recipients,
      from,
      subject: rendered.subject,
      textBody: rendered.text,
      htmlBody: rendered.html,
    });

    if (process.env.NODE_ENV === 'development') {
      console.log('📧 Template email sent:', {
        template: options.template,
        language: rendered.metadata.language,
        fallbackUsed: rendered.metadata.fallbackUsed,
        warnings: rendered.metadata.mjmlWarnings?.length || 0,
        to: options.to,
      });
    }
  }

  async renderTemplate(options: EmailTemplateOptions): Promise<RenderedTemplate> {
    return this.templateEngine.renderTemplate(options);
  }

  async getAvailableTemplates(): Promise<TemplateMetadata[]> {
    return this.templateEngine.getAvailableTemplates();
  }

  async validateTemplate(templateName: string, language?: string): Promise<boolean> {
    return this.templateEngine.validateTemplate(templateName, language);
  }

  async previewTemplate(templateName: string, data: TemplateData, language?: string): Promise<RenderedTemplate> {
    return this.templateEngine.previewTemplate(templateName, data, language);
  }
}

// Global instance
let globalEmailTemplateService: EmailTemplateService | null = null;

export function getEmailTemplateService(): EmailTemplateService {
  if (!globalEmailTemplateService) {
    globalEmailTemplateService = new EmailTemplateService();
  }
  return globalEmailTemplateService;
}

// Convenience function
export async function sendTemplatedEmail(options: EmailTemplateOptions): Promise<void> {
  return getEmailTemplateService().sendTemplatedEmail(options);
}